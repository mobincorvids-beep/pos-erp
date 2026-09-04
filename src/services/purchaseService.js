/**
 * PurchaseService — the procurement side of the same pattern PosSaleService
 * uses for sales: one Mongo transaction ties the business document (GRN) to
 * its stock effect (InventoryService) and its accounting effect
 * (AccountingService), so goods received always match what's on the ledger.
 *
 * A PO now starts as 'draft' and requires approval (via ApprovalService)
 * before it can be received — the "Procurement" module's approval workflow
 * from the proposal, using the generic ApprovalRequest rather than a
 * PO-specific status dance.
 */
const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceivedNote = require('../models/GoodsReceivedNote');
const ProductBatch = require('../models/ProductBatch');
const ProductSerial = require('../models/ProductSerial');
const ProjectCost = require('../models/ProjectCost');
const ConsignmentStock = require('../models/ConsignmentStock');
const Account = require('../models/Account');
const inventoryService = require('./inventoryService');
const accountingService = require('./accountingService');
const currencyService = require('./currencyService');
const approvalService = require('./approvalService');
const auditService = require('./auditService');
const defaultAccountsService = require('./defaultAccountsService');
const { nextDocumentNumber } = require('./numberingService');

/**
 * @param {Object} input
 * @param {String} input.companyId
 * @param {String} input.branchId
 * @param {String} input.warehouseId
 * @param {String} input.supplierId
 * @param {Array} input.items - [{ productId, variantId, quantityOrdered, unitCost }]
 * @param {String} [input.requisitionId] - links back to the PurchaseRequisition this PO fulfills, if any
 * @param {String} [input.userId]
 * @param {String} [input.currency] - optional foreign currency this PO is being raised/agreed in (e.g. "USD" for a company whose base currency is PKR); items[].unitCost is always entered/stored in the company's BASE currency, same as Sale — this only drives the display-only foreignTotalAmount snapshot below.
 * @param {String} [input.currencyDate] - date to resolve the rate for, defaults to today
 */
async function createPurchaseOrder(input) {
  const { companyId, branchId, warehouseId, supplierId, items, requisitionId, projectId, subcontractorId, retentionPercent, retentionAmount, userId, isDropShip, dropShipCustomerId, dropShipAddress } = input;
  if (!items || items.length === 0) throw new Error('Purchase order must contain at least one item.');

  const subtotal = items.reduce((sum, i) => sum + i.unitCost * i.quantityOrdered, 0);

  // Resolved once, up front, using the STORED rate (never a live lookup
  // later) so a historical PO's foreign total never drifts — same
  // "resolve before any write, snapshot the number" rule posSaleService
  // already follows for Sale.
  let resolvedExchangeRate = null;
  if (input.currency) {
    const Company = require('../models/Company');
    const company = await Company.findById(companyId);
    if (company && company.currency && company.currency.toUpperCase() !== input.currency.toUpperCase()) {
      resolvedExchangeRate = await currencyService.getRate(companyId, company.currency, input.currency, input.currencyDate);
    }
  }

  // Snapshot the expected arrival date from the supplier's current lead
  // time at creation — see PurchaseOrder.expectedDate's own comment.
  let expectedDate = null;
  {
    const Supplier = require('../models/Supplier');
    const supplier = await Supplier.findById(supplierId).select('leadTimeDays');
    if (supplier && supplier.leadTimeDays > 0) {
      expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + supplier.leadTimeDays);
    }
  }

  const po = await PurchaseOrder.create({
    companyId, branchId, warehouseId, supplierId, requisitionId: requisitionId || null, projectId: projectId || null,
    subcontractorId: subcontractorId || null, retentionPercent: retentionPercent || 0, retentionAmount: retentionAmount || 0,
    poNumber: nextDocumentNumber('PO'),
    expectedDate,
    status: 'draft', // must be approved before it can be received — see approvePurchaseOrder()
    isDropShip: !!isDropShip,
    dropShipCustomerId: isDropShip ? (dropShipCustomerId || null) : null,
    dropShipAddress: isDropShip ? (dropShipAddress || null) : null,
    items: items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantityOrdered: i.quantityOrdered,
      quantityReceived: 0,
      unitCost: i.unitCost,
      dropShipSaleId: isDropShip ? (i.dropShipSaleId || null) : null,
      dropShipSaleItemIndex: isDropShip && i.dropShipSaleItemIndex != null ? i.dropShipSaleItemIndex : null,
    })),
    subtotal,
    taxAmount: 0,
    totalAmount: subtotal,
    currency: resolvedExchangeRate ? input.currency.toUpperCase() : null,
    exchangeRate: resolvedExchangeRate || 1,
    foreignTotalAmount: resolvedExchangeRate ? Math.round(subtotal * resolvedExchangeRate * 100) / 100 : null,
    userId,
  });

  await approvalService.request({ companyId, entityType: 'PurchaseOrder', entityId: po._id, requestedBy: userId });
  if (requisitionId) {
    const requisitionService = require('./requisitionService'); // required lazily to avoid a require cycle (requisitionService doesn't need purchaseService, but keep the dependency one-directional)
    await requisitionService.markRequisitionConverted(requisitionId);
  }
  await auditService.record({
    companyId, userId, action: 'purchase_order.created', entityType: 'PurchaseOrder', entityId: po._id,
    metadata: { poNumber: po.poNumber, totalAmount: po.totalAmount },
  });

  return po;
}

/** Approves (or rejects) a draft PO, moving it to 'ordered' so it can be received. */
async function decidePurchaseOrder(poId, { approve, userId, note }) {
  const po = await PurchaseOrder.findById(poId);
  if (!po) throw new Error('Purchase order not found.');
  if (po.status !== 'draft') throw new Error(`Cannot decide on a PO with status "${po.status}".`);

  const approval = await approvalService.findFor('PurchaseOrder', poId);
  if (!approval) throw new Error('No approval request found for this purchase order.');
  await approvalService.decide(approval._id, { approve, userId, note });

  po.status = approve ? 'ordered' : 'cancelled';
  await po.save();

  await auditService.record({
    companyId: po.companyId, userId, action: approve ? 'purchase_order.approved' : 'purchase_order.rejected',
    entityType: 'PurchaseOrder', entityId: po._id,
  });

  return po;
}

/**
 * Computes, for every line item on a PO, how much of the PO's landedCosts
 * (freight, customs duty, insurance, handling, ...) it should absorb, and
 * the resulting effective (landed) per-unit cost.
 *
 * Each landedCosts entry is allocated independently across ALL of the PO's
 * line items (by quantityOrdered, not quantityReceived — a line's fair
 * share of freight doesn't change depending on how many GRNs it takes to
 * receive it), using its own allocationMethod, then the per-line shares
 * from every entry are summed. by_value splits an entry proportionally to
 * each line's subtotal (unitCost * quantityOrdered); by_quantity splits it
 * evenly per unit across all ordered units.
 *
 * Returns a Map keyed by the line's _id (string) to
 * { allocatedAmount, perUnitLandedCost, adjustedUnitCost }. With no
 * landedCosts (the default for every existing PO) every line gets
 * allocatedAmount 0 and adjustedUnitCost === unitCost — zero change to
 * existing behaviour.
 */
function computeLandedCostAllocation(po) {
  const result = new Map();
  for (const line of po.items) {
    result.set(String(line._id), { allocatedAmount: 0, perUnitLandedCost: 0, adjustedUnitCost: line.unitCost });
  }

  const landedCosts = po.landedCosts || [];
  if (landedCosts.length === 0 || po.items.length === 0) return result;

  const totalValue = po.items.reduce((sum, l) => sum + l.unitCost * l.quantityOrdered, 0);
  const totalQuantity = po.items.reduce((sum, l) => sum + l.quantityOrdered, 0);

  for (const cost of landedCosts) {
    for (const line of po.items) {
      const key = String(line._id);
      let share = 0;
      if (cost.allocationMethod === 'by_quantity') {
        share = totalQuantity > 0 ? (cost.amount * line.quantityOrdered) / totalQuantity : 0;
      } else { // by_value (also the default/fallback)
        const lineValue = line.unitCost * line.quantityOrdered;
        share = totalValue > 0 ? (cost.amount * lineValue) / totalValue : 0;
      }
      const entry = result.get(key);
      entry.allocatedAmount += share;
    }
  }

  for (const line of po.items) {
    const entry = result.get(String(line._id));
    entry.perUnitLandedCost = line.quantityOrdered > 0 ? entry.allocatedAmount / line.quantityOrdered : 0;
    entry.adjustedUnitCost = line.unitCost + entry.perUnitLandedCost;
  }

  return result;
}

/** Adds a landed cost entry (freight/duty/insurance/handling/...) to a PO. Allowed any time before the PO is cancelled — landed costs are typically known before or around receiving, and can be corrected up until the goods are fully accounted for. */
async function addLandedCost(poId, { description, amount, allocationMethod, userId }) {
  const po = await PurchaseOrder.findById(poId);
  if (!po) throw new Error('Purchase order not found.');
  if (po.status === 'cancelled') throw new Error('Cannot add landed costs to a cancelled purchase order.');

  po.landedCosts.push({ description, amount, allocationMethod: allocationMethod || 'by_value' });
  await po.save();

  await auditService.record({
    companyId: po.companyId, userId, action: 'purchase_order.landed_cost_added',
    entityType: 'PurchaseOrder', entityId: po._id, metadata: { description, amount, allocationMethod },
  });

  return po;
}

/** Edits an existing landed cost entry on a PO. */
async function updateLandedCost(poId, landedCostId, { description, amount, allocationMethod, userId }) {
  const po = await PurchaseOrder.findById(poId);
  if (!po) throw new Error('Purchase order not found.');
  if (po.status === 'cancelled') throw new Error('Cannot edit landed costs on a cancelled purchase order.');

  const entry = po.landedCosts.id(landedCostId);
  if (!entry) throw new Error('Landed cost entry not found on this purchase order.');

  if (description !== undefined) entry.description = description;
  if (amount !== undefined) entry.amount = amount;
  if (allocationMethod !== undefined) entry.allocationMethod = allocationMethod;
  await po.save();

  await auditService.record({
    companyId: po.companyId, userId, action: 'purchase_order.landed_cost_updated',
    entityType: 'PurchaseOrder', entityId: po._id, metadata: { landedCostId },
  });

  return po;
}

/** Removes a landed cost entry from a PO. */
async function removeLandedCost(poId, landedCostId, { userId }) {
  const po = await PurchaseOrder.findById(poId);
  if (!po) throw new Error('Purchase order not found.');
  if (po.status === 'cancelled') throw new Error('Cannot remove landed costs from a cancelled purchase order.');

  const entry = po.landedCosts.id(landedCostId);
  if (!entry) throw new Error('Landed cost entry not found on this purchase order.');
  entry.deleteOne();
  await po.save();

  await auditService.record({
    companyId: po.companyId, userId, action: 'purchase_order.landed_cost_removed',
    entityType: 'PurchaseOrder', entityId: po._id, metadata: { landedCostId },
  });

  return po;
}

/**
 * Receive some or all of a PO's items. Supports partial receiving — a PO can
 * have several GRNs until quantityReceived reaches quantityOrdered on every line.
 *
 * @param {Object} input
 * @param {String} input.purchaseOrderId
 * @param {String} input.warehouseId
 * @param {Array} input.items - [{ purchaseOrderItemId, productId, variantId, quantity, unitCost, batchId?, batchNumber?, manufactureDate?, expiryDate?, serialNumbers? }]
 *   Pass batchId if the batch already exists; pass batchNumber (+ optional
 *   manufactureDate/expiryDate) to have one created for this receipt — the
 *   two are mutually exclusive per line. Neither is required for
 *   non-batch-tracked products.
 *   For serial/IMEI-tracked products, pass serialNumbers: an array with
 *   exactly one entry per unit (its length must equal quantity — a serial
 *   identifies one physical unit, so "receive 5, log 3 serials" is a
 *   contradiction, not a partial input). A ProductSerial record is created
 *   per entry, same transaction as everything else on this receipt.
 * @param {String} [input.userId]
 * @param {String} [input.payableAccountId] - liability account for the supplier; falls back to a company "Accounts Payable" account
 * @param {String} [input.paymentAccountId] - if paying immediately (e.g. cash purchase); otherwise the amount sits as payable
 */
async function receiveGoods(input) {
  const session = await mongoose.startSession();
  try {
    let grn;

    await session.withTransaction(async () => {
      const {
        purchaseOrderId, warehouseId, items, userId, payableAccountId, paymentAccountId,
      } = input;

      const po = await PurchaseOrder.findById(purchaseOrderId).session(session);
      if (!po) throw new Error('Purchase order not found.');
      if (!['ordered', 'partially_received'].includes(po.status)) {
        throw new Error(`Cannot receive goods against a PO with status "${po.status}": it must be approved (status "ordered") first.`);
      }
      if (!items || items.length === 0) throw new Error('GRN must contain at least one item.');

      // Resolve batchId and validate/create serial numbers for every line
      // before anything else touches inventory — a line with batchNumber
      // but no batchId gets a new ProductBatch created here, and a line
      // with serialNumbers gets one ProductSerial per unit, so the GRN, the
      // stock movement, and the resulting records all agree with each other.
      const resolvedItems = [];
      const newSerialDocs = [];
      for (const item of items) {
        if (item.batchId && item.batchNumber) {
          throw new Error('Pass either batchId or batchNumber for a line, not both.');
        }
        let batchId = item.batchId || null;
        if (!batchId && item.batchNumber) {
          const [batch] = await ProductBatch.create(
            [{
              companyId: po.companyId, productId: item.productId, variantId: item.variantId,
              batchNumber: item.batchNumber,
              manufactureDate: item.manufactureDate || null,
              expiryDate: item.expiryDate || null,
              costPrice: item.unitCost,
              receivedDate: new Date(),
            }],
            { session }
          );
          batchId = batch._id;
        }

        let serialNumbers = [];
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          serialNumbers = item.serialNumbers.map((s) => s.trim()).filter(Boolean);
          if (serialNumbers.length !== item.quantity) {
            throw new Error(
              `Line for product ${item.productId}: ${serialNumbers.length} serial number(s) provided but quantity is ${item.quantity}, exactly one serial per unit is required.`
            );
          }
          const withinLineDuplicates = serialNumbers.filter((s, i) => serialNumbers.indexOf(s) !== i);
          if (withinLineDuplicates.length > 0) {
            throw new Error(`Duplicate serial number(s) within the same line: ${[...new Set(withinLineDuplicates)].join(', ')}.`);
          }
          const existing = await ProductSerial.find(
            { variantId: item.variantId, serialNumber: { $in: serialNumbers } }
          ).session(session);
          if (existing.length > 0) {
            throw new Error(`Serial number(s) already on record for this product: ${existing.map((e) => e.serialNumber).join(', ')}.`);
          }
          for (const serialNumber of serialNumbers) {
            newSerialDocs.push({
              companyId: po.companyId, productId: item.productId, variantId: item.variantId,
              serialNumber, status: 'in_stock', warehouseId,
            });
          }
        }

        resolvedItems.push({ ...item, batchId, serialNumbers });
      }

      if (newSerialDocs.length > 0) {
        await ProductSerial.insertMany(newSerialDocs, { session });
      }

      let receivedTotal = 0;

      // Landed costs (freight/customs/insurance/handling on the PO as a
      // whole) are allocated across the PO's ordered lines up front — see
      // computeLandedCostAllocation. A PO with no landedCosts (the default)
      // returns perUnitLandedCost 0 for every line, so effectiveUnitCost
      // below is exactly item.unitCost and every existing PO/GRN behaves
      // identically to before this feature.
      const allocation = computeLandedCostAllocation(po);

      [grn] = await GoodsReceivedNote.create(
        [{
          companyId: po.companyId,
          purchaseOrderId: po._id,
          warehouseId,
          grnNumber: nextDocumentNumber('GRN'),
          receivedDate: new Date(),
          items: resolvedItems.map((i) => {
            const perUnitLandedCost = allocation.get(String(i.purchaseOrderItemId))?.perUnitLandedCost || 0;
            return {
              purchaseOrderItemId: i.purchaseOrderItemId,
              productId: i.productId,
              variantId: i.variantId,
              batchId: i.batchId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              landedCostPerUnit: perUnitLandedCost,
              effectiveUnitCost: i.unitCost + perUnitLandedCost,
              serialNumbers: i.serialNumbers,
              binLocation: (i.binLocation || '').trim(),
            };
          }),
          userId,
        }],
        { session }
      );

      // Consignment stock — collected as lines are received below, then
      // written as ConsignmentStock rows after the loop (see
      // consignmentService for how they're later consumed/settled).
      // Supplier-owned goods sitting in our warehouse, unpaid until sold.
      const consignmentEntries = [];

      // 1. Increase inventory for each received line.
      for (const item of resolvedItems) {
        const line = po.items.id(item.purchaseOrderItemId);
        if (!line) throw new Error(`Purchase order line ${item.purchaseOrderItemId} not found on this PO.`);
        const remaining = line.quantityOrdered - line.quantityReceived;
        if (item.quantity > remaining) {
          throw new Error(`Cannot receive ${item.quantity}: only ${remaining} remain outstanding on this line (ordered ${line.quantityOrdered}, already received ${line.quantityReceived}).`);
        }

        const perUnitLandedCost = allocation.get(String(item.purchaseOrderItemId))?.perUnitLandedCost || 0;
        // The landed-cost-adjusted unit cost is what flows into stock
        // valuation/weighted-average cost and COGS — not the raw vendor
        // unit price — so freight/duty/insurance/handling genuinely become
        // part of the product's cost basis.
        const effectiveUnitCost = item.unitCost + perUnitLandedCost;

        // Drop-shipping: this line's goods never touch this company's
        // warehouse — the supplier ships straight to the customer — so
        // skip the normal stock-in movement entirely and instead mark the
        // linked Sale (sales order) line fulfilled. Everything else about
        // receiving (PO quantityReceived rollup, AP/payable posting below)
        // still happens exactly as normal — the PO is still genuinely
        // "received" from an accounting standpoint, it just never becomes
        // on-hand stock.
        if (po.isDropShip && line.dropShipSaleId != null && line.dropShipSaleItemIndex != null) {
          const Sale = require('../models/Sale');
          const sale = await Sale.findById(line.dropShipSaleId).session(session);
          if (sale && sale.items[line.dropShipSaleItemIndex]) {
            const saleItem = sale.items[line.dropShipSaleItemIndex];
            saleItem.dropShipFulfilled = true;
            saleItem.dropShipPurchaseOrderId = po._id;
            saleItem.dropShipFulfilledAt = new Date();
            await sale.save({ session });
          }
        } else {
          await inventoryService.recordMovement({
            companyId: po.companyId,
            warehouseId,
            productId: item.productId,
            variantId: item.variantId,
            batchId: item.batchId || null,
            type: 'purchase',
            quantity: item.quantity, // stock in
            unitCost: effectiveUnitCost,
            referenceType: 'GoodsReceivedNote',
            referenceId: grn._id,
            userId,
            note: `GRN ${grn.grnNumber}`,
            // Putaway bin the receiver actually chose (defaults to the
            // suggestion from putawayService.suggestPutawayBin if they took
            // it as-is) — when present, this is what keeps BinStock accurate
            // for received stock instead of leaving it unlocated until
            // someone manually calls assignStockToBin later.
            binId: item.binId || null,
          }, session);
        }

        // Consignment: goods just went physically on-hand above (normal
        // stock-in, unlike drop-ship) but no AP liability exists yet — it's
        // created incrementally as this batch is actually consumed (see
        // consignmentService.consumeConsignmentStock). Collect one entry per
        // received line; written as ConsignmentStock rows after the loop.
        if (po.isConsignment) {
          consignmentEntries.push({
            companyId: po.companyId,
            supplierId: po.supplierId,
            purchaseOrderId: po._id,
            warehouseId,
            productId: item.productId,
            variantId: item.variantId,
            unitCost: effectiveUnitCost,
            qtyReceived: item.quantity,
            qtyOnHand: item.quantity,
          });
        }

        // The payable/AP posting and job-costing below still reflect what's
        // actually owed to the supplier (vendor unit price only) — landed
        // costs like freight are typically owed to a different party and
        // accounted for separately; only the inventory valuation above
        // absorbs them into per-unit cost.
        receivedTotal += item.quantity * item.unitCost;

        // 2. Update the PO line's received quantity and roll up PO status.
        line.quantityReceived += item.quantity;
      }

      const fullyReceived = po.items.every((l) => l.quantityReceived >= l.quantityOrdered);
      po.status = fullyReceived ? 'received' : 'partially_received';
      // The payable is owed as soon as goods are received (accrual basis),
      // unless this GRN was paid for immediately (paymentAccountId given),
      // in which case it's already settled and never becomes a due balance.
      // Consignment POs skip this entirely — no liability exists yet at
      // receipt time, so paidAmount/dueAmount stay untouched here; the
      // liability is created and cleared later, per ConsignmentStock row,
      // as the stock is actually consumed and settled.
      if (!po.isConsignment) {
        if (input.paymentAccountId) {
          po.paidAmount += receivedTotal;
        } else {
          po.dueAmount += receivedTotal;
        }
      }
      await po.save({ session });

      if (consignmentEntries.length) {
        await ConsignmentStock.create(consignmentEntries, { session });
      }

      // Job costing interlink: a PO tagged with a project gets a
      // ProjectCost for exactly what THIS GRN brought in — not the whole
      // PO — so partial receiving across several GRNs still costs the
      // project accurately as goods actually arrive, not on order. A PO
      // also tagged with a subcontractorId is costed as 'subcontractor'
      // instead of 'material' (so subcontractor spend reports separately —
      // see projectService.getProjectSubcontractorCosts), with retention
      // prorated to this GRN's share of the PO's subtotal so partial
      // receiving holds back the right amount each time rather than the
      // whole retention on the first GRN.
      if (po.projectId && receivedTotal > 0) {
        const isSubcontractor = !!po.subcontractorId;
        let retentionAmount = 0;
        if (isSubcontractor) {
          const shareOfPo = po.subtotal > 0 ? receivedTotal / po.subtotal : 0;
          retentionAmount = po.retentionAmount > 0
            ? Math.round(po.retentionAmount * shareOfPo * 100) / 100
            : Math.round(receivedTotal * (po.retentionPercent || 0) / 100 * 100) / 100;
        }
        await ProjectCost.create(
          [{
            companyId: po.companyId, projectId: po.projectId, type: isSubcontractor ? 'subcontractor' : 'material',
            amount: receivedTotal, referenceType: 'GoodsReceivedNote', referenceId: grn._id,
            date: new Date(), note: `GRN ${grn.grnNumber} against ${po.poNumber}`, userId,
            subcontractorId: po.subcontractorId || null,
            retentionPercent: isSubcontractor ? (po.retentionPercent || 0) : 0,
            retentionAmount,
          }],
          { session }
        );
      }

      // 3. Post the accounting voucher: Dr Inventory Asset, Cr Accounts Payable
      // (or Cr Cash/Bank instead of Payable if paid on receipt). Skipped
      // entirely for consignment POs — no liability exists yet, so nothing
      // is owed to post; consignmentService posts its own Dr COGS/Expense,
      // Cr Accounts Payable voucher as the stock is consumed instead.
      const inventoryAsset = await defaultAccountsService.resolve(po.companyId, 'inventoryAssetId', session);

      const creditAccount = paymentAccountId
        || payableAccountId
        || (await defaultAccountsService.resolve(po.companyId, 'accountsPayableId', session));

      if (!po.isConsignment && inventoryAsset && creditAccount && receivedTotal > 0) {
        await accountingService.postVoucher({
          companyId: po.companyId,
          branchId: po.branchId,
          type: 'journal',
          narration: `Goods received: ${grn.grnNumber}`,
          entries: [
            { accountId: inventoryAsset, debit: receivedTotal, credit: 0 },
            { accountId: creditAccount, debit: 0, credit: receivedTotal },
          ],
          referenceType: 'GoodsReceivedNote',
          referenceId: grn._id,
          userId,
        }, session);
      }
      // If either account is missing, inventory has still been updated correctly
      // above (source of truth) — set up an "Inventory Asset" and "Accounts
      // Payable" account per company to get the ledger posting too.
    });

    // Developer Platform outbound webhook — fire-and-forget, outside the
    // transaction (same rule as posSaleService's sale.created hook: an
    // external HTTP call must never hold a DB transaction open or affect
    // a GRN that already committed successfully).
    try {
      await require('./webhookSubscriptionService').triggerWebhook(String(grn.companyId), 'purchase_order.received', {
        grnId: grn._id, grnNumber: grn.grnNumber, purchaseOrderId: grn.purchaseOrderId, warehouseId: grn.warehouseId,
      });
    } catch (err) {
      console.error('Developer Platform webhook delivery for purchase_order.received failed (GRN itself still succeeded):', err.message);
    }

    return grn;
  } finally {
    session.endSession();
  }
}

/**
 * Records QC results for a GRN item. A failed item's stock (already added
 * at receiving time) is reversed with a 'qc_reject' movement — it never
 * counted toward the payable total change here since dueAmount is set at
 * receipt time on the full received quantity; a real deployment may want to
 * also credit-note the supplier for rejected quantity, which is a
 * SupplierPayment/voucher adjustment left to the caller for now.
 */
async function recordQC(grnId, itemId, { passed, note, userId }) {
  const session = await mongoose.startSession();
  try {
    let grn;
    await session.withTransaction(async () => {
      grn = await GoodsReceivedNote.findById(grnId).session(session);
      if (!grn) throw new Error('GRN not found.');

      const item = grn.items.id(itemId);
      if (!item) throw new Error('GRN item not found.');
      if (item.qcStatus !== 'pending') throw new Error(`QC already recorded as "${item.qcStatus}" for this item.`);

      item.qcStatus = passed ? 'passed' : 'failed';
      item.qcNote = note || null;
      await grn.save({ session });

      if (!passed) {
        await inventoryService.recordMovement({
          companyId: grn.companyId, warehouseId: grn.warehouseId,
          productId: item.productId, variantId: item.variantId, batchId: item.batchId,
          type: 'qc_reject', quantity: -item.quantity,
          referenceType: 'GoodsReceivedNote', referenceId: grn._id, userId,
          note: `QC failed: ${note || 'no reason given'}`,
        }, session);

        // The quantity is gone from stock — a serial-tracked unit that
        // failed QC can't stay marked 'in_stock' or it'll still show up as
        // sellable. Mark it 'damaged' instead of deleting the record, so
        // "this serial existed and was rejected" stays in the trail.
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          await ProductSerial.updateMany(
            { variantId: item.variantId, serialNumber: { $in: item.serialNumbers } },
            { status: 'damaged' },
            { session }
          );
        }
      }

      await auditService.record({
        companyId: grn.companyId, userId, action: passed ? 'grn_item.qc_passed' : 'grn_item.qc_failed',
        entityType: 'GoodsReceivedNote', entityId: grn._id, metadata: { itemId, quantity: item.quantity },
      }, session);
    });
    return grn;
  } finally {
    session.endSession();
  }
}

module.exports = {
  createPurchaseOrder, decidePurchaseOrder, receiveGoods, recordQC,
  computeLandedCostAllocation, addLandedCost, updateLandedCost, removeLandedCost,
};
