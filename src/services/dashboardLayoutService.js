/**
 * DashboardLayoutService — persistence for one user's chosen dashboard
 * widget arrangement. One layout per (companyId, userId); "save" is
 * really an upsert/replace of that single document, not a growing list.
 */
const DashboardLayout = require('../models/DashboardLayout');

async function getLayout(companyId, userId) {
  const layout = await DashboardLayout.findOne({ companyId, userId });
  return layout || { companyId, userId, widgets: [] }; // no saved layout yet — hand back an empty default rather than 404ing
}

async function saveLayout(companyId, userId, widgets) {
  if (!Array.isArray(widgets)) throw new Error('widgets must be an array.');
  for (const w of widgets) {
    if (!w.widgetType) throw new Error('Every widget must have a widgetType.');
  }
  return DashboardLayout.findOneAndUpdate(
    { companyId, userId },
    { $set: { widgets } },
    { new: true, upsert: true },
  );
}

module.exports = { getLayout, saveLayout };
