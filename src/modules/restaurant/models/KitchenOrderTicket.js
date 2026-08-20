const { Schema, model } = require('mongoose');

const kotItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  modifiers: [{ type: String }], // "No onions", "Extra spicy"
  status: { type: String, default: 'pending' }, // pending, preparing, ready, served
}, { _id: false });

// KOT references a Sale once billed, but is created at order time —
// before the sale/invoice exists — which is why it's its own document.
const kotSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  tableId: { type: Schema.Types.ObjectId, ref: 'RestaurantTable' },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // linked once billed
  items: [kotItemSchema],
  status: { type: String, default: 'open' }, // open, sent_to_kitchen, closed
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // waiter
}, { timestamps: true });

module.exports = model('KitchenOrderTicket', kotSchema);
