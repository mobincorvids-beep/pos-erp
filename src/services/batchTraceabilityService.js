/**
 * BatchTraceabilityService — bidirectional batch genealogy, built purely
 * from existing StockMovement and WorkOrder batch references (no new
 * tracking model). Forward-only tracing (input batch -> the work order
 * that consumed it, and what it produced) already existed implicitly via
 * WorkOrder.consumedBatches; this adds the other direction and walks both
 * as a graph instead of a single hop.
 *
 * LIMITATION (documented): manufacturingService.completeProduction()'s
 * 'production_output' StockMovement does not currently carry a batchId —
 * finished-goods output isn't batch-tracked in this data model today, only
 * raw-material consumption is (see WorkOrder.consumedBatches). So walking
 * "forward" from an input batch reaches the WorkOrder(s) that consumed it
 * and what they produced (product/variant/quantity/when), but cannot
 * chain further into a batch id for that output unless/until output
 * batching is added. The "producedFrom" (backward) direction is written
 * generically against StockMovement(type: 'production_output', batchId)
 * so it will pick up real data the moment output batching exists, without
 * needing to change this function again.
 */
const ProductBatch = require('../models/ProductBatch');
const StockMovement = require('../models/StockMovement');
const WorkOrder = require('../models/WorkOrder');

async function describeBatch(batchId) {
  const batch = await ProductBatch.findById(batchId).lean();
  if (!batch) return null;
  return {
    batchId: batch._id,
    batchNumber: batch.batchNumber,
    productId: batch.productId,
    variantId: batch.variantId,
    receivedDate: batch.receivedDate || batch.createdAt,
  };
}

/** Work orders that consumed this exact batch as a raw material input. */
async function findConsumingWorkOrders(companyId, batchId) {
  return WorkOrder.find({ companyId, 'consumedBatches.batchId': batchId }).lean();
}

/** Work order (if any) whose production_output movement carries this batchId — see LIMITATION above; currently always empty in this codebase, kept generic for forward-compat. */
async function findProducingWorkOrder(companyId, batchId) {
  const movement = await StockMovement.findOne({
    companyId, batchId, type: 'production_output', referenceType: 'WorkOrder',
  }).lean();
  if (!movement) return null;
  return WorkOrder.findById(movement.referenceId).lean();
}

/**
 * Bidirectional genealogy for a batch: nodes = batches + work orders,
 * edges = "consumed into" / "produced from". Recurses a bounded number of
 * hops (guards against any accidental cycle in real data) in each
 * direction, since manufacturing chains are rarely more than a handful of
 * stages deep.
 */
async function getBatchGenealogy(companyId, batchId, { maxDepth = 10 } = {}) {
  const root = await describeBatch(batchId);
  if (!root) throw new Error('Batch not found.');

  const nodes = new Map(); // key `batch:<id>` or `wo:<id>` -> node
  const edges = [];
  const visitedBatches = new Set();

  nodes.set(`batch:${root.batchId}`, { type: 'batch', ...root });

  async function walkForward(currentBatchId, depth) {
    if (depth > maxDepth || visitedBatches.has(String(currentBatchId))) return;
    visitedBatches.add(String(currentBatchId));

    const workOrders = await findConsumingWorkOrders(companyId, currentBatchId);
    for (const wo of workOrders) {
      const woKey = `wo:${wo._id}`;
      if (!nodes.has(woKey)) {
        nodes.set(woKey, {
          type: 'workOrder', workOrderId: wo._id, workOrderNumber: wo.workOrderNumber,
          status: wo.status, quantityProduced: wo.quantityProduced, completedAt: wo.completedAt || null,
        });
      }
      edges.push({ from: `batch:${currentBatchId}`, to: woKey, relation: 'consumed_into' });

      // Forward-continue only if the output itself turns out to carry a
      // batchId (see module LIMITATION) — otherwise there's nothing
      // further to chain into as a batch node.
      const outputMovement = await StockMovement.findOne({
        companyId, referenceType: 'WorkOrder', referenceId: wo._id, type: 'production_output', batchId: { $ne: null },
      }).lean();
      if (outputMovement) {
        const outputBatch = await describeBatch(outputMovement.batchId);
        if (outputBatch) {
          const outKey = `batch:${outputBatch.batchId}`;
          if (!nodes.has(outKey)) nodes.set(outKey, { type: 'batch', ...outputBatch });
          edges.push({ from: woKey, to: outKey, relation: 'produced' });
          await walkForward(outputBatch.batchId, depth + 1);
        }
      }
    }
  }

  async function walkBackward(currentBatchId, depth) {
    if (depth > maxDepth) return;
    const producingWO = await findProducingWorkOrder(companyId, currentBatchId);
    if (!producingWO) return;

    const woKey = `wo:${producingWO._id}`;
    if (!nodes.has(woKey)) {
      nodes.set(woKey, {
        type: 'workOrder', workOrderId: producingWO._id, workOrderNumber: producingWO.workOrderNumber,
        status: producingWO.status, quantityProduced: producingWO.quantityProduced, completedAt: producingWO.completedAt || null,
      });
    }
    edges.push({ from: woKey, to: `batch:${currentBatchId}`, relation: 'produced' });

    for (const consumed of producingWO.consumedBatches || []) {
      const inputBatch = await describeBatch(consumed.batchId);
      if (!inputBatch) continue;
      const inKey = `batch:${inputBatch.batchId}`;
      if (!nodes.has(inKey)) nodes.set(inKey, { type: 'batch', ...inputBatch });
      edges.push({ from: inKey, to: woKey, relation: 'consumed_into' });
      await walkBackward(inputBatch.batchId, depth + 1);
    }
  }

  await walkForward(root.batchId, 0);
  await walkBackward(root.batchId, 0);

  return {
    rootBatchId: root.batchId,
    nodes: [...nodes.values()],
    edges,
  };
}

module.exports = { getBatchGenealogy };
