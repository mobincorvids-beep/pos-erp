const { Schema, model } = require('mongoose');

// A salon service (haircut, coloring, massage) — deliberately its own
// collection, not a core Product, because it carries a staff commission
// rate that has no meaning for a physical product. It's still billed
// through the same POS checkout as everything else (see salonService.js
// billServiceWithCommission), linked to a core Product/variant that
// represents it in the Sale line item.
const salonServiceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // the sellable line-item this service bills as
  variantId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  category: String, // "Hair", "Nails", "Spa"...
  durationMinutes: { type: Number, default: 30 },
  price: { type: Number, required: true },
  commissionType: { type: String, default: 'percentage', enum: ['percentage', 'fixed'] },
  commissionRate: { type: Number, default: 0 }, // percentage (0-100) or fixed amount, per commissionType
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('SalonService', salonServiceSchema);
