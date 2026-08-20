const { Schema, model } = require('mongoose');

const prescriptionItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  medicineName: { type: String, required: true }, // captured even if not in catalog yet
  dosage: String,     // "500mg"
  frequency: String,  // "twice daily"
  durationDays: Number,
  quantityPrescribed: Number,
}, { _id: false });

const prescriptionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor' },
  items: [prescriptionItemSchema],
  notes: String,
  status: { type: String, default: 'pending' }, // pending, partially_dispensed, dispensed
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // linked once billed
}, { timestamps: true });

module.exports = model('Prescription', prescriptionSchema);
