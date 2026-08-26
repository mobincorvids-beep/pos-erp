/**
 * ContractService — a generic, industry-agnostic contract/agreement
 * engine: supplier agreements, customer contracts, leases, NDAs,
 * employment or service agreements. Any business tracks the same
 * lifecycle regardless of what the contract is FOR — draft -> active ->
 * (expiring_soon ->) expired/terminated/renewed — so one engine covers
 * all of it rather than a narrow per-industry variant.
 *
 * refreshExpiryStatuses() is a "refresh derived status on read" bulk
 * update, the same shape recurringInvoiceService/documentService use for
 * expiry-adjacent state: no real cron exists for this in the codebase,
 * so listContracts() calls it first on every read, keeping status
 * genuinely current (never 'active' past its own endDate) without
 * needing a scheduled job.
 */
const Contract = require('../models/Contract');
const numberingService = require('./numberingService');

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function createContract(input) {
  const { companyId, branchId, title, contractType, counterpartyName, startDate, endDate } = input;
  if (!branchId) throw new Error('branchId is required.');
  if (!title) throw new Error('title is required.');
  if (!contractType) throw new Error('contractType is required.');
  if (!counterpartyName) throw new Error('counterpartyName is required.');
  if (!startDate || !endDate) throw new Error('startDate and endDate are required.');
  if (!(new Date(startDate) < new Date(endDate))) throw new Error('endDate must be after startDate.');

  const contractNumber = numberingService.nextDocumentNumber('CTR');
  return Contract.create({
    companyId, branchId, contractNumber, title, contractType, counterpartyName,
    relatedCustomerId: input.relatedCustomerId || null,
    relatedSupplierId: input.relatedSupplierId || null,
    value: input.value ?? null,
    currency: input.currency || 'PKR',
    startDate, endDate,
    autoRenew: !!input.autoRenew,
    renewalNoticeDays: input.renewalNoticeDays ?? 30,
    ownerUserId: input.ownerUserId || null,
    attachmentNote: input.attachmentNote || '',
  });
}

async function updateContract(contractId, patch) {
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');
  if (!['draft', 'active'].includes(contract.status)) {
    throw new Error(`Cannot edit a contract with status "${contract.status}".`);
  }

  const editable = [
    'title', 'contractType', 'counterpartyName', 'relatedCustomerId', 'relatedSupplierId',
    'value', 'currency', 'startDate', 'endDate', 'autoRenew', 'renewalNoticeDays',
    'ownerUserId', 'attachmentNote',
  ];
  for (const field of editable) {
    if (patch[field] !== undefined) contract[field] = patch[field];
  }
  if (new Date(contract.startDate) >= new Date(contract.endDate)) {
    throw new Error('endDate must be after startDate.');
  }
  await contract.save();
  return contract;
}

async function activateContract(contractId) {
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');
  if (contract.status !== 'draft') throw new Error(`Cannot activate a contract with status "${contract.status}".`);
  contract.status = 'active';
  await contract.save();
  return contract;
}

async function terminateContract(contractId, { terminationReason }) {
  if (!terminationReason) throw new Error('terminationReason is required.');
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');
  if (!['active', 'expiring_soon'].includes(contract.status)) {
    throw new Error(`Cannot terminate a contract with status "${contract.status}".`);
  }
  contract.status = 'terminated';
  contract.terminationReason = terminationReason;
  await contract.save();
  return contract;
}

/**
 * Creates a NEW Contract with a fresh term, linked back to the old one
 * via renewedFromContractId, and marks the old one 'renewed' — mirrors
 * how a renewal is a distinct, auditable record rather than mutating the
 * original contract's own dates in place.
 */
async function renewContract(contractId, { startDate, endDate, value }) {
  const oldContract = await Contract.findById(contractId);
  if (!oldContract) throw new Error('Contract not found.');
  if (!['active', 'expiring_soon'].includes(oldContract.status)) {
    throw new Error(`Cannot renew a contract with status "${oldContract.status}".`);
  }
  if (!startDate || !endDate) throw new Error('startDate and endDate are required for the renewed contract.');
  if (!(new Date(startDate) < new Date(endDate))) throw new Error('endDate must be after startDate.');

  const contractNumber = numberingService.nextDocumentNumber('CTR');
  const newContract = await Contract.create({
    companyId: oldContract.companyId,
    branchId: oldContract.branchId,
    contractNumber,
    title: oldContract.title,
    contractType: oldContract.contractType,
    counterpartyName: oldContract.counterpartyName,
    relatedCustomerId: oldContract.relatedCustomerId,
    relatedSupplierId: oldContract.relatedSupplierId,
    value: value ?? oldContract.value,
    currency: oldContract.currency,
    startDate, endDate,
    autoRenew: oldContract.autoRenew,
    renewalNoticeDays: oldContract.renewalNoticeDays,
    status: 'active',
    ownerUserId: oldContract.ownerUserId,
    attachmentNote: oldContract.attachmentNote,
    renewedFromContractId: oldContract._id,
  });

  oldContract.status = 'renewed';
  await oldContract.save();

  return { oldContract, newContract };
}

/**
 * Bulk-updates derived status on every ACTIVE(-ish) contract for a
 * company: past its own endDate -> 'expired'; within renewalNoticeDays
 * of endDate -> 'expiring_soon'. Called at the top of listContracts()
 * so status is always current on read without a real cron existing.
 * Only ever touches 'active'/'expiring_soon' contracts — draft,
 * terminated, expired, and renewed are terminal/manual states this
 * never overwrites.
 */
async function refreshExpiryStatuses(companyId) {
  const now = new Date();

  await Contract.updateMany(
    { companyId, status: { $in: ['active', 'expiring_soon'] }, endDate: { $lt: now } },
    { $set: { status: 'expired' } },
  );

  // Each contract can have its own renewalNoticeDays, so this can't be a
  // single fixed-cutoff query the way checkExpiringDocuments' fixed
  // daysAhead can — walk the still-active set and compare per-document.
  const stillActive = await Contract.find({ companyId, status: 'active' });
  const toFlag = stillActive.filter((c) => c.endDate <= daysFromNow(c.renewalNoticeDays));
  if (toFlag.length > 0) {
    await Contract.updateMany(
      { _id: { $in: toFlag.map((c) => c._id) } },
      { $set: { status: 'expiring_soon' } },
    );
  }
}

async function listContracts(companyId, { status, contractType, expiringWithinDays } = {}) {
  await refreshExpiryStatuses(companyId);

  const filter = { companyId };
  if (status) filter.status = status;
  if (contractType) filter.contractType = contractType;
  if (expiringWithinDays) {
    filter.status = { $in: ['active', 'expiring_soon'] };
    filter.endDate = { $lte: daysFromNow(Number(expiringWithinDays)) };
  }

  return Contract.find(filter)
    .populate('relatedCustomerId', 'name')
    .populate('relatedSupplierId', 'name')
    .populate('ownerUserId', 'name')
    .sort({ endDate: 1 });
}

async function getContract(contractId) {
  const contract = await Contract.findById(contractId)
    .populate('relatedCustomerId', 'name')
    .populate('relatedSupplierId', 'name')
    .populate('ownerUserId', 'name')
    .populate('renewedFromContractId', 'contractNumber title');
  if (!contract) throw new Error('Contract not found.');
  return contract;
}

/** Real query for contracts due for renewal review — same shape as documentService's checkExpiringDocuments' date-range check. */
async function expiringContracts(companyId, withinDays = 30) {
  await refreshExpiryStatuses(companyId);
  return Contract.find({
    companyId,
    status: { $in: ['active', 'expiring_soon'] },
    endDate: { $lte: daysFromNow(withinDays), $gte: new Date() },
  }).sort({ endDate: 1 });
}

module.exports = {
  createContract, updateContract, activateContract, terminateContract, renewContract,
  listContracts, getContract, expiringContracts, refreshExpiryStatuses,
};
