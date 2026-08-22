const { Schema, model } = require('mongoose');

// A restricted or unrestricted fund — the genuinely new mechanic this
// module exists for. Every other "sufficient funds" check in this app
// (assertSufficientStock, cash-account balances) checks a REAL resource —
// actual stock on a shelf, an actual bank balance. This checks a
// SUB-LEDGER balance instead: an organization's bank account might
// genuinely hold 100,000, but if 80,000 of that is donor-restricted to
// "Education Program" and only 5,000 sits in the unrestricted General
// Fund, a 10,000 general-operations disbursement must be REJECTED even
// though the real cash is sitting right there — the money exists, but
// it's not available for that purpose. `balance` here is maintained as a
// running total across every donation and disbursement, and never
// allowed to go negative.
const fundSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // "General Fund", "Education Program (Restricted)"
  type: { type: String, required: true, enum: ['restricted', 'unrestricted'] },
  purposeDescription: String, // for restricted funds — what the money can actually be spent on
  balance: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Fund', fundSchema);
