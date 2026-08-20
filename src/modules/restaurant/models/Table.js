const { Schema, model } = require('mongoose');

// Restaurant-only concept — lives in the module, not the core, because
// "table" has no meaning for a pharmacy or a jewelry shop.
const tableSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  name: { type: String, required: true }, // "Table 4", "Patio 2"
  seats: { type: Number, default: 4 },
  status: { type: String, default: 'free' }, // free, occupied, reserved
}, { timestamps: true });

module.exports = model('RestaurantTable', tableSchema);
