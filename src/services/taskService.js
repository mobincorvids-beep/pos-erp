/**
 * TaskService — task-level work tracking under a Project. Everything here
 * is companyId-scoped so one company can never read/write another's tasks,
 * matching the pattern every other module's service follows.
 */
const Task = require('../models/Task');

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

async function createTask(input) {
  const {
    companyId, projectId, title, description, assigneeId, dueDate, priority, createdBy,
    parentTaskId, customFields, blockedByTaskIds,
  } = input;
  // Thrown as rejections (async function), not synchronously — callers
  // (controllers, and the test suite's `.rejects.toThrow(...)` assertions)
  // uniformly `await`/promise-chain these services, so a validation error
  // must surface the same way a DB error would: as a rejected promise.
  if (!projectId) throw new Error('projectId is required.');
  if (!title) throw new Error('title is required.');
  if (priority && !VALID_PRIORITIES.includes(priority)) throw new Error(`Invalid priority "${priority}".`);
  return Task.create({
    companyId, projectId, title, description, assigneeId: assigneeId || null,
    dueDate: dueDate || null, priority: priority || 'medium', createdBy: createdBy || null,
    parentTaskId: parentTaskId || null,
    customFields: customFields || [],
    blockedByTaskIds: blockedByTaskIds || [],
  });
}

async function listTasks(companyId, projectId) {
  if (!projectId) throw new Error('projectId is required.');
  return Task.find({ companyId, projectId })
    .populate('assigneeId', 'name')
    .populate('blockedByTaskIds', 'title status')
    .sort({ createdAt: -1 });
}

/** Subtasks (checklist items) of a task — plain top-level Tasks with parentTaskId set. */
async function listSubtasks(companyId, parentTaskId) {
  if (!parentTaskId) throw new Error('parentTaskId is required.');
  return Task.find({ companyId, parentTaskId }).sort({ createdAt: 1 });
}

async function updateTaskStatus(companyId, taskId, status) {
  if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status "${status}".`);
  const task = await Task.findOneAndUpdate({ _id: taskId, companyId }, { status }, { new: true });
  if (!task) throw new Error('Task not found.');
  return task;
}

async function updateTask(companyId, taskId, patch) {
  const { title, description, assigneeId, dueDate, priority, customFields, blockedByTaskIds } = patch;
  if (priority && !VALID_PRIORITIES.includes(priority)) throw new Error(`Invalid priority "${priority}".`);
  const update = {};
  if (title !== undefined) update.title = title;
  if (description !== undefined) update.description = description;
  if (assigneeId !== undefined) update.assigneeId = assigneeId || null;
  if (dueDate !== undefined) update.dueDate = dueDate || null;
  if (priority !== undefined) update.priority = priority;
  if (customFields !== undefined) update.customFields = customFields;
  if (blockedByTaskIds !== undefined) update.blockedByTaskIds = blockedByTaskIds;

  const task = await Task.findOneAndUpdate({ _id: taskId, companyId }, update, { new: true });
  if (!task) throw new Error('Task not found.');
  return task;
}

async function deleteTask(companyId, taskId) {
  const task = await Task.findOneAndDelete({ _id: taskId, companyId });
  if (!task) throw new Error('Task not found.');
  // Subtasks lose their parent rather than cascading — keeps deletes cheap
  // and avoids surprising bulk-deletes of a whole checklist.
  await Task.updateMany({ companyId, parentTaskId: taskId }, { parentTaskId: null });
  return task;
}

module.exports = { createTask, listTasks, listSubtasks, updateTaskStatus, updateTask, deleteTask, VALID_STATUSES };
