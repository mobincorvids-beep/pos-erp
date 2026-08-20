const { Schema, model } = require('mongoose');

const bandSchema = new Schema({
  minFatPercent: { type: Number, required: true }, // this band applies at-and-above this measured fat %
  pricePerLitre: { type: Number, required: true },
}, { _id: false });

// The genuinely new pricing mechanic: price determined by a MEASURED
// PHYSICAL QUALITY ATTRIBUTE at intake time (fat content), not by
// quantity purchased (Distribution), elapsed time (Fashion), or an
// external rate (Jewelry). Two farmers delivering the identical 100
// litres get paid different amounts if their milk tests differently —
// the price itself is a function of a lab measurement taken at the
// moment of collection, same "highest band met" shape every threshold
// check in this app uses, applied to a quality reading instead of a number
// anyone chose.
const qualityGradeScheduleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  bands: {
    type: [bandSchema],
    validate: {
      validator(bands) {
        for (let i = 1; i < bands.length; i++) if (bands[i].minFatPercent <= bands[i - 1].minFatPercent) return false;
        return true;
      },
      message: 'Bands must have strictly increasing minFatPercent values.',
    },
  },
}, { timestamps: true });

module.exports = model('QualityGradeSchedule', qualityGradeScheduleSchema);
