const { Schema, model } = require('mongoose');

const ratioSchema = new Schema({
  sizeLabel: { type: String, required: true }, // matches Product.variants[].attributeValues.get('Size')
  percent: { type: Number, required: true },
}, { _id: false });

// A reusable ordering template — "for this shoe style, order roughly
// 20% size 7, 35% size 8, 30% size 9, 15% size 10" — rather than a buyer
// working that split out by hand on every reorder. The genuinely new
// mechanic this module exists for: turning ONE target quantity into
// several INTEGER quantities across different variants of the same
// product that must sum to EXACTLY that target — a real apportionment
// problem, not a lookup or a threshold check.
const sizeCurveSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // "Standard Men's Curve"
  ratios: {
    type: [ratioSchema],
    validate: {
      validator(ratios) {
        const total = ratios.reduce((sum, r) => sum + r.percent, 0);
        return Math.abs(total - 100) < 0.01; // must sum to 100%, within floating-point tolerance
      },
      message: 'Ratio percentages must sum to exactly 100.',
    },
  },
}, { timestamps: true });

module.exports = model('SizeCurve', sizeCurveSchema);
