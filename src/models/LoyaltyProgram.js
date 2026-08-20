const { Schema, model } = require('mongoose');

// One program per company for now (multiple tiered programs would extend
// this with a tier/qualifying-spend concept — out of scope here).
const loyaltyProgramSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
  isActive: { type: Boolean, default: true },
  earnRate: { type: Number, default: 100 },     // customer earns 1 point per this much spent (net of discount, before tax)
  redemptionValue: { type: Number, default: 1 }, // 1 point = this much currency when redeemed
  minRedeemPoints: { type: Number, default: 0 }, // floor before a customer can redeem anything
}, { timestamps: true });

module.exports = model('LoyaltyProgram', loyaltyProgramSchema);
