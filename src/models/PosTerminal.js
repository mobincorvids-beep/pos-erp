const { Schema, model } = require('mongoose');

const posTerminalSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  name: { type: String, required: true },
  deviceIdentifier: String,
  lastInvoiceNumber: { type: Number, default: 0 }, // per-terminal sequential numbering
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('PosTerminal', posTerminalSchema);
