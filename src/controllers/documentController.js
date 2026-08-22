const documentService = require('../services/documentService');
const Document = require('../models/Document');
const { hasPermission } = require('../middleware/auth');
const { DOCUMENTS_MANAGE, DOCUMENTS_VIEW, VENDOR_COMPANY_DOCUMENTS_MANAGE, VENDOR_COMPANY_DOCUMENTS_VIEW } = require('../constants/permissions');

const VENDOR_COMPANY_ENTITY_TYPES = ['Supplier', 'Company'];

async function createDocument(req, res) {
  try {
    const requiredPermission = VENDOR_COMPANY_ENTITY_TYPES.includes(req.body.entityType) ? VENDOR_COMPANY_DOCUMENTS_MANAGE : DOCUMENTS_MANAGE;
    if (!hasPermission(req, requiredPermission)) return res.status(403).json({ error: `Missing permission: ${requiredPermission}` });
    res.status(201).json(await documentService.createDocument({ ...req.body, companyId: req.companyId, userId: req.auth.userId }));
  } catch (err) { res.status(400).json({ error: err.message }); }
}
async function uploadVersion(req, res) {
  try {
    // The entity type isn't in this request's own body — it belongs to
    // the document already on file, so it has to be looked up before the
    // right permission can even be decided. A stale or forged entityType
    // in the request itself would be meaningless; only the real, stored
    // document's own entityType can honestly answer "is this a vendor/
    // company document."
    const existing = await Document.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document not found.' });
    const requiredPermission = VENDOR_COMPANY_ENTITY_TYPES.includes(existing.entityType) ? VENDOR_COMPANY_DOCUMENTS_MANAGE : DOCUMENTS_MANAGE;
    if (!hasPermission(req, requiredPermission)) return res.status(403).json({ error: `Missing permission: ${requiredPermission}` });
    res.status(201).json(await documentService.uploadVersion(req.params.id, { ...req.body, userId: req.auth.userId }));
  } catch (err) { res.status(400).json({ error: err.message }); }
}
async function listDocuments(req, res) {
  const requiredPermission = VENDOR_COMPANY_ENTITY_TYPES.includes(req.query.entityType) ? VENDOR_COMPANY_DOCUMENTS_VIEW : DOCUMENTS_VIEW;
  if (!hasPermission(req, requiredPermission)) return res.status(403).json({ error: `Missing permission: ${requiredPermission}` });
  res.json(await documentService.listDocuments(req.companyId, req.query));
}
async function requestApproval(req, res) {
  try { res.status(201).json(await documentService.requestApproval(req.params.id, { ...req.body, requestedBy: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function checkExpiring(req, res) {
  res.json(await documentService.checkExpiringDocuments(req.companyId, req.query.daysAhead ? Number(req.query.daysAhead) : undefined));
}
module.exports = { createDocument, uploadVersion, listDocuments, requestApproval, checkExpiring };
