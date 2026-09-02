const { Schema, model } = require('mongoose');

// A simple free-text/markdown wiki page under a Project. Multiple docs per
// project (like ClickUp Docs) — plain textarea editing on the client, no
// rich text/WYSIWYG, no versioning.
const projectDocSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = model('ProjectDoc', projectDocSchema);
