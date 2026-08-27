/**
 * TaskService — task-level work tracking under a Project. Everything here
 * is companyId-scoped so one company can never read/write another's tasks,
 * matching the pattern every other module's service follows.
 */
const Task = require('../models/Task');

const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

function createTask(input) {
  const { companyId, projectId, title, description, assigneeId, dueDate, priority, createdBy } = input;
  if (!projectId) throw new Error('projectId is required.');
  if (!title) throw new Error('title is required.');
  if (priority && !VALID_PRIORITIES.includes(priority)) throw new Error(`Invalid priority "${priority}".`);
  return Task.create({
    companyId, projectId, title, description, assigneeId: assigneeId || null,
    dueDate: dueDate || null, priority: priority || 'medium', createdBy: createdBy || null,
  });
}

function listTasks(companyId, projectId) {
  if (!projectId) throw new Error('projectId is required.');
  return Task.find({ companyId, projectId }).populate('assigneeId', 'name').sort({ createdAt: -1 });
}

async function updateTaskStatus(companyId, taskId, status) {
  if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status "${status}".`);
  const task = await Task.findOneAndUpdate({ _id: taskId, companyId }, { status }, { new: true });
  if (!task) throw new Error('Task not found.');
  return task;
}

async function updateTask(companyId, taskId, patch) {
  const { title, description, assigneeId, dueDate, priority } = patch;
  if (priority && !VALID_PRIORITIES.includes(priority)) throw new Error(`Invalid priority "${priority}".`);
  const update = {};
  if (title !== undefined) update.title = title;
  if (description !== undefined) update.description = description;
  if (assigneeId !== undefined) update.assigneeId = assigneeId || null;
  if (dueDate !== undefined) update.dueDate = dueDate || null;
  if (priority !== undefined) update.priority = priority;

  const task = await Task.findOneAndUpdate({ _id: taskId, companyId }, update, { new: true });
  if (!task) throw new Error('Task not found.');
  return task;
}

async function deleteTask(companyId, taskId) {
  const task = await Task.findOneAndDelete({ _id: taskId, companyId });
  if (!task) throw new Error('Task not found.');
  return task;
}

module.exports = { createTask, listTasks, updateTaskStatus, updateTask, deleteTask };
