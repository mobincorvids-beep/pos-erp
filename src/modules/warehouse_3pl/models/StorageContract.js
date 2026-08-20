const { Schema, model } = require('mongoose');

// A client's goods held in the warehouse under contract — the genuinely
// new mechanic: billing is DURATION × QUANTITY HELD, not a flat per-day
// rate for a whole asset (Hardware's rented tool) or a one-time sale.
// Every day (or partial day) the goods sit in storage accrues a real
// charge, computed only at billing time by walking storageQuantity
// changes across time, not tracked as a running total anyone updates by hand.
const storageQuantityChangeSchema = new Schema({
  quantity: { type: Number, required: true }, // positive = goods received into storage, negative = goods released out
  at: { type: Date, default: Date.now },
}, { _id: false });

const storageContractSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  clientCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true }, // the 3PL client whose goods these are
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  ratePerUnitPerDay: { type: Number, required: true },
  changes: [storageQuantityChangeSchema], // append-only ledger of quantity IN/OUT over time — the actual source of truth for what was held, and for how long
  billingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // trackingMode 'service'
  billingVariantId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, default: 'active', enum: ['active', 'closed'] },
}, { timestamps: true });

module.exports = model('StorageContract', storageContractSchema);
