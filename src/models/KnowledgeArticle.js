const { Schema, model } = require('mongoose');

// A real internal Knowledge Base / SOP repository — staff documentation
// ("how to process a return", "how to close the till") that doubles as
// Helpdesk ticket deflection: knowledgeBaseService.suggestForTicket()
// searches these articles by keyword overlap with a ticket's subject so
// an agent (or eventually a customer) sees relevant SOPs before a ticket
// is even worked. Body is stored as a plain markdown/text string, the
// same "no HTML sanitization needed since not raw HTML" convention
// Funnel.bodyContent already established, rather than inventing a new
// rich-text representation for this app.
const knowledgeArticleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title: { type: String, required: true, trim: true },
  // URL-friendly, unique PER COMPANY (unlike Funnel's globally-unique
  // slug, which backs a public no-company-in-the-URL page — this one is
  // always accessed within an authenticated, company-scoped context).
  slug: { type: String, required: true, trim: true, lowercase: true },
  body: { type: String, required: true }, // markdown / plain text, rendered as-is — see Funnel.bodyContent precedent
  category: { type: String, default: null, trim: true },
  // Free-text tags, same convention as Customer.tags (used for both
  // browsing/filtering and as one of the signals the ticket-suggestion
  // search matches against).
  tags: [{ type: String, trim: true }],
  status: { type: String, default: 'draft', enum: ['draft', 'published'] },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  viewCount: { type: Number, default: 0 },
  helpfulCount: { type: Number, default: 0 },
  notHelpfulCount: { type: Number, default: 0 },
  // Optional pin to a specific module/entity (e.g. "how to process a
  // return" pinned to a Sales record) — both null for a general article.
  linkedEntityType: { type: String, default: null },
  linkedEntityId: { type: Schema.Types.ObjectId, default: null },
}, { timestamps: true });

knowledgeArticleSchema.index({ companyId: 1, slug: 1 }, { unique: true });
knowledgeArticleSchema.index({ companyId: 1, status: 1 });
knowledgeArticleSchema.index({ companyId: 1, tags: 1 });

module.exports = model('KnowledgeArticle', knowledgeArticleSchema);
