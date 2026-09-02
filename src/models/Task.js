const { Schema, model } = require('mongoose');

// A unit of work under a Project — the missing task-level layer beneath
// Project's name/budget/status. Follows the same companyId+index,
// ref+enum, timestamps pattern as every other module (see EmployeeLoan).
const customFieldSchema = new Schema({
  key: { type: String, required: true },
  value: { type: String, default: '' },
}, { _id: false });

const taskSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  // 'review' added alongside todo/in_progress/done for a ClickUp-style
  // Kanban board (four board-friendly stages instead of three).
  status: { type: String, default: 'todo', enum: ['todo', 'in_progress', 'review', 'done'] },
  assigneeId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
  dueDate: { type: Date, default: null },
  priority: { type: String, default: 'medium', enum: ['low', 'medium', 'high'] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // Subtasks: same self-referencing parentId pattern as Category.parentId.
  // A task with a non-null parentTaskId is a subtask/checklist item of
  // another task rather than a top-level board card.
  parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
  // Lightweight custom fields — plain key/value text, no field-type system.
  customFields: { type: [customFieldSchema], default: [] },
  // Dependencies: this task cannot reasonably start until every task
  // listed here is done. Enforced only as a UI warning, never a hard
  // block (see taskController/taskService — status changes are not
  // rejected when a blocker is incomplete).
  blockedByTaskIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Task' }], default: [] },
}, { timestamps: true });

module.exports = model('Task', taskSchema);
