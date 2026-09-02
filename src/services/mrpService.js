/**
 * MrpService — Material Requirements Planning. runMrp() takes a demand list
 * (manually entered target quantities and/or products auto-pulled because
 * they're at/below reorderLevel), recursively explodes each product's BOM
 * (a component can itself be a finished product with its own active BOM —
 * multi-level BOM support), nets the exploded gross requirement against
 * current on-hand stock (StockLevel, summed across batches in the target
 * warehouse), and produces two suggestion lists:
 *   - suggestedPurchases: raw materials / components with no BOM of their
 *     own that are short after netting — buy these.
 *   - suggestedWorkOrders: sub-assemblies (components that DO have their own
 *     active BOM) that are short after netting — build these.
 * The run is persisted (MrpRun) so a planner can review before converting a
 * line into a real PurchaseOrder or WorkOrder.
 */
const Product = require('../models/Product');
const BillOfMaterials = require('../models/BillOfMaterials');
const StockLevel = require('../models/StockLevel');
const MrpRun = require('../models/MrpRun');
const purchaseService = require('./purchaseService');
const manufacturingService = require('./manufacturingService');
const reorderRuleService = require('./reorderRuleService');

const MAX_BOM_DEPTH = 10; // guards against a circular BOM (product A's BOM containing product A, directly or indirectly)

async function getOnHandQuantity(warehouseId, variantId) {
  const rows = await StockLevel.find({ warehouseId, variantId });
  return rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
}

/**
 * Recursively walks demand for a single (productId, variantId, quantity)
 * down through BOM levels, accumulating gross requirements into `requirements`
 * keyed by "productId:variantId" — { productId, variantId, quantity, bomId|null }.
 * A component with an active BOM is a sub-assembly: its own requirement is
 * still recorded (so it nets to a suggested work order), AND its own BOM is
 * exploded further to get raw-material requirements. A component with no BOM
 * is a raw material / purchased part: recorded, not exploded further.
 */
async function explode(companyId, productId, variantId, quantity, requirements, depth = 0) {
  if (depth > MAX_BOM_DEPTH) {
    throw new Error('BOM explosion exceeded maximum depth — check for a circular BOM.');
  }

  const key = `${productId}:${variantId}`;
  const bom = await BillOfMaterials.findOne({ companyId, finishedProductId: productId, finishedVariantId: variantId, isActive: true });

  const existing = requirements.get(key);
  requirements.set(key, {
    productId, variantId,
    quantity: (existing?.quantity || 0) + quantity,
    bomId: bom ? bom._id : (existing?.bomId ?? null),
  });

  if (!bom) return; // raw material / purchased part — nothing further to explode

  for (const component of bom.components) {
    await explode(companyId, component.productId, component.variantId, component.quantityPerUnit * quantity, requirements, depth + 1);
  }
}

async function runMrp({ companyId, branchId, warehouseId, demand, includeReorderLevel, userId }) {
  if (!warehouseId) throw new Error('warehouseId is required.');

  const demandLines = [...(demand || [])].map((d) => ({ ...d, source: 'manual' }));

  if (includeReorderLevel) {
    // A ReorderRule specific to THIS warehouse wins over Product.reorderLevel
    // (the global, one-per-product default) — see reorderRuleService for
    // why. Still only scans products that have a global default set OR a
    // rule at this warehouse, so a product with neither continues to be
    // silently skipped exactly as before this feature existed.
    const candidateProducts = await Product.find({ companyId, isActive: true }).select('name reorderLevel variants');
    const rules = await require('../models/ReorderRule').find({ companyId, warehouseId, isActive: true });
    const ruleByProduct = new Map(rules.map((r) => [String(r.productId), r]));

    for (const product of candidateProducts) {
      const rule = ruleByProduct.get(String(product._id));
      const reorderPoint = rule ? rule.minQty : (product.reorderLevel || 0);
      const targetLevel = rule ? (rule.maxQty ?? rule.minQty * 2) : product.reorderLevel;
      if (!reorderPoint || reorderPoint <= 0) continue; // no threshold configured either way — nothing to check

      for (const variant of product.variants || []) {
        const onHand = await getOnHandQuantity(warehouseId, variant._id);
        if (onHand <= reorderPoint) {
          // Bring stock back up to the target level (rule's maxQty, or 2x
          // the reorder point when only a bare minQty/reorderLevel is set —
          // simple, explicit reorder-point policy, not EOQ).
          const targetQty = targetLevel - onHand;
          if (targetQty > 0) {
            demandLines.push({ productId: product._id, variantId: variant._id, quantity: targetQty, source: 'reorder_level' });
          }
        }
      }
    }
  }

  if (demandLines.length === 0) throw new Error('No demand to plan — provide manual target quantities or enable reorder-level demand.');

  // requirements: Map of "productId:variantId" -> { productId, variantId, quantity (gross requirement), bomId }
  const requirements = new Map();
  for (const line of demandLines) {
    await explode(companyId, line.productId, line.variantId, line.quantity, requirements);
  }

  const suggestedPurchases = [];
  const suggestedWorkOrders = [];

  for (const req of requirements.values()) {
    const onHand = await getOnHandQuantity(warehouseId, req.variantId);
    const shortfall = req.quantity - onHand;
    if (shortfall <= 0) continue; // fully covered by on-hand stock

    if (req.bomId) {
      // Sub-assembly with its own BOM — suggest building it, not buying it.
      suggestedWorkOrders.push({
        productId: req.productId, variantId: req.variantId, bomId: req.bomId,
        requiredQuantity: shortfall, status: 'suggested', workOrderId: null,
      });
    } else {
      const product = await Product.findById(req.productId);
      const variant = product?.variants?.id(req.variantId);
      const estimatedUnitCost = variant?.costPrice ?? product?.costPrice ?? 0;
      suggestedPurchases.push({
        productId: req.productId, variantId: req.variantId,
        requiredQuantity: req.quantity, onHandQuantity: onHand, shortfallQuantity: shortfall,
        estimatedUnitCost, status: 'suggested', purchaseOrderId: null,
      });
    }
  }

  return MrpRun.create({
    companyId, branchId, warehouseId, demand: demandLines,
    suggestedPurchases, suggestedWorkOrders, status: 'computed', userId,
  });
}

async function getMrpRun(companyId, id) {
  const run = await MrpRun.findOne({ _id: id, companyId });
  if (!run) throw new Error('MRP run not found.');
  return run;
}

/** Converts one suggested-purchase line into a draft PurchaseOrder (single-item PO). */
async function convertPurchaseLine(companyId, mrpRunId, lineId, { supplierId, branchId, warehouseId, unitCost, userId }) {
  if (!supplierId) throw new Error('supplierId is required to raise a purchase order.');
  const run = await getMrpRun(companyId, mrpRunId);
  const line = run.suggestedPurchases.id(lineId);
  if (!line) throw new Error('Suggested purchase line not found.');
  if (line.status === 'converted') throw new Error('This line has already been converted.');

  const po = await purchaseService.createPurchaseOrder({
    companyId, branchId: branchId || run.branchId, warehouseId: warehouseId || run.warehouseId,
    supplierId,
    items: [{
      productId: line.productId, variantId: line.variantId,
      quantityOrdered: line.shortfallQuantity, unitCost: unitCost ?? line.estimatedUnitCost,
    }],
    userId,
  });

  line.status = 'converted';
  line.purchaseOrderId = po._id;
  await run.save();
  return { run, purchaseOrder: po };
}

/** Converts one suggested-work-order line into a draft WorkOrder. */
async function convertWorkOrderLine(companyId, mrpRunId, lineId, { branchId, warehouseId, userId }) {
  const run = await getMrpRun(companyId, mrpRunId);
  const line = run.suggestedWorkOrders.id(lineId);
  if (!line) throw new Error('Suggested work order line not found.');
  if (line.status === 'converted') throw new Error('This line has already been converted.');

  const workOrder = await manufacturingService.createWorkOrder({
    companyId, branchId: branchId || run.branchId, warehouseId: warehouseId || run.warehouseId,
    bomId: line.bomId, quantityToProduce: line.requiredQuantity, userId,
  });
  workOrder.mrpRunId = run._id;
  await workOrder.save();

  line.status = 'converted';
  line.workOrderId = workOrder._id;
  await run.save();
  return { run, workOrder };
}

module.exports = { runMrp, getMrpRun, convertPurchaseLine, convertWorkOrderLine };
