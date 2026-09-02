/**
 * Integration tests for AudienceSegment / MarketingJourney /
 * JourneyEnrollment — exercises a 3-step journey (welcome email -> wait
 * 2 days -> discount SMS) end to end: enroll, process the immediate
 * step, confirm the wait step doesn't fire early, fast-forward past it,
 * process the final step, confirm completion.
 *
 * Requires a real MongoDB at process.env.MONGO_URI, same pattern as
 * src/tests/inventory.test.js.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { nanoid } = require('nanoid');

const Customer = require('../models/Customer');
const JourneyEnrollment = require('../models/JourneyEnrollment');
const companyProvisioningService = require('../services/companyProvisioningService');
const audienceSegmentService = require('../services/audienceSegmentService');
const marketingJourneyService = require('../services/marketingJourneyService');

let company, vip;

beforeAll(async () => {
  await connectDB();
  const suffix = nanoid(6).toLowerCase();

  ({ company } = await companyProvisioningService.onboardCompany({
    name: `Marketing Test Co ${suffix}`, industryType: 'retail',
    adminName: 'Marketing Admin', adminEmail: `mkt-${suffix}@test.local`,
  }));

  vip = await Customer.create({ companyId: company._id, name: 'Vip Customer', email: `vip-${suffix}@test.local`, phone: '+15550001111', tags: ['VIP'] });
  await Customer.create({ companyId: company._id, name: 'Regular Customer', email: `reg-${suffix}@test.local`, phone: '+15550002222', tags: [] });
});

afterAll(async () => {
  await mongoose.connection.close();
});

test('segment resolution matches only tagged customers', async () => {
  const segment = await audienceSegmentService.createSegment({
    companyId: company._id,
    name: 'VIP customers',
    conditions: [{ field: 'tags', operator: 'contains', value: 'VIP' }],
  });
  const preview = await audienceSegmentService.previewSegment(segment._id, company._id);
  expect(preview.count).toBe(1);
  expect(preview.members[0].name).toBe('Vip Customer');
});

test('3-step journey (send_email -> wait 48h -> send_sms) enrolls and progresses a customer to completion', async () => {
  const segment = await audienceSegmentService.createSegment({
    companyId: company._id,
    name: 'VIP customers for journey',
    conditions: [{ field: 'tags', operator: 'contains', value: 'VIP' }],
  });

  const journey = await marketingJourneyService.createJourney({
    companyId: company._id,
    name: 'VIP Welcome Drip',
    trigger: { type: 'manual' },
    steps: [
      { stepType: 'send_email', delayHours: 0, templateSubject: 'Welcome {{customerName}}!', templateBody: 'Hi {{customerName}}, thanks for being a VIP.' },
      { stepType: 'wait', delayHours: 48 },
      { stepType: 'send_sms', delayHours: 0, templateBody: 'Hi {{customerName}}, here is 20% off just for you.' },
    ],
  });
  await marketingJourneyService.setJourneyStatus(journey._id, company._id, 'active');

  const enrollResult = await marketingJourneyService.enrollSegmentMembers(journey._id, segment._id, company._id);
  expect(enrollResult.enrolledCount).toBe(1);

  let enrollment = await JourneyEnrollment.findOne({ journeyId: journey._id, customerId: vip._id });
  expect(enrollment.currentStepIndex).toBe(0);

  // Step 0 (send_email, delayHours 0) is immediately due.
  await marketingJourneyService.processDueSteps();
  enrollment = await JourneyEnrollment.findById(enrollment._id);
  expect(enrollment.currentStepIndex).toBe(1);
  expect(enrollment.status).toBe('active');
  expect(enrollment.history[0].stepType).toBe('send_email');
  expect(enrollment.history[0].success).toBe(true);

  // Step 1 (wait 48h) is NOT due yet — a real-time scan must not advance it.
  await marketingJourneyService.processDueSteps();
  const stillWaiting = await JourneyEnrollment.findById(enrollment._id);
  expect(stillWaiting.currentStepIndex).toBe(1);

  // Fast-forward past the wait.
  const future = new Date(Date.now() + 49 * 60 * 60 * 1000);
  await marketingJourneyService.processDueSteps(future);
  enrollment = await JourneyEnrollment.findById(enrollment._id);
  expect(enrollment.currentStepIndex).toBe(2);

  // Step 2 (send_sms, delayHours 0) is due in the same forced window.
  await marketingJourneyService.processDueSteps(future);
  enrollment = await JourneyEnrollment.findById(enrollment._id);
  expect(enrollment.status).toBe('completed');
  expect(enrollment.history).toHaveLength(3);
  expect(enrollment.history[2].stepType).toBe('send_sms');

  const stats = await marketingJourneyService.journeyStats(journey._id, company._id);
  expect(stats.completed).toBe(1);
  expect(stats.active).toBe(0);

  // Re-enrolling a COMPLETED customer creates a fresh active enrollment.
  const reEnroll = await marketingJourneyService.enrollCustomer(journey._id, vip._id, company._id);
  expect(reEnroll.status).toBe('active');
  expect(reEnroll.currentStepIndex).toBe(0);

  // Enrolling again while ALREADY active is a no-op, not a duplicate-key error.
  const noop = await marketingJourneyService.enrollCustomer(journey._id, vip._id, company._id);
  expect(String(noop._id)).toBe(String(reEnroll._id));
});

test('a paused journey does not fire due steps', async () => {
  const journey = await marketingJourneyService.createJourney({
    companyId: company._id,
    name: 'Paused Journey',
    trigger: { type: 'manual' },
    steps: [{ stepType: 'send_email', delayHours: 0, templateSubject: 'Hi', templateBody: 'Hi' }],
  });
  await marketingJourneyService.setJourneyStatus(journey._id, company._id, 'active');
  await marketingJourneyService.enrollCustomer(journey._id, vip._id, company._id);
  await marketingJourneyService.setJourneyStatus(journey._id, company._id, 'paused');

  await marketingJourneyService.processDueSteps();

  const enrollment = await JourneyEnrollment.findOne({ journeyId: journey._id, customerId: vip._id });
  expect(enrollment.currentStepIndex).toBe(0); // never advanced — journey wasn't active
  expect(enrollment.history).toHaveLength(0);
});
