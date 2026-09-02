/**
 * PerformanceService — OKR-style goals and periodic performance reviews.
 *
 * Employee-scoped read functions (listGoals, listReviews, employeeScorecard,
 * acknowledgeReview) are kept as plain, directly-importable exports —
 * deliberately not buried behind controller-only logic — so a future
 * addition to employeePortalService (built earlier this session, not
 * edited here) can import and call them directly for "view my goals" /
 * "acknowledge my review" flows without duplicating query logic.
 */
const Goal = require('../models/Goal');
const PerformanceReview = require('../models/PerformanceReview');
const AppraisalCycle = require('../models/AppraisalCycle');
const Employee = require('../models/Employee');

// --- Goals -----------------------------------------------------------------

function createGoal({ companyId, employeeId, parentGoalId, title, description, category, targetValue, unit, dueDate }) {
  if (!employeeId) throw new Error('employeeId is required.');
  if (!title) throw new Error('Goal title is required.');
  return Goal.create({
    companyId, employeeId, parentGoalId: parentGoalId || null,
    title, description, category, targetValue, unit, dueDate,
  });
}

async function updateGoalProgress(goalId, currentValue) {
  const goal = await Goal.findById(goalId);
  if (!goal) throw new Error('Goal not found.');
  goal.currentValue = currentValue;
  // Auto-complete when target is reached, unless already cancelled.
  if (goal.status !== 'cancelled' && goal.targetValue > 0 && currentValue >= goal.targetValue) {
    goal.status = 'completed';
  } else if (goal.status === 'not_started' && currentValue > 0) {
    goal.status = 'in_progress';
  }
  await goal.save();
  return goal;
}

async function updateGoalStatus(goalId, status) {
  const allowed = ['not_started', 'in_progress', 'at_risk', 'completed', 'cancelled'];
  if (!allowed.includes(status)) throw new Error(`Invalid status "${status}".`);
  const goal = await Goal.findByIdAndUpdate(goalId, { status }, { new: true });
  if (!goal) throw new Error('Goal not found.');
  return goal;
}

/**
 * Lists goals for a company, optionally narrowed to one employee and/or
 * filtered by status/category. `employeeId` alone (no companyId) is the
 * shape an employee-portal "my goals" view would call.
 */
function listGoals({ companyId, employeeId, status, category } = {}) {
  const filter = {};
  if (companyId) filter.companyId = companyId;
  if (employeeId) filter.employeeId = employeeId;
  if (status) filter.status = status;
  if (category) filter.category = category;
  return Goal.find(filter).populate('employeeId', 'name designation').sort({ createdAt: -1 });
}

// --- Reviews -----------------------------------------------------------------

function createReview({ companyId, employeeId, reviewerUserId, period, overallRating, strengths, areasForImprovement, goals, cycleId }) {
  if (!employeeId) throw new Error('employeeId is required.');
  if (!reviewerUserId) throw new Error('reviewerUserId is required.');
  if (!period) throw new Error('period is required.');
  return PerformanceReview.create({
    companyId, employeeId, reviewerUserId, period,
    overallRating, strengths, areasForImprovement,
    goals: goals || [], status: 'draft', cycleId: cycleId || null,
  });
}

// --- Appraisal cycles ---------------------------------------------------------

/**
 * Starts a new appraisal cycle and bulk-creates one draft PerformanceReview
 * per active employee against it — the real "quarter-end appraisal" quick
 * win: a manager doesn't have to create 30 individual reviews by hand.
 * Each review starts in 'draft' exactly like one created the one-off way,
 * so the existing submit/acknowledge flow works unchanged per employee.
 */
async function startAppraisalCycle({ companyId, name, periodStart, periodEnd, reviewerUserId, userId }) {
  if (!name) throw new Error('Appraisal cycle name is required.');
  if (!periodStart || !periodEnd) throw new Error('periodStart and periodEnd are required.');
  if (new Date(periodStart) > new Date(periodEnd)) throw new Error('periodStart must be before periodEnd.');

  const cycle = await AppraisalCycle.create({
    companyId, name, periodStart, periodEnd, status: 'open', createdBy: userId || null,
  });

  const employees = await Employee.find({ companyId, status: 'active' });
  const reviews = await PerformanceReview.insertMany(
    employees.map((emp) => ({
      companyId, employeeId: emp._id, reviewerUserId: reviewerUserId || userId,
      period: name, cycleId: cycle._id, status: 'draft',
    }))
  );

  return { cycle, reviewsCreated: reviews.length };
}

function listAppraisalCycles(companyId) {
  return AppraisalCycle.find({ companyId }).sort({ createdAt: -1 });
}

async function closeAppraisalCycle(cycleId, companyId) {
  const cycle = await AppraisalCycle.findOneAndUpdate(
    { _id: cycleId, companyId }, { status: 'closed' }, { new: true }
  );
  if (!cycle) throw new Error('Appraisal cycle not found.');
  return cycle;
}

async function submitReview(reviewId) {
  const review = await PerformanceReview.findById(reviewId);
  if (!review) throw new Error('Performance review not found.');
  if (review.status !== 'draft') throw new Error(`Cannot submit a review with status "${review.status}".`);
  review.status = 'submitted';
  review.submittedAt = new Date();
  await review.save();
  return review;
}

/**
 * Employee-side confirmation that they've seen/read their review.
 * employeeId is required and checked against the review's own employeeId
 * so one employee cannot acknowledge another's review (this is the
 * function a portal "acknowledge my review" action would call directly).
 */
async function acknowledgeReview(reviewId, employeeId) {
  const review = await PerformanceReview.findById(reviewId);
  if (!review) throw new Error('Performance review not found.');
  if (employeeId && String(review.employeeId) !== String(employeeId)) {
    throw new Error('This review does not belong to this employee.');
  }
  if (review.status !== 'submitted') throw new Error(`Cannot acknowledge a review with status "${review.status}": it must be submitted first.`);
  review.status = 'acknowledged';
  review.acknowledgedAt = new Date();
  await review.save();
  return review;
}

function listReviews({ companyId, employeeId, status, period, cycleId } = {}) {
  const filter = {};
  if (companyId) filter.companyId = companyId;
  if (employeeId) filter.employeeId = employeeId;
  if (status) filter.status = status;
  if (period) filter.period = period;
  if (cycleId) filter.cycleId = cycleId;
  return PerformanceReview.find(filter)
    .populate('employeeId', 'name designation')
    .populate('reviewerUserId', 'name email')
    .populate('cycleId', 'name status')
    .sort({ createdAt: -1 });
}

/**
 * Aggregates one employee's active (non-completed/cancelled) goals plus
 * their most recent review rating into a single summary object — the
 * "at a glance" view for a manager dashboard or an employee portal card.
 */
async function employeeScorecard(employeeId) {
  if (!employeeId) throw new Error('employeeId is required.');

  const [allGoals, latestReview] = await Promise.all([
    Goal.find({ employeeId }).sort({ dueDate: 1 }),
    PerformanceReview.findOne({ employeeId, status: { $in: ['submitted', 'acknowledged'] } }).sort({ createdAt: -1 }),
  ]);

  const activeGoals = allGoals.filter((g) => !['completed', 'cancelled'].includes(g.status));
  const completedGoals = allGoals.filter((g) => g.status === 'completed');
  const atRiskGoals = allGoals.filter((g) => g.status === 'at_risk');

  const avgProgress = activeGoals.length
    ? Math.round(
        (activeGoals.reduce((sum, g) => sum + (g.targetValue > 0 ? Math.min(g.currentValue / g.targetValue, 1) : 0), 0) /
          activeGoals.length) * 100
      )
    : null;

  return {
    employeeId,
    totalGoals: allGoals.length,
    activeGoals: activeGoals.length,
    completedGoals: completedGoals.length,
    atRiskGoals: atRiskGoals.length,
    averageProgressPercent: avgProgress,
    latestReview: latestReview
      ? {
          _id: latestReview._id,
          period: latestReview.period,
          overallRating: latestReview.overallRating,
          status: latestReview.status,
          submittedAt: latestReview.submittedAt,
          acknowledgedAt: latestReview.acknowledgedAt,
        }
      : null,
    goals: activeGoals,
  };
}

module.exports = {
  createGoal, updateGoalProgress, updateGoalStatus, listGoals,
  createReview, submitReview, acknowledgeReview, listReviews,
  employeeScorecard,
  startAppraisalCycle, listAppraisalCycles, closeAppraisalCycle,
};
