/**
 * RouteSalesService — van-sales / area-wise rep assignment. A Customer
 * (shop) is assigned a salesRepId (Employee) and a route/area label; this
 * resolves "which employee is the logged-in user" (self-service, same
 * pattern as attendanceController) and lists that rep's assigned shops,
 * plus a lightweight visit log so daily route coverage is trackable.
 */
const Employee = require('../models/Employee');
const Customer = require('../models/Customer');
const CustomerVisit = require('../models/CustomerVisit');

/** Resolves the Employee record for the logged-in user — null if this login has no linked Employee. */
function resolveEmployee(companyId, userId) {
  return Employee.findOne({ companyId, userId });
}

/** All customers assigned to a rep, optionally filtered to one route/area label. */
function listAssignedCustomers(companyId, salesRepId, route) {
  const filter = { companyId, salesRepId };
  if (route) filter.route = route;
  return Customer.find(filter).sort({ route: 1, name: 1 });
}

/** Today's route for the logged-in user: their assigned customers plus who they've already visited today. */
async function getMyRoute(companyId, userId) {
  const employee = await resolveEmployee(companyId, userId);
  if (!employee) throw new Error('No employee record is linked to this login.');

  const customers = await listAssignedCustomers(companyId, employee._id);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const visitsToday = await CustomerVisit.find({
    companyId, salesRepId: employee._id, visitedAt: { $gte: startOfDay },
  });
  const visitedIds = new Set(visitsToday.map((v) => String(v.customerId)));

  return {
    employee: { _id: employee._id, name: employee.name },
    customers: customers.map((c) => ({
      _id: c._id, name: c.name, phone: c.phone, address: c.address, route: c.route,
      visitedToday: visitedIds.has(String(c._id)),
    })),
    visitsToday,
  };
}

async function logVisit(companyId, userId, input) {
  const employee = await resolveEmployee(companyId, userId);
  if (!employee) throw new Error('No employee record is linked to this login.');

  const { customerId, outcome, note, saleId } = input;
  if (!customerId) throw new Error('customerId is required.');

  const customer = await Customer.findOne({ _id: customerId, companyId });
  if (!customer) throw new Error('Customer not found.');

  return CustomerVisit.create({
    companyId, customerId, salesRepId: employee._id,
    visitedAt: new Date(), outcome: outcome || 'order_placed', note, saleId: saleId || null,
  });
}

/** Visit history for one customer, or one rep — management view (requires ROUTE_SALES_MANAGE for a rep other than self). */
function listVisits(companyId, filter) {
  return CustomerVisit.find({ companyId, ...filter }).sort({ visitedAt: -1 }).limit(200)
    .populate('customerId', 'name route').populate('salesRepId', 'name');
}

/** Every route/customer assignment — the management (non-self-service) view for planning coverage. */
function listAllAssignments(companyId) {
  return Customer.find({ companyId, salesRepId: { $ne: null } }).populate('salesRepId', 'name').sort({ route: 1, name: 1 });
}

module.exports = { resolveEmployee, listAssignedCustomers, getMyRoute, logVisit, listVisits, listAllAssignments };
