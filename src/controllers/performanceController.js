const performanceService = require('../services/performanceService');

// --- Goals -----------------------------------------------------------------

async function createGoal(req, res) {
  try {
    const goal = await performanceService.createGoal({ ...req.body, companyId: req.companyId });
    res.status(201).json(goal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateGoalProgress(req, res) {
  try {
    const goal = await performanceService.updateGoalProgress(req.params.id, req.body.currentValue);
    res.json(goal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateGoalStatus(req, res) {
  try {
    const goal = await performanceService.updateGoalStatus(req.params.id, req.body.status);
    res.json(goal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listGoals(req, res) {
  try {
    const rows = await performanceService.listGoals({
      companyId: req.companyId,
      employeeId: req.query.employeeId,
      status: req.query.status,
      category: req.query.category,
    });
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Reviews -----------------------------------------------------------------

async function createReview(req, res) {
  try {
    const review = await performanceService.createReview({
      ...req.body, companyId: req.companyId, reviewerUserId: req.auth.userId,
    });
    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function submitReview(req, res) {
  try {
    const review = await performanceService.submitReview(req.params.id);
    res.json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function acknowledgeReview(req, res) {
  try {
    // employeeId may come from the request body (manager-side tooling
    // passing it explicitly) — a future employee-portal caller would
    // instead call performanceService.acknowledgeReview() directly with
    // the portal session's own employeeId.
    const review = await performanceService.acknowledgeReview(req.params.id, req.body.employeeId);
    res.json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listReviews(req, res) {
  try {
    const rows = await performanceService.listReviews({
      companyId: req.companyId,
      employeeId: req.query.employeeId,
      status: req.query.status,
      period: req.query.period,
    });
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function employeeScorecard(req, res) {
  try {
    const scorecard = await performanceService.employeeScorecard(req.params.employeeId);
    res.json(scorecard);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  createGoal, updateGoalProgress, updateGoalStatus, listGoals,
  createReview, submitReview, acknowledgeReview, listReviews,
  employeeScorecard,
};
