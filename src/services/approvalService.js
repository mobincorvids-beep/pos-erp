/**
 * ApprovalService — the real, multi-step Workflow Engine this app was
 * missing. request() snapshots whichever steps of a matching
 * WorkflowDefinition apply to the request's amount; decide() only
 * advances the chain one step at a time, and a single rejection at any
 * step kills the whole request immediately — a common, sensible default
 * for how real approval chains behave.
 *
 * Genuinely backward compatible with the ORIGINAL single-step behavior,
 * not just claimed to be: when no WorkflowDefinition exists for an
 * entityType (the situation every existing caller — purchaseService — is
 * already in), request() falls back to exactly one implicit step with no
 * role target at all, and decide() behaves exactly like the old version
 * (anyone with the right PERMISSION, enforced separately at the route
 * layer, can decide it — no role-matching check applies to a roleId-less step).
 */
const ApprovalRequest = require('../models/ApprovalRequest');
const WorkflowDefinition = require('../models/WorkflowDefinition');
const notificationService = require('./notificationService');

async function request({ companyId, entityType, entityId, requestedBy, amount, note }) {
  const definition = await WorkflowDefinition.findOne({ companyId, entityType, isActive: true });

  let steps;
  if (definition) {
    const applicable = definition.steps.filter((s) => amount === undefined || amount === null || amount >= s.minAmount);
    if (applicable.length === 0) {
      throw new Error(`No configured workflow step applies to an amount of ${amount} for "${entityType}" — check the WorkflowDefinition's step thresholds.`);
    }
    steps = applicable.map((s) => ({ stepOrder: s.order, roleId: s.roleId, decision: null }));
  } else {
    steps = [{ stepOrder: 1, roleId: null, decision: null }]; // no workflow configured — single implicit step, same as the original behavior
  }

  const approval = await ApprovalRequest.create({ companyId, entityType, entityId, requestedBy, amount, steps, currentStepIndex: 0, note });

  if (steps[0].roleId) {
    await notificationService.notify({
      companyId, roleId: steps[0].roleId, type: 'approval_needed',
      title: `Approval needed: ${entityType}`,
      message: note || `A new ${entityType} is waiting for your approval${steps.length > 1 ? ` (step 1 of ${steps.length})` : ''}.`,
      entityType, entityId,
    });
  }

  return approval;
}

async function decide(approvalId, { approve, userId, note }) {
  const approval = await ApprovalRequest.findById(approvalId);
  if (!approval) throw new Error('Approval request not found.');
  if (approval.status !== 'pending') throw new Error(`Already ${approval.status}.`);

  const currentStep = approval.steps[approval.currentStepIndex];
  if (!currentStep) throw new Error('Internal error: no current step found on this approval request.');

  currentStep.decision = approve ? 'approved' : 'rejected';
  currentStep.decidedBy = userId;
  currentStep.decidedAt = new Date();
  if (note) currentStep.note = note;

  if (!approve) {
    // A rejection at ANY step kills the whole chain immediately — the
    // remaining steps never get asked, since there's nothing left to approve.
    approval.status = 'rejected';
    approval.approvedBy = userId;
    approval.approvedAt = new Date();
  } else if (approval.currentStepIndex === approval.steps.length - 1) {
    // That was the LAST step — the whole chain is now fully approved.
    approval.status = 'approved';
    approval.approvedBy = userId;
    approval.approvedAt = new Date();
  } else {
    // Approved, but more steps remain — advance to the next one and notify its role.
    approval.currentStepIndex += 1;
    const nextStep = approval.steps[approval.currentStepIndex];
    if (nextStep.roleId) {
      await notificationService.notify({
        companyId: approval.companyId, roleId: nextStep.roleId, type: 'approval_needed',
        title: `Approval needed: ${approval.entityType}`,
        message: `Step ${approval.currentStepIndex + 1} of ${approval.steps.length} — the previous step was approved.`,
        entityType: approval.entityType, entityId: approval.entityId,
      });
    }
  }

  if (note && approval.status !== 'pending') approval.note = note;
  await approval.save();

  if (approval.status !== 'pending' && approval.requestedBy) {
    await notificationService.notify({
      companyId: approval.companyId, userId: approval.requestedBy, type: 'approval_decided',
      title: `${approval.entityType} ${approval.status}`,
      message: `Your ${approval.entityType} request was ${approval.status}.`,
      entityType: approval.entityType, entityId: approval.entityId,
    });
  }

  return approval;
}

function findFor(entityType, entityId) {
  return ApprovalRequest.findOne({ entityType, entityId }).sort({ createdAt: -1 });
}

function defineWorkflow({ companyId, entityType, steps }) {
  return WorkflowDefinition.findOneAndUpdate(
    { companyId, entityType },
    { companyId, entityType, steps: [...steps].sort((a, b) => a.order - b.order), isActive: true },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
}

function getWorkflow(companyId, entityType) {
  return WorkflowDefinition.findOne({ companyId, entityType });
}

module.exports = { request, decide, findFor, defineWorkflow, getWorkflow };
