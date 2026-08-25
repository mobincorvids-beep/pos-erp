/**
 * ImportShipmentService — the genuinely new mechanic: additional costs
 * (customs duty, freight, insurance) are allocated PROPORTIONALLY BY
 * VALUE across every item in a shipment, and the resulting
 * adjustedUnitCost — not the raw invoice unitPrice — is what each item is
 * actually received into inventory at, via inventoryService.recordMovement's
 * own weighted-average costing. COGS and margin reporting downstream then
 * reflect the TRUE landed cost, not just what the supplier invoiced.
 *
 * The allocation itself uses the same "compute exact shares, round each,
 * then correct any rounding drift so the total allocated EXACTLY equals
 * the real total" discipline Footwear's size-curve apportionment already
 * established — allocating "approximately" would silently under- or
 * over-capitalize inventory value by a few cents every single shipment.
 *
 * The resulting voucher is a genuine multi-leg entry, hand-verified to
 * balance before this file was written: inventory increases by the FULL
 * landed cost (base value + every additional cost); credited partly to
 * the supplier (the base invoice) and partly to whoever each additional
 * cost is actually owed to (customs authority, freight forwarder, insurer).
 */
const ImportShipment = require('../models/ImportShipment');
const inventoryService = require('../../../services/inventoryService');
const accountingService = require('../../../services/accountingService');

function createShipment(input) {
  const { companyId, branchId, supplierId, items, additionalCosts } = input;
  if (!items || items.length === 0) throw new Error('At least one item is required.');
  return ImportShipment.create({ companyId, branchId, supplierId, items, additionalCosts: additionalCosts || [] });
}

function listShipments(companyId, { status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return ImportShipment.find(filter).populate('supplierId', 'name').sort({ createdAt: -1 });
}

/** Corrects a shipment's items/costs before receipt — only while 'pending', since receiveShipment() computes and posts the real allocation, voucher, and stock movements from whatever is on the shipment at that moment; editing afterward would desync all three from the actual books. */
async function updateShipment(shipmentId, { supplierId, items, additionalCosts }) {
  const shipment = await ImportShipment.findById(shipmentId);
  if (!shipment) throw new Error('Shipment not found.');
  if (shipment.status !== 'pending') throw new Error(`Cannot edit a shipment with status "${shipment.status}".`);
  if (supplierId !== undefined) shipment.supplierId = supplierId;
  if (items !== undefined) {
    if (!items.length) throw new Error('At least one item is required.');
    shipment.items = items;
  }
  if (additionalCosts !== undefined) shipment.additionalCosts = additionalCosts;
  await shipment.save();
  return shipment;
}

/** Cancels a shipment that was created in error — only while still 'pending', since nothing (no stock, no voucher) has been posted for it yet. */
function cancelShipment(shipmentId) {
  return ImportShipment.findOneAndDelete({ _id: shipmentId, status: 'pending' });
}

async function receiveShipment(shipmentId, { warehouseId, inventoryAssetAccountId, supplierPayableAccountId, userId }) {
  const shipment = await ImportShipment.findById(shipmentId);
  if (!shipment) throw new Error('Shipment not found.');
  if (shipment.status !== 'pending') throw new Error(`Cannot receive a shipment with status "${shipment.status}".`);
  if (!inventoryAssetAccountId || !supplierPayableAccountId) throw new Error('inventoryAssetAccountId and supplierPayableAccountId are required.');

  const totalAdditionalCosts = shipment.additionalCosts.reduce((sum, c) => sum + c.amount, 0);
  const totalShipmentValue = shipment.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (totalShipmentValue <= 0) throw new Error('Shipment has no value to allocate additional costs against.');

  // Exact proportional shares, rounded per item, with any rounding drift
  // corrected onto the LAST item — allocated total must equal the real
  // total exactly, never merely close to it.
  let allocatedSoFar = 0;
  shipment.items.forEach((item, i) => {
    const itemValue = item.quantity * item.unitPrice;
    const isLast = i === shipment.items.length - 1;
    const share = isLast
      ? Math.round((totalAdditionalCosts - allocatedSoFar) * 100) / 100
      : Math.round((totalAdditionalCosts * (itemValue / totalShipmentValue)) * 100) / 100;
    item.allocatedCost = share;
    item.adjustedUnitCost = Math.round((item.unitPrice + share / item.quantity) * 100) / 100;
    allocatedSoFar = Math.round((allocatedSoFar + share) * 100) / 100;
  });

  const entries = [
    { accountId: inventoryAssetAccountId, debit: totalShipmentValue + totalAdditionalCosts, credit: 0 },
    { accountId: supplierPayableAccountId, debit: 0, credit: totalShipmentValue },
  ];
  for (const cost of shipment.additionalCosts) {
    entries.push({ accountId: cost.accountId, debit: 0, credit: cost.amount });
  }

  const voucher = await accountingService.postVoucher({
    companyId: shipment.companyId, branchId: shipment.branchId, type: 'journal',
    narration: `Import shipment received — landed cost ${totalShipmentValue + totalAdditionalCosts}`,
    entries, referenceType: 'ImportShipment', referenceId: shipment._id, userId,
  });

  for (const item of shipment.items) {
    await inventoryService.recordMovement({
      companyId: shipment.companyId, warehouseId, productId: item.productId, variantId: item.variantId,
      type: 'purchase', quantity: item.quantity, unitCost: item.adjustedUnitCost,
      referenceType: 'ImportShipment', referenceId: shipment._id, userId,
      note: `Received at landed cost ${item.adjustedUnitCost} (invoice ${item.unitPrice} + allocated ${item.allocatedCost})`,
    });
  }

  shipment.status = 'received';
  shipment.voucherId = voucher._id;
  await shipment.save();

  return { shipment, voucher, totalLandedCost: totalShipmentValue + totalAdditionalCosts };
}

module.exports = { createShipment, listShipments, receiveShipment, updateShipment, cancelShipment };
