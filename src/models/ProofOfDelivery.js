const { Schema, model } = require('mongoose');

// Inline base64 signature/photo capture — same "no cloud storage" pattern
// VehicleIncident.attachments and Driver.otherDocuments[].attachment
// already use, capped the same way.
const POD_IMAGE_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, pre-base64

// One proof-of-delivery capture against a CoreShipment (src/models/CoreShipment.js
// — the generic cross-industry "a sale needs to physically get to a
// customer" record; CoreShipment already carries a coarse podNote/deliveredAt
// pair, this is the real structured capture that backs those: signature/
// photo, who actually received it, and where). Kept as its own collection
// rather than embedded on CoreShipment so a shipment can be re-delivered/
// re-attempted with a fresh POD without losing the earlier attempt's record
// (append-only, same audit-trail reasoning as ShipmentEvent.js).
const proofOfDeliverySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  shipmentId: { type: Schema.Types.ObjectId, ref: 'CoreShipment', required: true, index: true },

  recipientName: { type: String, required: true },
  deliveredAt: { type: Date, default: Date.now },

  // Exactly one of these is typically provided (a signature pad capture OR
  // a photo of the delivered goods/receiving person) but neither is
  // required to be exclusive — a driver app might reasonably capture both.
  signatureImageBase64: { type: String, default: null, maxlength: 1_500_000 }, // data-URI, e.g. "data:image/png;base64,...."
  photoBase64: { type: String, default: null, maxlength: 1_500_000 },

  gpsLat: { type: Number, default: null },
  gpsLng: { type: Number, default: null },

  notes: { type: String, default: '' },
  capturedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // driver/user who captured it, when known
}, { timestamps: true });

proofOfDeliverySchema.index({ companyId: 1, shipmentId: 1, createdAt: -1 });

module.exports = model('ProofOfDelivery', proofOfDeliverySchema);
module.exports.POD_IMAGE_MAX_FILE_BYTES = POD_IMAGE_MAX_FILE_BYTES;
