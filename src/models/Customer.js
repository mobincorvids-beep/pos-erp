const { Schema, model } = require('mongoose');

const customerSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  priceGroupId: { type: Schema.Types.ObjectId, ref: 'PriceGroup' },
  // Which PriceList (customer-group / quantity-slab pricing) this customer
  // resolves prices from at checkout — see priceListService.resolvePrice.
  // Kept separate from priceGroupId above (an older, otherwise-unused
  // segmentation field): a PriceList itself can target a PriceGroup, but a
  // customer is assigned a PriceList directly so a distributor can put a
  // single customer on a specific price book without needing a whole group.
  priceListId: { type: Schema.Types.ObjectId, ref: 'PriceList', default: null },
  name: { type: String, required: true },
  phone: String,
  email: String,
  address: String,
  creditLimit: { type: Number, default: 0 },
  openingBalance: { type: Number, default: 0 }, // +ve = customer owes company
  loyaltyPoints: { type: Number, default: 0 },
  // Field sales / van-sales assignment — which rep covers this shop and on
  // which route, so a rep's daily coverage can be planned and tracked (see
  // routeSalesService / CustomerVisit / MyRoutePage).
  salesRepId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
  route: { type: String, default: null }, // e.g. "Route 3 - Gulshan"
  // Free-text segmentation — "VIP", "Wholesale", "Birthday-March" etc. Kept
  // simple (tags, not a rules engine) since campaign/report targeting just
  // needs to filter by these; a full segment-builder is a UI concern, not
  // a schema one.
  tags: [{ type: String }],

  // Used only by stockAllocationService when several pending orders compete
  // for the same limited on-hand stock — higher goes first. Defaults to 0
  // (no special priority) so every existing customer is unaffected until a
  // business deliberately marks a key account higher.
  allocationPriority: { type: Number, default: 0 },
}, { timestamps: true });

customerSchema.index({ companyId: 1, tags: 1 });
customerSchema.index({ companyId: 1, salesRepId: 1 });

module.exports = model('Customer', customerSchema);
