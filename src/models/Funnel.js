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
  submitCount: { type: Number, default: 0 },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

// companyId already has its own index via `index: true` above (used by the
// staff-side "list my funnels" query); slug's `unique: true` gives it a
// separate unique index — no additional compound index needed.

module.exports = model('Funnel', funnelSchema);
