/**
 * StorageContractService — 3PL storage billed by duration × quantity held.
 * The genuinely new mechanic: computeStorageFee() integrates a
 * time-varying quantity over a billing period — a real step-function
 * integral, not a simple lookup or threshold check. Goods received and
 * released at different times each hold the warehouse's space for a
 * different number of days, and the fee has to account for that exactly,
 * not approximate it with an average.
 *
 * Deliberately does NOT touch the operator's own inventoryService/
 * StockLevel — a 3PL warehouse doesn't OWN what it's storing, so a
 * client's goods are tracked in this contract's own append-only ledger,
 * not mixed into the operator's sellable stock.
 */
const StorageContract = require('../models/StorageContract');
const posSaleService = require('../../../services/posSaleService');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function createContract(input) {
  const { companyId, branchId, clientCustomerId, productId, variantId, ratePerUnitPerDay, billingProductId, billingVariantId } = input;
  if (!ratePerUnitPerDay || ratePerUnitPerDay <= 0) throw new Error('ratePerUnitPerDay must be greater than zero.');
  return StorageContract.create({ companyId, branchId, clientCustomerId, productId, variantId, ratePerUnitPerDay, billingProductId, billingVariantId });
}

function listContracts(companyId, { clientCustomerId, status } = {}) {
  const filter = { companyId };
  if (clientCustomerId) filter.clientCustomerId = clientCustomerId;
  if (status) filter.status = status;
  return StorageContract.find(filter).populate('clientCustomerId', 'name').populate('productId', 'name');
}

function currentQuantityHeld(contract) {
  return contract.changes.reduce((sum, c) => sum + c.quantity, 0);
}

async function receiveGoods(contractId, { quantity, at }) {
  if (!quantity || quantity <= 0) throw new Error('quantity must be greater than zero.');
  const contract = await StorageContract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');
  contract.changes.push({ quantity, at: at ? new Date(at) : new Date() });
  await contract.save();
  return contract;
}

async function releaseGoods(contractId, { quantity, at }) {
  if (!quantity || quantity <= 0) throw new Error('quantity must be greater than zero.');
  const contract = await StorageContract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');

  const held = currentQuantityHeld(contract);
  if (quantity > held) throw new Error(`Cannot release ${quantity} — only ${held} are currently in storage under this contract.`);

  contract.changes.push({ quantity: -quantity, at: at ? new Date(at) : new Date() });
  await contract.save();
  return contract;
}

/**
 * The real algorithm: walks the changes ledger in chronological order,
 * establishing the quantity held AT periodStart from anything that
 * happened at-or-before it, then accumulates quantity × days-held for
 * every sub-interval a quantity change falls inside the period, and
 * finally the tail interval from the last change up to periodEnd.
 */
async function computeStorageFee(contractId, periodStart, periodEnd) {
  const contract = await StorageContract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (!(start < end)) throw new Error('periodEnd must be after periodStart.');

  const sorted = [...contract.changes].sort((a, b) => a.at - b.at);

  let runningQty = 0;
  let quantityDays = 0;
  let boundary = start;

  for (const change of sorted) {
    if (change.at <= start) { runningQty += change.quantity; continue; } // establishes the starting quantity at periodStart, not itself a billable interval
    if (change.at > end) break; // outside the period — ignore for this bill

    const intervalDays = (change.at - boundary) / MS_PER_DAY;
    quantityDays += runningQty * intervalDays;
    runningQty += change.quantity;
    boundary = change.at;
  }

  const tailDays = (end - boundary) / MS_PER_DAY;
  quantityDays += runningQty * tailDays;

  const fee = Math.round(quantityDays * contract.ratePerUnitPerDay * 100) / 100;
  return { quantityDays: Math.round(quantityDays * 100) / 100, fee };
}

/** Bills the computed fee for a period through the ordinary checkout. */
async function billPeriod(contractId, { periodStart, periodEnd, warehouseId, paymentAccountId, userId }) {
  const contract = await StorageContract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');

  const { fee } = await computeStorageFee(contractId, periodStart, periodEnd);
  if (fee <= 0) throw new Error('Computed storage fee is zero or negative — nothing to bill for this period.');

  const sale = await posSaleService.checkout({
    companyId: contract.companyId, branchId: contract.branchId, warehouseId,
    customerId: contract.clientCustomerId, userId,
    items: [{ productId: contract.billingProductId, variantId: contract.billingVariantId, quantity: 1, unitPrice: fee }],
    payments: paymentAccountId ? [{ paymentAccountId, method: 'cash', amount: fee }] : [],
  });

  return { sale, fee };
}

/**
 * Corrects the contract's rate going forward. Since computeStorageFee()
 * always uses the CURRENT ratePerUnitPerDay for an entire requested
 * period (there's no rate-history table), changing it here is inherently
 * a "from now on" correction — same as any live price list — not a
 * retroactive rewrite of fees already actually billed via billPeriod
 * (those became real Sale documents at whatever fee was computed at the
 * time, and are untouched by this).
 */
async function updateContract(contractId, { ratePerUnitPerDay }) {
  const contract = await StorageContract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');
  if (contract.status !== 'active') throw new Error(`Cannot edit a contract with status "${contract.status}".`);
  if (ratePerUnitPerDay !== undefined) {
    if (!ratePerUnitPerDay || ratePerUnitPerDay <= 0) throw new Error('ratePerUnitPerDay must be greater than zero.');
    contract.ratePerUnitPerDay = ratePerUnitPerDay;
  }
  await contract.save();
  return contract;
}

/** Closes a contract out — refused while any of the client's goods are still physically held, same as every other "still in use" refusal elsewhere in this app (an occupied hotel room, a booked rental vehicle). */
async function closeContract(contractId) {
  const contract = await StorageContract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');
  if (contract.status !== 'active') throw new Error(`Contract already has status "${contract.status}".`);
  const held = currentQuantityHeld(contract);
  if (held > 0) throw new Error(`Cannot close this contract — ${held} units are still held in storage under it. Release them first.`);
  contract.status = 'closed';
  await contract.save();
  return contract;
}

module.exports = { createContract, listContracts, currentQuantityHeld, receiveGoods, releaseGoods, computeStorageFee, billPeriod, updateContract, closeContract };
