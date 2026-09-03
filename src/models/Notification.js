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

// Enforces "at most one UNREAD low-stock notification per (company,
// entity, audience)" at the database level, not just in application code.
// This is what makes inventoryService.checkLowStockAndNotify's dedup safe
// against session.withTransaction()'s automatic retries: that alert is
// written without a DB session on purpose (so a notification failure can
// never fail the real sale/stock-movement it's attached to), which means
// a retried transaction attempt can't roll that write back — without this
// index, a retry re-runs the alert code and creates a second document.
// With it, a retry's write collides on the same unique key and simply
// updates the existing unread row instead (see the $setOnInsert upsert
// pattern in checkLowStockAndNotify) — idempotent no matter how many
// times the surrounding transaction is retried.
//
// Scoped to type: 'low_stock' specifically (via the partial filter, not a
// blanket rule for every notification type) — other types legitimately
// create more than one unread row against the same entity+audience, e.g.
// a second @mention notification for the same chat channel before the
// first is read, or successive approval-workflow steps against the same
// entityId. Only low-stock's "one active alert per product" semantics
// call for this constraint.
notificationSchema.index(
  { companyId: 1, entityType: 1, entityId: 1, userId: 1, roleId: 1 },
  { unique: true, partialFilterExpression: { read: false, type: 'low_stock' } }
);

module.exports = model('Notification', notificationSchema);
