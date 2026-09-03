const documentService = require('../services/documentService');
const Document = require('../models/Document');
const { DOCUMENT_MAX_FILE_BYTES } = require('../models/Document');
const { hasPermission } = require('../middleware/auth');
const { DOCUMENTS_MANAGE, DOCUMENTS_VIEW, VENDOR_COMPANY_DOCUMENTS_MANAGE, VENDOR_COMPANY_DOCUMENTS_VIEW } = require('../constants/permissions');

const VENDOR_COMPANY_ENTITY_TYPES = ['Supplier', 'Company'];

// A version needs EITHER an already-hosted fileUrl OR an inline fileData
// data-URI (see Document.js) — never both required, never neither. When
// fileData is present it's a base64 data-URI ("data:<mime>;base64,<b64>")
// produced client-side (the same FileReader pattern ProductsPage already
// uses for images, just not resized — a document can't be recompressed
// the way an image can, so oversized files are a hard rejection instead).
function validateFile(body) {
  const { fileUrl, fileData, fileName, mimeType } = body;
  if (!fileName || typeof fileName !== 'string' || !fileName.trim()) return 'fileName is required.';
  if (!fileUrl && !fileData) return 'Either fileUrl or fileData is required.';
  if (fileUrl && typeof fileUrl !== 'string') return 'fileUrl must be a string.';
  if (fileData !== undefined && fileData !== null) {
    if (typeof fileData !== 'string' || !/^data:[^;]+;base64,/.test(fileData)) {
      return 'fileData must be a base64 data URI (e.g. "data:application/pdf;base64,...").';
    }
    const base64 = fileData.slice(fileData.indexOf(',') + 1);
    const approxBytes = Math.floor(base64.length * 0.75);
    if (approxBytes > DOCUMENT_MAX_FILE_BYTES) {
      return `File is too large: ${(approxBytes / (1024 * 1024)).toFixed(1)}MB exceeds the ${DOCUMENT_MAX_FILE_BYTES / (1024 * 1024)}MB limit per document.`;
    }
  }
  if (mimeType !== undefined && mimeType !== null && typeof mimeType !== 'string') return 'mimeType must be a string.';
  return null;
}

// Derives mimeType/fileSizeBytes from fileData when the client didn't send
// them explicitly, so the stored record is always self-describing.
function enrichFileFields(body) {
  const out = { ...body };
  if (out.fileData && !out.mimeType) {
    const match = /^data:([^;]+);base64,/.exec(out.fileData);
    if (match) out.mimeType = match[1];
  }
  if (out.fileData && !out.fileSizeBytes) {
    const base64 = out.fileData.slice(out.fileData.indexOf(',') + 1);
    out.fileSizeBytes = Math.floor(base64.length * 0.75);
  }
  return out;
}

async function createDocument(req, res) {
  try {
    const fileError = validateFile(req.body);
    if (fileError) return res.status(400).json({ error: fileError });
    const requiredPermission = VENDOR_COMPANY_ENTITY_TYPES.includes(req.body.entityType) ? VENDOR_COMPANY_DOCUMENTS_MANAGE : DOCUMENTS_MANAGE;
    if (!hasPermission(req, requiredPermission)) return res.status(403).json({ error: `Missing permission: ${requiredPermission}` });
    res.status(201).json(await documentService.createDocument({ ...enrichFileFields(req.body), companyId: req.companyId, userId: req.auth.userId }));
  } catch (err) { res.status(400).json({ error: err.message }); }
}
async function uploadVersion(req, res) {
  try {
    const fileError = validateFile(req.body);
    if (fileError) return res.status(400).json({ error: fileError });
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
    res.status(201).json(await documentService.uploadVersion(req.params.id, { ...enrichFileFields(req.body), userId: req.auth.userId }));
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
async function deleteDocument(req, res) {
  try {
    const existing = await Document.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document not found.' });
    const requiredPermission = VENDOR_COMPANY_ENTITY_TYPES.includes(existing.entityType) ? VENDOR_COMPANY_DOCUMENTS_MANAGE : DOCUMENTS_MANAGE;
    if (!hasPermission(req, requiredPermission)) return res.status(403).json({ error: `Missing permission: ${requiredPermission}` });
    await documentService.deleteDocument(req.params.id);
    res.status(204).end();
  } catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createDocument, uploadVersion, listDocuments, requestApproval, checkExpiring, deleteDocument };
