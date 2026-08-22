const { Schema, model } = require('mongoose');

const shipmentItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true }, // the raw invoice price per unit, before any landed cost is added
  allocatedCost: { type: Number, default: 0 }, // this item's proportional SHARE of the shipment's total additional costs, computed at allocation time
  adjustedUnitCost: { type: Number, default: null }, // unitPrice + (allocatedCost / quantity) — the REAL cost basis this item is actually received into inventory at
}, { _id: true });

const additionalCostSchema = new Schema({
  type: { type: String, required: true }, // 'customs_duty', 'freight', 'insurance', 'other'
  amount: { type: Number, required: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
}, { _id: false });

// A shipment's items carry their raw invoice price, but the actual cost of
// getting them into the warehouse is higher — customs duty, freight,
// insurance all add real cost that has nothing to do with the supplier's
// invoice. The genuinely new mechanic this module exists for: those
// additional costs are allocated PROPORTIONALLY BY VALUE across every
// item in the shipment, and the resulting adjustedUnitCost — not the raw
// unitPrice — is what the item is actually received into inventory at,
// so COGS and margin reporting later reflect the true landed cost, not
// just what the supplier happened to invoice.
const importShipmentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  items: { type: [shipmentItemSchema], required: true },
  additionalCosts: [additionalCostSchema],
  status: { type: String, default: 'pending', enum: ['pending', 'received'] },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null }, // the voucher recording the additional costs themselves
}, { timestamps: true });

module.exports = model('ImportShipment', importShipmentSchema);
