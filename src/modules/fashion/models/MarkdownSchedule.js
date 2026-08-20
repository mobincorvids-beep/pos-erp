const { Schema, model } = require('mongoose');

const stageSchema = new Schema({
  daysSinceLaunch: { type: Number, required: true }, // this stage applies at-and-after this many elapsed days
  discountPercent: { type: Number, required: true },  // 0-100, off the product's base sellingPrice
}, { _id: false });

// Automatic time-decay pricing — the genuinely new axis this module
// exists for. Distribution's PriceTierSchedule makes price a function of
// QUANTITY PURCHASED; this makes it a function of TIME ELAPSED since
// launch, with no purchase involved at all — a product's price drops on
// its own the longer it sits unsold, exactly how real seasonal fashion
// retail actually prices clearance. Same "highest threshold met wins"
// shape as tiered pricing, different threshold entirely.
const markdownScheduleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  launchDate: { type: Date, required: true },
  stages: {
    type: [stageSchema],
    validate: {
      validator(stages) {
        for (let i = 1; i < stages.length; i++) {
          if (stages[i].daysSinceLaunch <= stages[i - 1].daysSinceLaunch) return false;
        }
        return true;
      },
      message: 'Stages must have strictly increasing daysSinceLaunch values.',
    },
  },
}, { timestamps: true });

markdownScheduleSchema.index({ variantId: 1 }, { unique: true });

module.exports = model('MarkdownSchedule', markdownScheduleSchema);
