/**
 * DocumentService — attach, version, optionally approve, and track expiry
 * for a file against any entity in this app. Deliberately reuses two
 * existing engines rather than reimplementing either:
 *   - approvalService (the real multi-step Workflow Engine) for
 *     documents that need sign-off — a document's approval IS an
 *     ApprovalRequest with entityType:'Document', not a second,
 *     parallel approval mechanism invented for this module specifically.
 *   - notificationService (the real Notification Engine) for expiry
 *     alerts — checkExpiringDocuments() fires real notifications the
 *     exact same way inventoryService's low-stock check already does.
 *
 * Binary file storage: this app has no cloud storage (no multer-to-disk/
 * S3/presigned-URL infra for Documents). Files arrive already validated
 * (size cap, mimeType) by documentController and are stored inline as a
 * base64 data-URI on `fileData` — the same approach product images
 * already use, generalized to any file type. `fileUrl` remains supported
 * for a version that instead points at an already-hosted external file
 * (e.g. a presigned URL from a future real deployment) — a version needs
 * EITHER one, not both.
 */
const Document = require('../models/Document');
const Role = require('../models/Role');
const approvalService = require('./approvalService');
const notificationService = require('./notificationService');

function createDocument({ companyId, entityType, entityId, category, fileUrl, fileData, fileName, mimeType, fileSizeBytes, expiryDate, tags, userId, note }) {
  if (!fileName) throw new Error('fileName is required.');
  if (!fileUrl && !fileData) throw new Error('Either fileUrl or fileData is required.');
  return Document.create({
    companyId, entityType, entityId, category, expiryDate: expiryDate || null, tags: tags || [],
    versions: [{ versionNumber: 1, fileUrl: fileUrl || null, fileData: fileData || null, fileName, mimeType: mimeType || null, fileSizeBytes: fileSizeBytes || null, uploadedBy: userId, note }],
  });
}

/** Appends a NEW version: never overwrites an existing one, so the full history stays intact. */
async function uploadVersion(documentId, { fileUrl, fileData, fileName, mimeType, fileSizeBytes, userId, note }) {
  if (!fileName) throw new Error('fileName is required.');
  if (!fileUrl && !fileData) throw new Error('Either fileUrl or fileData is required.');
  const doc = await Document.findById(documentId);
  if (!doc) throw new Error('Document not found.');

  const nextVersionNumber = doc.versions.length + 1;
  doc.versions.push({ versionNumber: nextVersionNumber, fileUrl: fileUrl || null, fileData: fileData || null, fileName, mimeType: mimeType || null, fileSizeBytes: fileSizeBytes || null, uploadedBy: userId, note });
  await doc.save();
  return doc;
}

function listDocuments(companyId, { entityType, entityId, category } = {}) {
  const filter = { companyId };
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (category) filter.category = category;
  return Document.find(filter).sort({ createdAt: -1 });
}

function currentVersion(doc) {
  return doc.versions[doc.versions.length - 1]; // always the LAST pushed entry — versions are append-only, so this is always genuinely the newest
}

/** Requests approval for a document, a real ApprovalRequest, through the real Workflow Engine, not a second approval system. */
async function requestApproval(documentId, { requestedBy, amount, note }) {
  const doc = await Document.findById(documentId);
  if (!doc) throw new Error('Document not found.');
  if (doc.approvalRequestId) throw new Error('An approval has already been requested for this document.');

  const approval = await approvalService.request({ companyId: doc.companyId, entityType: 'Document', entityId: doc._id, requestedBy, amount, note });
  doc.approvalRequestId = approval._id;
  await doc.save();
  return { doc, approval };
}

/**
 * The real trigger point: finds every document whose expiryDate falls
 * within the next `daysAhead` days and hasn't already been notified about,
 * and fires a genuine notification per document — targeted at whichever
 * role manages documents/approvals (reusing the roles.manage permission,
 * same escape hatch every branch-access and low-stock check already uses
 * to find "whoever's actually responsible"), then marks it notified so
 * running this again tomorrow doesn't spam the same alert daily.
 */
async function checkExpiringDocuments(companyId, daysAhead = 30) {
  const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const expiring = await Document.find({
    companyId, expiryNotified: false,
    expiryDate: { $ne: null, $lte: cutoff, $gte: new Date() },
  });

  if (expiring.length === 0) return { notifiedCount: 0 };

  const roles = await Role.find({ companyId, permissions: { $in: ['roles.manage', '*'] } });
  let notifiedCount = 0;

  for (const doc of expiring) {
    const daysRemaining = Math.ceil((doc.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
    for (const role of roles) {
      await notificationService.notify({
        companyId, roleId: role._id, type: 'document_expiring',
        title: `${doc.category} expiring in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
        message: `${currentVersion(doc).fileName} (attached to ${doc.entityType}) expires on ${doc.expiryDate.toDateString()}.`,
        entityType: 'Document', entityId: doc._id,
      });
    }
    doc.expiryNotified = true;
    await doc.save();
    notifiedCount += 1;
  }

  return { notifiedCount };
}

async function deleteDocument(documentId) {
  const doc = await Document.findByIdAndDelete(documentId);
  if (!doc) throw new Error('Document not found.');
  return doc;
}

module.exports = { createDocument, uploadVersion, listDocuments, currentVersion, requestApproval, checkExpiringDocuments, deleteDocument };
