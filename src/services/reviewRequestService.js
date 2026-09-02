/**
 * ReviewRequestService — lightweight reputation management. Sends a
 * review-request link via the existing messagingService (SMS/email —
 * console-logged in this sandbox unless real Twilio/SendGrid credentials
 * are configured, same as every other messagingService caller), then
 * accepts the customer's public, token-based response. Deliberately does
 * NOT post anything to Google/Facebook/etc — see the model comment.
 */
const ReviewRequest = require('../models/ReviewRequest');
const Customer = require('../models/Customer');
const messagingService = require('./messaging/messagingService');

async function createAndSend(companyId, { customerId, saleId, baseUrl }) {
  if (!customerId) throw new Error('customerId is required.');
  const customer = await Customer.findOne({ _id: customerId, companyId });
  if (!customer) throw new Error('Customer not found.');

  const reviewRequest = await ReviewRequest.create({ companyId, customerId, saleId: saleId || null });

  const link = `${baseUrl || ''}/review/${reviewRequest.publicReviewLink}`;
  const message = `Hi ${customer.name || ''}, thanks for your business! Could you spare a moment to rate your experience? ${link}`;

  const results = {};
  if (customer.email) results.email = await messagingService.sendEmail(customer.email, 'How did we do?', message);
  if (customer.phone) results.sms = await messagingService.sendSms(customer.phone, message);

  reviewRequest.status = 'sent';
  reviewRequest.sentAt = new Date();
  await reviewRequest.save();

  return { reviewRequest, sendResults: results };
}

function listReviewRequests(companyId, filter = {}) {
  const query = { companyId };
  if (filter.status) query.status = filter.status;
  if (filter.needsFollowUp !== undefined) query.needsFollowUp = filter.needsFollowUp;
  return ReviewRequest.find(query).populate('customerId', 'name email phone').sort({ createdAt: -1 }).limit(200);
}

function needsFollowUp(companyId) {
  return ReviewRequest.find({ companyId, needsFollowUp: true }).populate('customerId', 'name email phone').sort({ respondedAt: -1 });
}

// --- Public (token-based, no auth) -------------------------------------

async function getByToken(token) {
  const reviewRequest = await ReviewRequest.findOne({ publicReviewLink: token }).populate('customerId', 'name');
  if (!reviewRequest) throw new Error('This review link is not valid.');
  return reviewRequest;
}

async function respond(token, { rating, feedback }) {
  const reviewRequest = await ReviewRequest.findOne({ publicReviewLink: token });
  if (!reviewRequest) throw new Error('This review link is not valid.');
  if (reviewRequest.status === 'responded') throw new Error('This review has already been submitted.');

  const numericRating = Number(rating);
  if (!(numericRating >= 1 && numericRating <= 5)) throw new Error('rating must be between 1 and 5.');

  reviewRequest.rating = numericRating;
  reviewRequest.feedback = feedback || '';
  reviewRequest.status = 'responded';
  reviewRequest.respondedAt = new Date();
  if (numericRating < 4) reviewRequest.needsFollowUp = true;

  await reviewRequest.save();
  return reviewRequest;
}

/** Customer opts in to a positive review being shown internally as "shareable". No external posting happens — see model comment. */
async function markSharedPublicly(token) {
  const reviewRequest = await ReviewRequest.findOne({ publicReviewLink: token });
  if (!reviewRequest) throw new Error('This review link is not valid.');
  if (!(reviewRequest.rating >= 4)) throw new Error('Only positive reviews can be shared publicly.');
  reviewRequest.sharedPublicly = true;
  await reviewRequest.save();
  return reviewRequest;
}

module.exports = { createAndSend, listReviewRequests, needsFollowUp, getByToken, respond, markSharedPublicly };
