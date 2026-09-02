/**
 * KnowledgeBaseService — internal staff SOP/documentation repository that
 * doubles as Helpdesk ticket deflection. Search follows this codebase's
 * existing convention (no text index anywhere in the app — see Customer,
 * Funnel, etc.) of a simple case-insensitive regex match rather than
 * MongoDB $text, and slug handling mirrors funnelService's slugify()
 * precedent, just scoped per-company instead of globally.
 */
const KnowledgeArticle = require('../models/KnowledgeArticle');

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article';
}

async function createArticle(input) {
  const { companyId, title, body, category, tags, slug, authorId, linkedEntityType, linkedEntityId } = input;
  if (!companyId) throw new Error('companyId is required.');
  if (!title) throw new Error('Article title is required.');
  if (!body) throw new Error('Article body is required.');

  const finalSlug = slugify(slug || title);
  const existing = await KnowledgeArticle.findOne({ companyId, slug: finalSlug });
  if (existing) throw new Error(`An article with slug "${finalSlug}" already exists. Try a more specific title/slug.`);

  return KnowledgeArticle.create({
    companyId, title, slug: finalSlug, body,
    category: category || null,
    tags: tags && tags.length ? tags : [],
    authorId: authorId || null,
    linkedEntityType: linkedEntityType || null,
    linkedEntityId: linkedEntityId || null,
  });
}

async function updateArticle(articleId, companyId, updates) {
  const article = await KnowledgeArticle.findOne({ _id: articleId, companyId });
  if (!article) throw new Error('Article not found.');

  const { title, body, category, tags, slug, linkedEntityType, linkedEntityId } = updates;
  if (slug && slugify(slug) !== article.slug) {
    const newSlug = slugify(slug);
    const clash = await KnowledgeArticle.findOne({ companyId, slug: newSlug, _id: { $ne: article._id } });
    if (clash) throw new Error(`An article with slug "${newSlug}" already exists. Try a more specific slug.`);
    article.slug = newSlug;
  }
  if (title !== undefined) article.title = title;
  if (body !== undefined) article.body = body;
  if (category !== undefined) article.category = category;
  if (tags !== undefined) article.tags = tags;
  if (linkedEntityType !== undefined) article.linkedEntityType = linkedEntityType;
  if (linkedEntityId !== undefined) article.linkedEntityId = linkedEntityId;
  await article.save();
  return article;
}

async function deleteArticle(articleId, companyId) {
  const article = await KnowledgeArticle.findOneAndDelete({ _id: articleId, companyId });
  if (!article) throw new Error('Article not found.');
  return article;
}

function listArticles(companyId, { status, category, tag, q } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: re }, { body: re }, { tags: re }];
  }
  return KnowledgeArticle.find(filter).sort({ updatedAt: -1 });
}

async function getArticle(articleId, companyId) {
  const article = await KnowledgeArticle.findOne({ _id: articleId, companyId });
  if (!article) throw new Error('Article not found.');
  return article;
}

async function publishArticle(articleId, companyId) {
  const article = await getArticle(articleId, companyId);
  article.status = 'published';
  await article.save();
  return article;
}

async function unpublishArticle(articleId, companyId) {
  const article = await getArticle(articleId, companyId);
  article.status = 'draft';
  await article.save();
  return article;
}

/** Called when an article is actually opened/read — a real, monotonic view counter, never decremented. */
async function recordView(articleId, companyId) {
  const article = await KnowledgeArticle.findOneAndUpdate(
    { _id: articleId, companyId },
    { $inc: { viewCount: 1 } },
    { new: true },
  );
  if (!article) throw new Error('Article not found.');
  return article;
}

/** Simple thumbs up/down feedback — no per-user dedupe (no session/identity tracking on articles), just an aggregate counter. */
async function voteArticle(articleId, companyId, helpful) {
  const inc = helpful ? { helpfulCount: 1 } : { notHelpfulCount: 1 };
  const article = await KnowledgeArticle.findOneAndUpdate(
    { _id: articleId, companyId },
    { $inc: inc },
    { new: true },
  );
  if (!article) throw new Error('Article not found.');
  return article;
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Naive keyword-overlap suggestion used both by the standalone
 * /knowledge-base/suggest endpoint and ticket-suggestion integration:
 * split the query into words (3+ chars, so "a"/"is"/"the" noise doesn't
 * dominate), regex-match each word against title/tags/body, and score by
 * how many distinct query words a given article matched — no real
 * full-text ranking, just "the article matching the most words wins".
 */
async function suggestArticles(companyId, query, limit = 5) {
  const words = String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  if (words.length === 0) return [];

  const uniqueWords = [...new Set(words)];
  const orClauses = uniqueWords.map((w) => {
    const re = new RegExp(escapeRegex(w), 'i');
    return { $or: [{ title: re }, { tags: re }, { body: re }] };
  });

  const candidates = await KnowledgeArticle.find({ companyId, status: 'published', $or: orClauses });

  const scored = candidates.map((article) => {
    const haystack = `${article.title} ${(article.tags || []).join(' ')} ${article.body}`.toLowerCase();
    const score = uniqueWords.reduce((sum, w) => (haystack.includes(w) ? sum + 1 : sum), 0);
    return { article, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.article);
}

module.exports = {
  slugify, createArticle, updateArticle, deleteArticle, listArticles, getArticle,
  publishArticle, unpublishArticle, recordView, voteArticle, suggestArticles,
};
