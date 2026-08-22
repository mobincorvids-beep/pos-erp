const { Schema, model } = require('mongoose');

// A general-purpose, event-driven notification — deliberately different
// from the messaging system CRM campaigns use (that one's for reaching
// CUSTOMERS via SMS/email). This is for STAFF, in-app, triggered
// automatically by real business events (stock dropping below reorder
// level, an approval request needing someone's attention) rather than
// something a person composes and sends deliberately.
const notificationSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  // Either a specific user, OR a role — a notification can target "the
  // person who happens to hold this role" without knowing who that is at
  // the moment it's created (e.g. "whoever can approve purchase orders
  // right now"), which a userId-only design couldn't express.
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  roleId: { type: Schema.Types.ObjectId, ref: 'Role', default: null },
  type: { type: String, required: true }, // 'low_stock', 'approval_needed', 'approval_decided', ...
  title: { type: String, required: true },
  message: { type: String, required: true },
  entityType: String, // 'Product', 'PurchaseOrder', ... — what this notification is actually about
  entityId: { type: Schema.Types.ObjectId, default: null },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ companyId: 1, userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ companyId: 1, roleId: 1, read: 1, createdAt: -1 });

module.exports = model('Notification', notificationSchema);
