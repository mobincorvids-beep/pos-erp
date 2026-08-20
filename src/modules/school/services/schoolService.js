/**
 * SchoolService — students, fee structures, batch fee-invoice generation,
 * and payment. The genuinely new pattern here is generateFeeInvoices():
 * every other module in this app bills once per transaction (a checkout, a
 * service, a room-night); this one stamps out MANY invoices at once for a
 * single period, across every eligible student — the same batch shape
 * hrService.generatePayroll() uses for payroll, applied to receivables
 * instead of payables. Paying an invoice still goes through the ordinary
 * posSaleService.checkout(), same as every other module's billing step.
 */
const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const FeeInvoice = require('../models/FeeInvoice');
const StudentAttendance = require('../models/StudentAttendance');
const posSaleService = require('../../../services/posSaleService');

// --- Students --------------------------------------------------------------

function createStudent(input) {
  const { companyId, branchId, customerId, name, className, guardianName, guardianPhone, enrollmentDate } = input;
  if (!name) throw new Error('Student name is required.');
  return Student.create({ companyId, branchId, customerId, name, className, guardianName, guardianPhone, enrollmentDate });
}

function listStudents(companyId, className) {
  const filter = { companyId, status: 'active' };
  if (className) filter.className = className;
  return Student.find(filter);
}

// --- Fee structures ----------------------------------------------------------

function createFeeStructure(input) {
  const { companyId, name, className, amount, billingProductId, billingVariantId, frequency } = input;
  if (!name || !amount) throw new Error('name and amount are required.');
  return FeeStructure.create({ companyId, name, className, amount, billingProductId, billingVariantId, frequency });
}

function listFeeStructures(companyId) {
  return FeeStructure.find({ companyId, isActive: true });
}

// --- Batch fee invoice generation -------------------------------------------

/**
 * Generates one FeeInvoice per active, eligible student for this fee
 * structure and period. Idempotent by design — the unique index on
 * (feeStructureId, studentId, period) means calling this twice for the
 * same period just skips students who already have one, rather than
 * erroring or duplicating (a real difference from generatePayroll, which
 * throws on a duplicate period — fee generation is safe to re-run if a
 * new student enrolls partway through the month, payroll generation isn't).
 */
async function generateFeeInvoices({ companyId, feeStructureId, period, dueDate }) {
  const structure = await FeeStructure.findOne({ _id: feeStructureId, companyId, isActive: true });
  if (!structure) throw new Error('Fee structure not found.');

  const studentFilter = { companyId, status: 'active' };
  if (structure.className) studentFilter.className = structure.className;
  const students = await Student.find(studentFilter);

  const created = [];
  const skipped = [];
  for (const student of students) {
    try {
      const invoice = await FeeInvoice.create({
        companyId, studentId: student._id, feeStructureId: structure._id,
        period, amount: structure.amount, dueDate,
      });
      created.push(invoice);
    } catch (err) {
      if (err.code === 11000) skipped.push(student._id); // already has an invoice for this period — not an error, just a no-op
      else throw err;
    }
  }

  return { created, skippedCount: skipped.length, totalEligible: students.length };
}

function listInvoices(companyId, { studentId, status, period } = {}) {
  const filter = { companyId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  if (period) filter.period = period;
  return FeeInvoice.find(filter).populate('studentId', 'name className').sort({ dueDate: 1 });
}

/** Flags every pending invoice past its due date as overdue — call this on a schedule (e.g. daily), not something checkout or generation does automatically. */
async function flagOverdueInvoices(companyId) {
  const result = await FeeInvoice.updateMany(
    { companyId, status: 'pending', dueDate: { $lt: new Date() } },
    { status: 'overdue' }
  );
  return result.modifiedCount;
}

/** Pays one invoice — bills through the ordinary checkout (a service line, no stock involved), then marks the invoice paid and links the resulting Sale. */
async function payInvoice(invoiceId, { branchId, warehouseId, paymentAccountId, posTerminalId, userId }) {
  const invoice = await FeeInvoice.findById(invoiceId);
  if (!invoice) throw new Error('Fee invoice not found.');
  if (!['pending', 'overdue'].includes(invoice.status)) throw new Error(`Cannot pay an invoice with status "${invoice.status}".`);

  const structure = await FeeStructure.findById(invoice.feeStructureId);
  if (!structure) throw new Error('Fee structure for this invoice no longer exists.');

  const sale = await posSaleService.checkout({
    companyId: invoice.companyId, branchId, warehouseId, posTerminalId, userId,
    items: [{ productId: structure.billingProductId, variantId: structure.billingVariantId, quantity: 1, unitPrice: invoice.amount }],
    payments: [{ paymentAccountId, method: 'cash', amount: invoice.amount }],
  });

  invoice.status = 'paid';
  invoice.saleId = sale._id;
  await invoice.save();

  return { sale, invoice };
}

// --- Attendance -----------------------------------------------------------

function markAttendance({ companyId, studentId, date, status, note }) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return StudentAttendance.findOneAndUpdate(
    { studentId, date: day },
    { companyId, studentId, date: day, status, note },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function attendanceForMonth(studentId, month, year) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);
  return StudentAttendance.find({ studentId, date: { $gte: from, $lte: to } }).sort({ date: 1 });
}

module.exports = {
  createStudent, listStudents,
  createFeeStructure, listFeeStructures,
  generateFeeInvoices, listInvoices, flagOverdueInvoices, payInvoice,
  markAttendance, attendanceForMonth,
};
