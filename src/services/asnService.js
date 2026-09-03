/**
 * AsnService — advance shipping notice create/list/get, plus a comparison
 * helper that matches an already-posted GoodsReceivedNote against an ASN to
 * flag over/under-receipt variances. Deliberately does NOT hook into
 * purchaseService.receiveGoods — an ASN stays optional/additive, GRN
 * receiving is completely unaffected whether or not one exists; this only
 * reads the two documents after the fact and reports a diff.
 */
const AdvanceShippingNotice = require('../models/AdvanceShippingNotice');
const GoodsReceivedNote = require('../models/GoodsReceivedNote');
const { nextDocumentNumber } = require('./numberingService');

async function createAsn({ companyId, supplierId, purchaseOrderId, expectedItems, expectedArrivalDate, userId }) {
  if (!supplierId) throw new Error('supplierId is required.');
  if (!Array.isArray(expectedItems) || expectedItems.length === 0) {
    throw new Error('At least one expected item is required.');
  }
  for (const item of expectedItems) {
    if (!item.productId) throw new Error('Each expected item requires a productId.');
    if (!item.expectedQuantity || item.expectedQuantity <= 0) {
      throw new Error('Each expected item requires an expectedQuantity greater than zero.');
    }
  }

  return AdvanceShippingNotice.create({
    companyId, supplierId, purchaseOrderId: purchaseOrderId || null,
    asnNumber: nextDocumentNumber('ASN'),
    expectedItems: expectedItems.map((i) => ({
      productId: i.productId, variantId: i.variantId || null, expectedQuantity: i.expectedQuantity,
    })),
    expectedArrivalDate: expectedArrivalDate || null,
    status: 'pending',
    userId: userId || null,
  });
}

async function listAsns(companyId, { supplierId, purchaseOrderId, status } = {}) {
  const filter = { companyId };
  if (supplierId) filter.supplierId = supplierId;
  if (purchaseOrderId) filter.purchaseOrderId = purchaseOrderId;
  if (status) filter.status = status;
  return AdvanceShippingNotice.find(filter).sort({ createdAt: -1 }).limit(200);
}

async function getAsn(id, companyId) {
  return AdvanceShippingNotice.findOne({ _id: id, companyId });
}

/**
 * Compares one GRN's received quantities (per product/variant, summed
 * across its lines) against an ASN's expected quantities. Returns one row
 * per product/variant that appears on either side, flagging 'over',
 * 'under', or 'match'. Does not mutate the GRN; updates the ASN's status
 * to 'received' (every expected line fully covered, no shortfall) or
 * 'partial' (some shortfall) so its own status reflects the latest match.
 */
async function matchGrnToAsn(asnId, grnId, companyId) {
  const [asn, grn] = await Promise.all([
    AdvanceShippingNotice.findOne({ _id: asnId, companyId }),
    GoodsReceivedNote.findOne({ _id: grnId, companyId }),
  ]);
  if (!asn) throw new Error('ASN not found.');
  if (!grn) throw new Error('GRN not found.');

  const key = (productId, variantId) => `${productId}::${variantId || ''}`;

  const receivedByKey = new Map();
  for (const item of grn.items) {
    const k = key(item.productId, item.variantId);
    receivedByKey.set(k, (receivedByKey.get(k) || 0) + item.quantity);
  }

  const expectedByKey = new Map();
  for (const item of asn.expectedItems) {
    const k = key(item.productId, item.variantId);
    expectedByKey.set(k, (expectedByKey.get(k) || 0) + item.expectedQuantity);
  }

  const allKeys = new Set([...expectedByKey.keys(), ...receivedByKey.keys()]);
  const variances = [...allKeys].map((k) => {
    const [productId, variantId] = k.split('::');
    const expectedQuantity = expectedByKey.get(k) || 0;
    const receivedQuantity = receivedByKey.get(k) || 0;
    const variance = receivedQuantity - expectedQuantity;
    return {
      productId, variantId: variantId || null,
      expectedQuantity, receivedQuantity, variance,
      status: variance > 0 ? 'over' : variance < 0 ? 'under' : 'match',
    };
  });

  const anyShortfall = variances.some((v) => v.status === 'under');
  asn.status = anyShortfall ? 'partial' : 'received';
  await asn.save();

  return { asnId: String(asn._id), grnId: String(grn._id), variances, asnStatus: asn.status };
}

module.exports = { createAsn, listAsns, getAsn, matchGrnToAsn };
