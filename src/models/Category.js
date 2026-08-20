const { Schema, model } = require('mongoose');

const categorySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  name: { type: String, required: true },
}, { timestamps: true });

module.exports = model('Category', categorySchema);
