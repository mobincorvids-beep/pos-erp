const { Schema, model } = require('mongoose');

// A unit of work under a Project — the missing task-level layer beneath
// Project's name/budget/status. Follows the same companyId+index,
// ref+enum, timestamps pattern as every other module (see EmployeeLoan).
const taskSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, default: 'todo', enum: ['todo', 'in_progress', 'done'] },
  assigneeId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
  dueDate: { type: Date, default: null },
  priority: { type: String, default: 'medium', enum: ['low', 'medium', 'high'] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = model('Task', taskSchema);
