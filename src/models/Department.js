const { Schema, model } = require('mongoose');

const departmentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  name: { type: String, required: true }, // Sales, Kitchen, Warehouse, Finance...
  headUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = model('Department', departmentSchema);
