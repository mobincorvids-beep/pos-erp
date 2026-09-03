/**
 * CreditLimitService — checks a customer's outstanding balance against
 * Customer.creditLimit before a new credit sale is allowed through. A soft
 * warning, not a hard wall: posSaleService.checkout() blocks the sale by
 * throwing when the limit would be exceeded, but a caller carrying
 * CUSTOMER_CREDIT_LIMIT_OVERRIDE can pass overrideCreditLimit: true to push
 * the sale through anyway (see saleController.checkout and
 * middleware/auth.js's hasPermission for the gate).
 */
const Customer = require('../models/Customer');
const customerLedgerService = require('./customerLedgerService');

/**
 * @param {String} customerId
 * @param {Number} additionalDue - the dueAmount the sale being checked out would add
 * @returns {Promise<{creditLimit: Number, outstandingBalance: Number, projectedBalance: Number, exceeds: Boolean}>}
 */
async function checkCreditLimit(customerId, additionalDue) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error('Customer not found.');

  const creditLimit = customer.creditLimit || 0;
  const outstandingBalance = await customerLedgerService.getOutstandingBalance(customerId);
  const projectedBalance = outstandingBalance + Math.max(additionalDue || 0, 0);

  // creditLimit of 0 means "no credit limit configured" — not "zero credit
  // allowed" — otherwise every customer created before this feature (all
  // of them default to 0) would suddenly be blocked from any credit sale.
  const exceeds = creditLimit > 0 && projectedBalance > creditLimit;

  return { creditLimit, outstandingBalance, projectedBalance, exceeds };
}

module.exports = { checkCreditLimit };
