const { Schema, model } = require('mongoose');

// A simple lead-capture landing page — headline + body text + a
// configurable short form. Deliberately NOT a drag-and-drop page builder;
// there is no block/section model, just plain text content and a form
// schema. Good enough to run a "sign up for our offer" style page.
const formFieldSchema = new Schema({
  key: { type: String, required: true, trim: true }, // used as the key in FunnelSubmission.data
  label: { type: String, required: true, trim: true },
  type: { type: String, enum: ['text', 'email', 'phone', 'textarea'], default: 'text' },
  required: { type: Boolean, default: false },
}, { _id: false });

// Config for a page whose ctaAction is 'book_appointment' — reuses the
// existing Appointment booking engine (src/services/appointmentService.js)
// directly rather than a new slot-generation model. durationMinutes drives
// the candidate slot grid the public page offers (see
// funnelService.availableAppointmentSlots).
const appointmentConfigSchema = new Schema({
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  staffUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  serviceName: { type: String, default: '' },
  durationMinutes: { type: Number, default: 30 },
}, { _id: false });

// One step of a multi-step funnel ("quiz -> offer -> checkout"). A funnel
// with an empty `pages` array is a legacy single-page funnel — the
// top-level headline/bodyContent/ctaText below still act as an implicit
// fallback page (see funnelService.effectivePages), so existing funnels
// keep working with no migration needed.
const funnelPageSchema = new Schema({
  order: { type: Number, required: true },
  headline: { type: String, default: '' },
  bodyContent: { type: String, default: '' },
  ctaText: { type: String, default: 'Continue' },
  // next_step: advance to the next page client-side, no submission.
  // submit_form: render the funnel's formFields and post a FunnelSubmission.
  // external_url: CTA is a plain link out to externalUrl.
  // book_appointment: render a slot-picker for appointmentConfig's service.
  ctaAction: { type: String, enum: ['next_step', 'submit_form', 'external_url', 'book_appointment'], default: 'next_step' },
  externalUrl: { type: String, default: '' },
  appointmentConfig: { type: appointmentConfigSchema, default: undefined },
}, { _id: false });

const funnelSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true }, // internal name, shown to staff only
  // URL-friendly, GLOBALLY unique (not just per company) — the public
  // landing page lives at /f/:slug with no company identifier in the URL,
  // so two tenants can't share a slug. Enforced by the unique index below.
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  headline: { type: String, default: '' },
  bodyContent: { type: String, default: '' }, // plain text / simple markdown, rendered as-is (no HTML sanitization needed since not raw HTML)
  formFields: { type: [formFieldSchema], default: () => ([{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }]) },
  // Ordered multi-step pages. Empty for a legacy/simple single-page funnel
  // — see funnelPageSchema's comment and funnelService.effectivePages.
  pages: { type: [funnelPageSchema], default: () => ([]) },
  submitCount: { type: Number, default: 0 },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

// companyId already has its own index via `index: true` above (used by the
// staff-side "list my funnels" query); slug's `unique: true` gives it a
// separate unique index — no additional compound index needed.

module.exports = model('Funnel', funnelSchema);
