const ApprovalRequest = require('../models/ApprovalRequest');

function request({ companyId, entityType, entityId, requestedBy, note }) {
  return ApprovalRequest.create({ companyId, entityType, entityId, requestedBy, note });
}

async function decide(approvalId, { approve, userId, note }) {
  const approval = await ApprovalRequest.findById(approvalId);
  if (!approval) throw new Error('Approval request not found.');
  if (approval.status !== 'pending') throw new Error(`Already ${approval.status}.`);

  approval.status = approve ? 'approved' : 'rejected';
  approval.approvedBy = userId;
  approval.approvedAt = new Date();
  if (note) approval.note = note;
  await approval.save();

  return approval;
}

function findFor(entityType, entityId) {
  return ApprovalRequest.findOne({ entityType, entityId }).sort({ createdAt: -1 });
}

module.exports = { request, decide, findFor };
