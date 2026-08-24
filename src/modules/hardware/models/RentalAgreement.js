const { Schema, model } = require('mongoose');

// Equipment out on loan — a THIRD inventory state this app has never
// needed before: not "in stock" (sellable, on the shelf) and not "sold"
// (gone for good), but temporarily out and expected back. Whether it
// actually comes back — and how much of the deposit is refunded — isn't
// decided by a date or a pre-agreed policy percentage (Banquet's
// cancellation forfeit); it's decided by the physical CONDITION assessed
// at return time. See toolRentalService.returnRental() for that branching.
const rentalAgreementSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  quantity: { type: Number, default: 1 },
  dailyRate: { type: Number, required: true },
  depositAmount: { type: Number, required: true },
  depositReceivedInAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
  depositLiabilityAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
  // The rental USAGE charge (days × dailyRate) is billed as a real service
  // line at return time — same "must be trackingMode 'service'" convention
  // every other module in this app follows (Hotel's room charge, Banquet's
  // venue rental, School's tuition...), not a special case for rentals.
  rentalBillingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  rentalBillingVariantId: { type: Schema.Types.ObjectId, required: true },
  checkOutDate: { type: Date, default: Date.now },
  expectedReturnDate: { type: Date, required: true },
  actualReturnDate: Date,
  status: { type: String, default: 'out', enum: ['out', 'returned', 'cancelled'] },
  condition: { type: String, default: null, enum: [null, 'good', 'minor_damage', 'lost_or_major_damage'] },
  rentalCharge: { type: Number, default: 0 },
  depositRefunded: { type: Number, default: 0 },
  depositForfeited: { type: Number, default: 0 },
  restocked: { type: Boolean, default: false },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
}, { timestamps: true });

module.exports = model('RentalAgreement', rentalAgreementSchema);
