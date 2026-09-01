/**
 * QualityService — Non-Conformance Reports (NCR) and Corrective/Preventive
 * Actions (CAPA), the standard manufacturing/quality-ops pattern: someone
 * logs a quality problem, it gets investigated, and a corrective action is
 * tracked to real closure — not a status flip. Mirrors ticketService's
 * "submit -> assign -> resolve" shape, but the closing rule here is a real
 * business precondition (mirroring how manufacturingService and
 * stockCountService enforce their own preconditions with thrown Errors):
 * an NCR cannot close until at least one CorrectiveAction against it has
 * actually been verified as effective.
 */
const NonConformance = require('../models/NonConformance');
const CorrectiveAction = require('../models/CorrectiveAction');
const { nextDocumentNumber } = require('./numberingService');

const NCR_STATUS_TRANSITIONS = {
  open: ['investigating'],
  investigating: ['corrective_action'],
  corrective_action: ['closed'],
};

function createNCR(input) {
  const {
    companyId, branchId, title, description, source, severity,
    relatedProductId, relatedWorkOrderId, relatedSupplierId, relatedCustomerId,
    reportedByUserId, assignedToUserId,
  } = input;
  if (!title) throw new Error('title is required.');
  if (!description) throw new Error('description is required.');

  return NonConformance.create({
    companyId, branchId,
    ncrNumber: nextDocumentNumber('NCR'),
    title, description, source, severity,
    relatedProductId: relatedProductId || null,
    relatedWorkOrderId: relatedWorkOrderId || null,
    relatedSupplierId: relatedSupplierId || null,
    relatedCustomerId: relatedCustomerId || null,
    reportedByUserId,
    assignedToUserId: assignedToUserId || null,
  });
}

function listNCRs(companyId, { status, severity, source } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (severity) filter.severity = severity;
  if (source) filter.source = source;
  return NonConformance.find(filter).sort({ createdAt: -1 });
}

async function getNCR(ncrId, companyId) {
  const ncr = await NonConformance.findOne({ _id: ncrId, companyId });
  if (!ncr) throw new Error('NCR not found.');
  return ncr;
}

async function setRootCause(ncrId, companyId, { rootCause }) {
  if (!rootCause) throw new Error('rootCause is required.');
  const ncr = await getNCR(ncrId, companyId);
  ncr.rootCause = rootCause;
  await ncr.save();
  return ncr;
}

/**
 * The real workflow guard: only the transitions in NCR_STATUS_TRANSITIONS
 * are legal, and closing carries the actual business rule — at least one
 * CorrectiveAction against this NCR must already be 'verified'. This isn't
 * decorative; it's the whole point of a CAPA-backed quality process — an
 * NCR can't be waved closed just because someone changed its status.
 */
async function updateNCRStatus(ncrId, companyId, { status }) {
  const ncr = await getNCR(ncrId, companyId);
  const allowed = NCR_STATUS_TRANSITIONS[ncr.status] || [];
  if (!allowed.includes(status)) {
    throw new Error(`Cannot move NCR from "${ncr.status}" to "${status}".`);
  }

  if (status === 'closed') {
    const hasVerifiedAction = await CorrectiveAction.exists({ ncrId: ncr._id, companyId, status: 'verified' });
    if (!hasVerifiedAction) {
      throw new Error('Cannot close an NCR until at least one corrective action has been verified.');
    }
    ncr.closedAt = new Date();
  }

  ncr.status = status;
  await ncr.save();
  return ncr;
}

function createCorrectiveAction(input) {
  const { companyId, ncrId, actionType, description, assignedToUserId, dueDate } = input;
  if (!ncrId) throw new Error('ncrId is required.');
  if (!description) throw new Error('description is required.');
  if (!['corrective', 'preventive'].includes(actionType)) throw new Error('actionType must be corrective or preventive.');

  return CorrectiveAction.create({
    companyId, ncrId, actionType, description,
    assignedToUserId: assignedToUserId || null,
    dueDate: dueDate || null,
  });
}

function listCorrectiveActions(companyId, ncrId) {
  return CorrectiveAction.find({ companyId, ncrId }).sort({ createdAt: -1 });
}

const CAPA_STATUS_TRANSITIONS = {
  open: ['in_progress', 'completed'],
  in_progress: ['completed'],
  completed: ['verified'],
};

/**
 * Completing a corrective action requires a real note describing what was
 * done (via `completionNote`, folded into `description` context by the
 * caller); verifying it requires an effectivenessNote — did the action
 * actually work, not a rubber stamp.
 */
async function updateCorrectiveActionStatus(actionId, companyId, { status, note, effectivenessNote, verifiedByUserId }) {
  const action = await CorrectiveAction.findOne({ _id: actionId, companyId });
  if (!action) throw new Error('Corrective action not found.');

  const allowed = CAPA_STATUS_TRANSITIONS[action.status] || [];
  if (!allowed.includes(status)) {
    throw new Error(`Cannot move corrective action from "${action.status}" to "${status}".`);
  }

  if (status === 'completed') {
    if (!note) throw new Error('A completion note is required to mark a corrective action completed.');
    action.completedAt = new Date();
  }

  if (status === 'verified') {
    if (!effectivenessNote) throw new Error('An effectivenessNote is required to verify a corrective action.');
    action.effectivenessNote = effectivenessNote;
    action.verifiedByUserId = verifiedByUserId || null;
    action.verifiedAt = new Date();
  }

  action.status = status;
  await action.save();
  return action;
}

/**
 * Real aggregation, mirroring ticketService.slaComplianceReport's style:
 * counts by status/severity, plus average days-to-close for NCRs closed
 * within the given date range (defaults to all-time when unspecified).
 */
async function ncrSummary(companyId, { from, to } = {}) {
  const all = await NonConformance.find({ companyId });

  const byStatus = {};
  const bySeverity = {};
  for (const ncr of all) {
    byStatus[ncr.status] = (byStatus[ncr.status] || 0) + 1;
    bySeverity[ncr.severity] = (bySeverity[ncr.severity] || 0) + 1;
  }

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const closed = all.filter((ncr) => {
    if (ncr.status !== 'closed' || !ncr.closedAt) return false;
    if (fromDate && ncr.closedAt < fromDate) return false;
    if (toDate && ncr.closedAt > toDate) return false;
    return true;
  });

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const avgDaysToClose = closed.length > 0
    ? Math.round((closed.reduce((sum, ncr) => sum + (ncr.closedAt - ncr.createdAt), 0) / closed.length / MS_PER_DAY) * 100) / 100
    : null;

  return {
    total: all.length,
    byStatus,
    bySeverity,
    closedInRange: closed.length,
    avgDaysToClose,
  };
}

module.exports = {
  createNCR, listNCRs, getNCR, setRootCause, updateNCRStatus,
  createCorrectiveAction, listCorrectiveActions, updateCorrectiveActionStatus,
  ncrSummary,
};
