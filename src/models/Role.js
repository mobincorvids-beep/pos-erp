const { Schema, model } = require('mongoose');

const roleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // Admin, Cashier, Manager, Waiter, Pharmacist...
  permissions: [{ type: String }], // ['pos.sell', 'inventory.adjust', 'accounting.view', ...]
}, { timestamps: true });

module.exports = model('Role', roleSchema);
