const { Schema, model } = require('mongoose');

// One currency pair's rate on one date. `source` matters a lot here, not
// just for audit trail: 'frankfurter' rates were fetched live from a real
// free API (api.frankfurter.dev, ECB reference rates, no key required);
// 'manual' rates were entered by a person, and are the ONLY option for
// any currency Frankfurter doesn't cover — which includes PKR, this
// platform's own default currency, confirmed absent from Frankfurter's
// supported list via their own GitHub issue tracker before this was ever
// built, not assumed. A Pakistani company converting PKR to/from anything
// will always need manual rates; a company also dealing in USD/EUR/GBP
// alongside PKR gets real live rates for THOSE pairs.
const exchangeRateSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  fromCurrency: { type: String, required: true, uppercase: true },
  toCurrency: { type: String, required: true, uppercase: true },
  rate: { type: Number, required: true }, // 1 unit of fromCurrency = `rate` units of toCurrency
  date: { type: String, required: true }, // "2026-08-20" — one rate per pair per day
  source: { type: String, required: true, enum: ['frankfurter', 'manual'] },
  enteredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // only set for manual rates
}, { timestamps: true });

exchangeRateSchema.index({ companyId: 1, fromCurrency: 1, toCurrency: 1, date: 1 }, { unique: true });

module.exports = model('ExchangeRate', exchangeRateSchema);
