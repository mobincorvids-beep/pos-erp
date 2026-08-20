const { Schema, model } = require('mongoose');

// An OPD visit — links to core Customer (the patient, for billing/ledger)
// and core Employee (the attending doctor, since a doctor is staff — HR
// already models that, no need for a duplicate "Doctor" concept). This is
// the genuinely new mechanic this module exists for: a FIFO QUEUE, not a
// scheduled time slot. A patient doesn't book a specific minute like an
// Appointment; they check in, get a sequential position, and the front
// desk calls whoever's been waiting longest — see hospitalService.callNext().
const visitSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null }, // attending doctor, assigned when called
  chiefComplaint: String,
  queueNumber: { type: Number, required: true }, // sequential per branch per day — see hospitalService.checkIn()
  status: { type: String, default: 'waiting', enum: ['waiting', 'in_consultation', 'completed', 'cancelled'] },
  consultationFee: { type: Number, default: 0 },
  billingProductId: { type: Schema.Types.ObjectId, ref: 'Product', default: null }, // trackingMode 'service' — set at check-in time
  billingVariantId: { type: Schema.Types.ObjectId, default: null },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  checkedInAt: { type: Date, default: Date.now },
  calledAt: Date,
  completedAt: Date,
}, { timestamps: true });

visitSchema.index({ branchId: 1, checkedInAt: 1 });

module.exports = model('Visit', visitSchema);
