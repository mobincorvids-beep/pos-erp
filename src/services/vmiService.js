/**
 * VmiService — Vendor-Managed Inventory. A VmiAgreement (staff-created)
 * gives a supplier standing visibility into OUR stock level for a specific
 * product/warehouse and an agreed min/max band; the supplier (through the
 * supplier portal) can then propose a replenishment order themselves
 * instead of waiting for staff to notice and raise a PO. Staff review and
 * convert proposals into a real PurchaseOrder through the normal
 * purchaseService.createPurchaseOrder (so approval/receiving/accounting
 * all work exactly as they already do for any other PO) — unless the
 * agreement is autoApprove, in which case conversion happens immediately.
 */
const VmiAgreement = require('../models/VmiAgreement');
const VmiReplenishmentProposal = require('../models/VmiReplenishmentProposal');
const inventoryService = require('./inventoryService');
const purchaseService = require('./purchaseService');
const notificationService = require('./notificationService');
const Role = require('../models/Role');

async function createAgreement(companyId, { supplierId, warehouseId, productId, variantId, minQty, maxQty, unitCost, autoApprove, userId }) {
  if (maxQty < minQty) throw new Error('maxQty must be greater than or equal to minQty.');
  return VmiAgreement.findOneAndUpdate(
    { companyId, supplierId, warehouseId, productId, variantId: variantId || null },
    { minQty, maxQty, unitCost, autoApprove: !!autoApprove, isActive: true, userId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function listAgreements(companyId, { supplierId, warehouseId } = {}) {
  const filter = { companyId };
  if (supplierId) filter.supplierId = supplierId;
  if (warehouseId) filter.warehouseId = warehouseId;
  return VmiAgreement.find(filter).sort({ createdAt: -1 });
}

async function setAgreementActive(companyId, agreementId, isActive) {
  const agreement = await VmiAgreement.findOneAndUpdate({ _id: agreementId, companyId }, { isActive: !!isActive }, { new: true });
  if (!agreement) throw new Error('VMI agreement not found.');
  return agreement;
}

/** Supplier-portal-facing: this supplier's covered products, with live on-hand for each. */
async function getSupplierVisibility(companyId, supplierId) {
  const agreements = await VmiAgreement.find({ companyId, supplierId, isActive: true })
    .populate('productId', 'name sku')
    .populate('warehouseId', 'name');

  const rows = [];
  for (const a of agreements) {
    const onHand = await inventoryService.getStockLevel(a.warehouseId._id, a.variantId || a.productId._id);
    rows.push({
      agreementId: a._id,
      product: a.productId,
      warehouse: a.warehouseId,
      minQty: a.minQty,
      maxQty: a.maxQty,
      unitCost: a.unitCost,
      onHand,
      belowMin: onHand <= a.minQty,
      suggestedQty: onHand <= a.minQty ? Math.max(0, a.maxQty - onHand) : 0,
    });
  }
  return rows;
}

/**
 * Supplier proposes (or system auto-suggests) a replenishment order for one
 * agreement. autoApprove agreements convert straight to a PurchaseOrder;
 * everything else waits in 'pending' for staff review.
 */
async function proposeReplenishment(companyId, agreementId, { proposedQty, supplierId, branchId } = {}) {
  const agreement = await VmiAgreement.findOne({ _id: agreementId, companyId, isActive: true });
  if (!agreement) throw new Error('VMI agreement not found or inactive.');
  if (supplierId && String(agreement.supplierId) !== String(supplierId)) {
    throw new Error('This agreement does not belong to that supplier.');
  }

  const onHand = await inventoryService.getStockLevel(agreement.warehouseId, agreement.variantId || agreement.productId);
  const qty = proposedQty != null ? proposedQty : Math.max(0, agreement.maxQty - onHand);
  if (qty <= 0) throw new Error('Nothing to propose: stock is already at or above the agreed maximum.');

  const proposal = await VmiReplenishmentProposal.create({
    companyId, agreementId, supplierId: agreement.supplierId, warehouseId: agreement.warehouseId,
    productId: agreement.productId, variantId: agreement.variantId,
    onHandAtProposal: onHand, proposedQty: qty, unitCost: agreement.unitCost,
    status: agreement.autoApprove ? 'approved' : 'pending',
  });

  if (agreement.autoApprove) {
    await convertProposalToPO(companyId, proposal._id, { branchId, userId: null });
  } else {
    try {
      const roles = await Role.find({ companyId, permissions: { $in: ['purchases.create', '*'] } });
      for (const role of roles) {
        await notificationService.notify({
          companyId, roleId: role._id, type: 'vmi_proposal',
          title: 'New VMI replenishment proposal',
          message: `A supplier proposed replenishing ${qty} unit(s) — review in Procurement > VMI.`,
          entityType: 'VmiReplenishmentProposal', entityId: proposal._id,
        });
      }
    } catch (err) {
      console.error('VMI proposal notification failed (proposal itself still succeeded):', err.message);
    }
  }

  return VmiReplenishmentProposal.findById(proposal._id);
}

async function listProposals(companyId, { supplierId, status } = {}) {
  const filter = { companyId };
  if (supplierId) filter.supplierId = supplierId;
  if (status) filter.status = status;
  return VmiReplenishmentProposal.find(filter).sort({ createdAt: -1 });
}

/** Staff reject a pending proposal — no PO is ever created. */
async function rejectProposal(companyId, proposalId, { userId, note }) {
  const proposal = await VmiReplenishmentProposal.findOne({ _id: proposalId, companyId });
  if (!proposal) throw new Error('VMI proposal not found.');
  if (proposal.status !== 'pending') throw new Error(`Already ${proposal.status}.`);
  proposal.status = 'rejected';
  proposal.decidedBy = userId;
  proposal.decidedAt = new Date();
  if (note) proposal.note = note;
  await proposal.save();
  return proposal;
}

/**
 * Converts a pending/approved proposal into a real draft PurchaseOrder via
 * the normal purchaseService — so approval, receiving (including
 * isConsignment if this agreement's supplier also does consignment — the
 * two features compose, nothing stops a VMI supplier's PO from ALSO being
 * flagged consignment by whoever converts it), and accounting all work
 * exactly as for any other PO.
 */
async function convertProposalToPO(companyId, proposalId, { branchId, userId } = {}) {
  const proposal = await VmiReplenishmentProposal.findOne({ _id: proposalId, companyId });
  if (!proposal) throw new Error('VMI proposal not found.');
  if (proposal.status === 'converted') throw new Error('Already converted.');
  if (proposal.status === 'rejected') throw new Error('Cannot convert a rejected proposal.');

  let resolvedBranchId = branchId;
  if (!resolvedBranchId) {
    const Branch = require('../models/Branch');
    const anyBranch = await Branch.findOne({ companyId }).select('_id');
    if (!anyBranch) throw new Error('No branch found for this company — branchId is required.');
    resolvedBranchId = anyBranch._id;
  }

  const po = await purchaseService.createPurchaseOrder({
    companyId,
    branchId: resolvedBranchId,
    warehouseId: proposal.warehouseId,
    supplierId: proposal.supplierId,
    items: [{
      productId: proposal.productId,
      variantId: proposal.variantId || proposal.productId,
      quantityOrdered: proposal.proposedQty,
      unitCost: proposal.unitCost,
    }],
    userId,
  });

  proposal.status = 'converted';
  proposal.purchaseOrderId = po._id;
  proposal.decidedBy = userId;
  proposal.decidedAt = new Date();
  await proposal.save();

  return { proposal, purchaseOrder: po };
}

module.exports = {
  createAgreement, listAgreements, setAgreementActive,
  getSupplierVisibility, proposeReplenishment, listProposals, rejectProposal, convertProposalToPO,
};
