const { Schema, model } = require('mongoose');

// Core (not industry-specific) — Salon/Gym/Clinic modules reference this
// directly rather than each inventing their own booking calendar. An
// industry module can still attach extra fields via serviceMeta if needed.
const appointmentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  staffUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // who's booked (stylist, doctor, trainer...)
  serviceName: { type: String, required: true }, // "Haircut", "Dental Checkup", "PT Session"
  productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null }, // optional link if the service is also a sellable product/package

  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },

  status: { type: String, default: 'scheduled', enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] },
  notes: String,

  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // linked once billed
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // who booked it (front desk)
}, { timestamps: true });

appointmentSchema.index({ staffUserId: 1, startTime: 1, endTime: 1 });

module.exports = model('Appointment', appointmentSchema);
