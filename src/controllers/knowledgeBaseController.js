const knowledgeBaseService = require('../services/knowledgeBaseService');

async function createArticle(req, res) {
  try {
    res.status(201).json(await knowledgeBaseService.createArticle({
      ...req.body, companyId: req.companyId, authorId: req.auth.userId,
    }));
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function listArticles(req, res) {
  res.json(await knowledgeBaseService.listArticles(req.companyId, req.query));
}

async function getArticle(req, res) {
  try { res.json(await knowledgeBaseService.getArticle(req.params.id, req.companyId)); }
  catch (err) { res.status(404).json({ error: err.message }); }
}

async function updateArticle(req, res) {
  try { res.json(await knowledgeBaseService.updateArticle(req.params.id, req.companyId, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function deleteArticle(req, res) {
  try { res.json(await knowledgeBaseService.deleteArticle(req.params.id, req.companyId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function publishArticle(req, res) {
  try { res.json(await knowledgeBaseService.publishArticle(req.params.id, req.companyId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function unpublishArticle(req, res) {
  try { res.json(await knowledgeBaseService.unpublishArticle(req.params.id, req.companyId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function recordView(req, res) {
  try { res.json(await knowledgeBaseService.recordView(req.params.id, req.companyId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function voteArticle(req, res) {
  try { res.json(await knowledgeBaseService.voteArticle(req.params.id, req.companyId, req.body.helpful === true)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function suggest(req, res) {
  res.json(await knowledgeBaseService.suggestArticles(req.companyId, req.query.query || req.query.q || ''));
}

module.exports = {
  createArticle, listArticles, getArticle, updateArticle, deleteArticle,
  publishArticle, unpublishArticle, recordView, voteArticle, suggest,
};
