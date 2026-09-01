/**
 * FunnelService — simple lead-capture landing pages ("Funnels"). This is
 * CRM-adjacent, not a separate silo: a submission on a published funnel's
 * public form becomes a real CRM Lead by calling straight into
 * crmPipelineService.createLead({ companyId, name, contactName, phone,
 * email, source, assignedToUserId, notes }) — the exact function
 * src/controllers/crmPipelineController.js#createLead uses for the
 * authenticated "Leads" tab. No parallel Lead-like model is introduced
 * here; FunnelSubmission just links forward to the real Lead it produced
 * (leadId/convertedAt), the same way Lead.convertedCustomerId links
 * forward to the Customer it became.
 */
const Funnel = require('../models/Funnel');
const FunnelSubmission = require('../models/FunnelSubmission');
const crmPipelineService = require('./crmPipelineService');

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'funnel';
}

// --- CRUD -------------------------------------------------------------

async function createFunnel(input) {
  const { companyId, name, headline, bodyContent, formFields, slug } = input;
  if (!companyId) throw new Error('companyId is required.');
  if (!name) throw new Error('Funnel name is required.');

  const finalSlug = slugify(slug || name);
  // Slug is GLOBALLY unique (the public URL /f/:slug has no companyId in
  // it), not just per-company — checked across all tenants here.
  const existing = await Funnel.findOne({ slug: finalSlug });
  if (existing) throw new Error(`A funnel with slug "${finalSlug}" already exists. Try a more specific slug.`);

  return Funnel.create({
    companyId, name, slug: finalSlug,
    headline: headline || '', bodyContent: bodyContent || '',
    formFields: formFields && formFields.length ? formFields : undefined,
  });
}

async function updateFunnel(funnelId, companyId, updates) {
  const funnel = await Funnel.findOne({ _id: funnelId, companyId });
  if (!funnel) throw new Error('Funnel not found.');

  const { name, headline, bodyContent, formFields, slug } = updates;
  if (slug && slugify(slug) !== funnel.slug) {
    const newSlug = slugify(slug);
    // Global check again, matching createFunnel — see comment there.
    const clash = await Funnel.findOne({ slug: newSlug, _id: { $ne: funnel._id } });
    if (clash) throw new Error(`A funnel with slug "${newSlug}" already exists. Try a more specific slug.`);
    funnel.slug = newSlug;
  }
  if (name !== undefined) funnel.name = name;
  if (headline !== undefined) funnel.headline = headline;
  if (bodyContent !== undefined) funnel.bodyContent = bodyContent;
  if (formFields !== undefined) funnel.formFields = formFields;

  await funnel.save();
  return funnel;
}

async function publishFunnel(funnelId, companyId, publish = true) {
  const funnel = await Funnel.findOne({ _id: funnelId, companyId });
  if (!funnel) throw new Error('Funnel not found.');
  funnel.status = publish ? 'published' : 'draft';
  funnel.publishedAt = publish ? (funnel.publishedAt || new Date()) : funnel.publishedAt;
  await funnel.save();
  return funnel;
}

function listFunnels(companyId) {
  return Funnel.find({ companyId }).sort({ createdAt: -1 });
}

function getFunnel(funnelId, companyId) {
  return Funnel.findOne({ _id: funnelId, companyId });
}

// --- Public ---------------------------------------------------------------

/**
 * Fetches a funnel for the public landing page, scoped to one company —
 * used when the caller already knows the companyId (e.g. an authenticated
 * preview link). Only ever returns a PUBLISHED funnel — a draft/archived
 * funnel must be invisible even to someone who knows its slug/companyId.
 */
function getFunnelBySlug(companyId, slug) {
  return Funnel.findOne({ companyId, slug: slugify(slug), status: 'published' });
}

/**
 * Public landing page lookup by slug ALONE (no companyId) — this is what
 * the truly public route (GET /public/funnels/:slug, rendered at the
 * client's /f/:slug) uses, since an anonymous visitor has no company
 * context. Funnel.slug is GLOBALLY unique (see the model's unique index
 * and createFunnel/updateFunnel's collision checks above), so this lookup
 * can never ambiguously match more than one tenant's funnel. Only ever
 * returns a PUBLISHED funnel.
 */
function getFunnelByPublicSlug(slug) {
  return Funnel.findOne({ slug: slugify(slug), status: 'published' });
}

/**
 * Records a public form submission and immediately converts it into a
 * real CRM Lead via crmPipelineService.createLead. Only accepts
 * submissions against a published funnel, same rule as getFunnelBySlug.
 */
async function submitFunnel(funnelId, formData = {}) {
  const funnel = await Funnel.findOne({ _id: funnelId, status: 'published' });
  if (!funnel) throw new Error('This funnel is not accepting submissions.');

  const submission = await FunnelSubmission.create({
    companyId: funnel.companyId,
    funnelId: funnel._id,
    data: formData,
  });

  const name = formData.name || formData.fullName || formData.email || formData.phone || 'Funnel lead';
  const lead = await crmPipelineService.createLead({
    companyId: funnel.companyId,
    name,
    contactName: formData.name || formData.fullName || '',
    phone: formData.phone || '',
    email: formData.email || '',
    source: 'website',
    notes: `Submitted via funnel "${funnel.name}" (/f/${funnel.slug}).`,
  });

  submission.leadId = lead._id;
  submission.convertedAt = new Date();
  await submission.save();

  funnel.submitCount = (funnel.submitCount || 0) + 1;
  await funnel.save();

  return { submission, lead };
}

// --- Analytics --------------------------------------------------------

/** Submission count over time (per day) and conversion rate to Lead. */
async function funnelAnalytics(funnelId, companyId) {
  const funnel = await Funnel.findOne({ _id: funnelId, companyId });
  if (!funnel) throw new Error('Funnel not found.');

  const submissions = await FunnelSubmission.find({ funnelId: funnel._id }).sort({ submittedAt: 1 });

  const byDay = {};
  let converted = 0;
  for (const s of submissions) {
    const day = s.submittedAt.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
    if (s.leadId) converted++;
  }

  return {
    funnelId: funnel._id,
    totalSubmissions: submissions.length,
    convertedToLead: converted,
    conversionRate: submissions.length ? Math.round((converted / submissions.length) * 1000) / 10 : 0,
    submissionsByDay: Object.entries(byDay).map(([date, count]) => ({ date, count })),
  };
}

module.exports = {
  createFunnel, updateFunnel, publishFunnel, listFunnels, getFunnel,
  getFunnelBySlug, getFunnelByPublicSlug, submitFunnel, funnelAnalytics,
  slugify,
};
