/**
 * CrmService — segmentation (via Customer.tags), feedback/complaints,
 * follow-ups, and campaigns. Segmentation deliberately reuses the tags
 * array already on Customer rather than introducing a separate "Segment"
 * collection — a segment IS just "customers with tag X", so a query is
 * enough; no synced membership table to go stale.
 */
const Customer = require('../models/Customer');
const CustomerFeedback = require('../models/CustomerFeedback');
const CustomerFollowUp = require('../models/CustomerFollowUp');
const Campaign = require('../models/Campaign');
const Sale = require('../models/Sale');
const Ticket = require('../models/Ticket');
const messagingService = require('./messaging/messagingService');

// --- Segmentation -----------------------------------------------------

async function addTags(customerId, tags) {
  const customer = await Customer.findByIdAndUpdate(
    customerId, { $addToSet: { tags: { $each: tags } } }, { new: true }
  );
  if (!customer) throw new Error('Customer not found.');
  return customer;
}

async function removeTags(customerId, tags) {
  const customer = await Customer.findByIdAndUpdate(
    customerId, { $pull: { tags: { $in: tags } } }, { new: true }
  );
  if (!customer) throw new Error('Customer not found.');
  return customer;
}

/** Customers matching ANY of the given tags, the "segment" itself is just this query. */
function findBySegment(companyId, tags) {
  const filter = { companyId };
  if (tags && tags.length > 0) filter.tags = { $in: tags };
  return Customer.find(filter).limit(500);
}

// --- Feedback / complaints ---------------------------------------------

function submitFeedback(input) {
  const { companyId, customerId, saleId, rating, comment, category, userId } = input;
  if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5.');
  return CustomerFeedback.create({ companyId, customerId, saleId, rating, comment, category, userId });
}

async function resolveFeedback(feedbackId, resolutionNote) {
  const feedback = await CustomerFeedback.findByIdAndUpdate(
    feedbackId, { status: 'resolved', resolutionNote }, { new: true }
  );
  if (!feedback) throw new Error('Feedback not found.');
  return feedback;
}

// --- Follow-ups ---------------------------------------------------------

function scheduleFollowUp(input) {
  const { companyId, customerId, dueDate, note, assignedToUserId } = input;
  return CustomerFollowUp.create({ companyId, customerId, dueDate, note, assignedToUserId, status: 'pending' });
}

async function completeFollowUp(followUpId, completionNote) {
  const followUp = await CustomerFollowUp.findByIdAndUpdate(
    followUpId, { status: 'done', completedAt: new Date(), completionNote }, { new: true }
  );
  if (!followUp) throw new Error('Follow-up not found.');
  return followUp;
}

function pendingFollowUps(companyId, assignedToUserId = null) {
  const filter = { companyId, status: 'pending' };
  if (assignedToUserId) filter.assignedToUserId = assignedToUserId;
  return CustomerFollowUp.find(filter).sort({ dueDate: 1 }).limit(200);
}

// --- Campaigns ------------------------------------------------------------

function createCampaign(input) {
  const { companyId, name, channel, message, targetTags, userId } = input;
  return Campaign.create({ companyId, name, channel, message, targetTags: targetTags || [], userId });
}

/**
 * Sends a campaign for real — targeting was already real (findBySegment),
 * this is what used to be entirely missing: an actual attempt to deliver
 * to every recipient, through messagingService's real-provider-or-console
 * fallback. One recipient failing (no phone on file, provider error)
 * doesn't abort the batch — each is attempted independently and counted,
 * same as any real bulk-send system.
 */
async function sendCampaign(campaignId) {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found.');
  if (campaign.status === 'sent') throw new Error('Campaign already sent.');

  const recipients = await findBySegment(campaign.companyId, campaign.targetTags);

  let successCount = 0;
  let failureCount = 0;
  const results = [];

  for (const customer of recipients) {
    const result = campaign.channel === 'sms'
      ? await messagingService.sendSms(customer.phone, campaign.message)
      : await messagingService.sendEmail(customer.email, campaign.name, campaign.message);

    if (result.success) successCount++; else failureCount++;
    results.push({ customerId: customer._id, ...result });
  }

  campaign.status = 'sent';
  campaign.recipientCount = recipients.length;
  campaign.successCount = successCount;
  campaign.failureCount = failureCount;
  campaign.provider = campaign.channel === 'sms' ? messagingService.activeSmsProvider() : messagingService.activeEmailProvider();
  campaign.sentAt = new Date();
  await campaign.save();

  return { campaign, results };
}

// --- Contact activity timeline ------------------------------------------

/**
 * Assembles one unified, chronological activity timeline for a customer
 * out of four existing collections (sales, support tickets, follow-ups,
 * feedback) — server-side, so the frontend does one fetch instead of four.
 * Each collection is queried independently (they're small, per-customer
 * result sets) then merge-sorted by date, newest first.
 */
async function getContactTimeline(companyId, customerId) {
  const customer = await Customer.findOne({ _id: customerId, companyId });
  if (!customer) throw new Error('Customer not found.');

  const [sales, tickets, followUps, feedback] = await Promise.all([
    Sale.find({ companyId, customerId }).sort({ invoiceDate: -1 }).limit(100)
      .select('documentNumber invoiceNumber status saleType totalAmount invoiceDate createdAt'),
    Ticket.find({ companyId, customerId }).sort({ createdAt: -1 }).limit(100)
      .select('subject category priority status createdAt resolvedAt'),
    CustomerFollowUp.find({ companyId, customerId }).sort({ createdAt: -1 }).limit(100)
      .select('note status dueDate completedAt createdAt'),
    CustomerFeedback.find({ companyId, customerId }).sort({ createdAt: -1 }).limit(100)
      .select('rating comment category status createdAt'),
  ]);

  const events = [
    ...sales.map((s) => ({
      type: 'sale',
      date: s.invoiceDate || s.createdAt,
      title: `${s.saleType === 'quotation' ? 'Quotation' : s.saleType === 'sales_order' ? 'Sales order' : 'Sale'} ${s.invoiceNumber || s.documentNumber}`,
      description: `${s.status} · ${s.totalAmount}`,
      refId: s._id,
    })),
    ...tickets.map((t) => ({
      type: 'ticket',
      date: t.createdAt,
      title: `Ticket: ${t.subject}`,
      description: `${t.category} · ${t.priority} priority · ${t.status}`,
      refId: t._id,
    })),
    ...followUps.map((f) => ({
      type: 'follow_up',
      date: f.createdAt,
      title: f.status === 'done' ? 'Follow-up completed' : 'Follow-up scheduled',
      description: f.note,
      refId: f._id,
    })),
    ...feedback.map((f) => ({
      type: 'feedback',
      date: f.createdAt,
      title: `Feedback: ${f.rating}/5 (${f.category})`,
      description: f.comment || '',
      refId: f._id,
    })),
  ];

  events.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { customer, events };
}

module.exports = {
  addTags, removeTags, findBySegment,
  submitFeedback, resolveFeedback,
  scheduleFollowUp, completeFollowUp, pendingFollowUps,
  createCampaign, sendCampaign,
  getContactTimeline,
};
