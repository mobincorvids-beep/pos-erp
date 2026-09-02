/**
 * CrmAutomationService — CRUD for CrmAutomationRule plus the actual
 * trigger evaluation/firing, called synchronously from
 * crmPipelineService.updateOpportunityStage() right after a stage change
 * is persisted. One opportunity's stage change fires at most a handful of
 * matching rules, each doing one real-provider-or-console email send or
 * one CustomerFollowUp create — cheap enough to run inline, no queue.
 */
const CrmAutomationRule = require('../models/CrmAutomationRule');
const CustomerFollowUp = require('../models/CustomerFollowUp');
const Customer = require('../models/Customer');
const messagingService = require('./messaging/messagingService');

// --- CRUD -------------------------------------------------------------

function createRule(input) {
  const { companyId, name, active, trigger, action, createdByUserId } = input;
  if (!name || !name.trim()) throw new Error('Rule name is required.');
  if (!trigger || trigger.type !== 'stage_changed' || !trigger.toStage) {
    throw new Error('trigger must be { type: "stage_changed", toStage: "<stage>" }.');
  }
  if (!action || !['send_email', 'create_task'].includes(action.type)) {
    throw new Error('action.type must be "send_email" or "create_task".');
  }
  return CrmAutomationRule.create({
    companyId, name: name.trim(), active: active !== undefined ? !!active : true,
    trigger: { type: 'stage_changed', toStage: trigger.toStage },
    action,
    createdByUserId: createdByUserId || null,
  });
}

function listRules(companyId) {
  return CrmAutomationRule.find({ companyId }).sort({ createdAt: -1 }).limit(200);
}

async function updateRule(ruleId, companyId, patch) {
  const rule = await CrmAutomationRule.findOne({ _id: ruleId, companyId });
  if (!rule) throw new Error('Automation rule not found.');
  if (patch.name !== undefined) rule.name = patch.name;
  if (patch.active !== undefined) rule.active = !!patch.active;
  if (patch.trigger !== undefined) rule.trigger = { type: 'stage_changed', toStage: patch.trigger.toStage };
  if (patch.action !== undefined) rule.action = patch.action;
  await rule.save();
  return rule;
}

async function deleteRule(ruleId, companyId) {
  const rule = await CrmAutomationRule.findOneAndDelete({ _id: ruleId, companyId });
  if (!rule) throw new Error('Automation rule not found.');
  return rule;
}

// --- Firing -------------------------------------------------------------

function renderTemplate(template, opportunity, customer) {
  return (template || '')
    .replace(/\{\{\s*title\s*\}\}/gi, opportunity.title || '')
    .replace(/\{\{\s*customerName\s*\}\}/gi, customer?.name || '')
    .replace(/\{\{\s*estimatedValue\s*\}\}/gi, String(opportunity.estimatedValue ?? ''))
    .replace(/\{\{\s*stage\s*\}\}/gi, opportunity.stage || '');
}

async function runAction(rule, opportunity) {
  const customer = opportunity.customerId ? await Customer.findById(opportunity.customerId) : null;

  if (rule.action.type === 'send_email') {
    if (!customer) return { fired: false, reason: 'No customer linked to this opportunity yet.' };
    const subject = renderTemplate(rule.action.subject || `Update on ${opportunity.title}`, opportunity, customer);
    const message = renderTemplate(rule.action.message || '', opportunity, customer);
    const result = await messagingService.sendEmail(customer.email, subject, message);
    return { fired: true, action: 'send_email', result };
  }

  if (rule.action.type === 'create_task') {
    if (!customer) return { fired: false, reason: 'No customer linked to this opportunity yet.' };
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (rule.action.taskDueInDays ?? 3));
    const note = renderTemplate(rule.action.taskNote || `Follow up on "${opportunity.title}"`, opportunity, customer);
    const followUp = await CustomerFollowUp.create({
      companyId: opportunity.companyId,
      customerId: customer._id,
      dueDate,
      note,
      assignedToUserId: rule.action.assignedToUserId || opportunity.assignedToUserId || null,
      status: 'pending',
    });
    return { fired: true, action: 'create_task', followUp };
  }

  return { fired: false, reason: `Unknown action type "${rule.action.type}".` };
}

/**
 * Called after Opportunity.stage is actually persisted as `toStage`.
 * Never throws: a misfiring automation (bad email, provider hiccup)
 * must not undo or block the real stage change that already happened.
 */
async function fireForStageChange(opportunity, toStage) {
  try {
    const rules = await CrmAutomationRule.find({
      companyId: opportunity.companyId, active: true, 'trigger.toStage': toStage,
    });
    const outcomes = [];
    for (const rule of rules) {
      try {
        outcomes.push({ ruleId: rule._id, ruleName: rule.name, ...(await runAction(rule, opportunity)) });
      } catch (err) {
        outcomes.push({ ruleId: rule._id, ruleName: rule.name, fired: false, reason: err.message });
      }
    }
    return outcomes;
  } catch (err) {
    // Rule lookup itself failing is still not allowed to bubble up into
    // the stage-change call site.
    return [];
  }
}

module.exports = { createRule, listRules, updateRule, deleteRule, fireForStageChange };
