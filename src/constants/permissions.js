/**
 * Canonical permission keys. Not enforced as an enum at the DB layer
 * (Role.permissions is a free-text array so custom/industry-module
 * permissions can be added without a migration), but this is the reference
 * list for what the core API actually checks — keep it in sync when adding
 * a new requirePermission() call.
 */
const KEYS = {
  // Bypasses branch-level access restriction entirely (requireBranchAccess
  // in middleware/auth.js) — a company-wide owner/accountant needs to see
  // every branch, not be locked to whichever one their User.branchId
  // happens to point at.
  ORG_ALL_BRANCHES: 'org.all_branches',

  POS_SELL: 'pos.sell',
  SALES_VIEW: 'sales.view',
  SALES_ORDER_CONVERT: 'sales.convert_to_invoice',

  PURCHASE_CREATE: 'purchases.create',
  PURCHASE_RECEIVE: 'purchases.receive',

  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_TRANSFER: 'inventory.transfer',

  EXPENSE_SUBMIT: 'expenses.submit',
  EXPENSE_APPROVE: 'expenses.approve',

  CUSTOMER_PAYMENT_RECORD: 'customers.record_payment',
  SUPPLIER_PAYMENT_RECORD: 'suppliers.record_payment',

  REPORTS_VIEW: 'reports.view',
  REPORTS_FINANCIAL: 'reports.financial', // P&L, balance sheet, cash/bank book — more sensitive than sales/stock reports

  ACCOUNTS_MANAGE: 'accounts.manage',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',

  MANUFACTURING_MANAGE: 'manufacturing.manage',
  SERVICE_ORDER_MANAGE: 'service_orders.manage',
  BANKING_MANAGE: 'banking.manage',
  LOYALTY_MANAGE: 'loyalty.manage',
  CRM_MANAGE: 'crm.manage',

  HR_MANAGE: 'hr.manage',
  PAYROLL_POST: 'payroll.post',

  ECOMMERCE_MANAGE: 'ecommerce.manage',
};

// Human-readable catalog for the role-editor UI — grouped so checkboxes
// render as sections, not one flat list. Kept in this same file (rather
// than duplicated in the client) as the single source of truth; the client
// fetches this via GET /roles/permissions-catalog instead of hardcoding it.
const CATALOG = [
  {
    group: 'Point of sale',
    items: [
      { key: KEYS.POS_SELL, label: 'Check out sales' },
      { key: KEYS.SALES_VIEW, label: 'View sales history' },
      { key: KEYS.SALES_ORDER_CONVERT, label: 'Convert quotations/orders to invoices' },
    ],
  },
  {
    group: 'Purchasing',
    items: [
      { key: KEYS.PURCHASE_CREATE, label: 'Create purchase orders' },
      { key: KEYS.PURCHASE_RECEIVE, label: 'Receive goods (GRN)' },
    ],
  },
  {
    group: 'Inventory',
    items: [
      { key: KEYS.INVENTORY_ADJUST, label: 'Adjust stock / run stocktakes' },
      { key: KEYS.INVENTORY_TRANSFER, label: 'Transfer stock between warehouses' },
    ],
  },
  {
    group: 'Money',
    items: [
      { key: KEYS.EXPENSE_SUBMIT, label: 'Submit expenses' },
      { key: KEYS.EXPENSE_APPROVE, label: 'Approve or reject expenses' },
      { key: KEYS.CUSTOMER_PAYMENT_RECORD, label: 'Record customer payments' },
      { key: KEYS.SUPPLIER_PAYMENT_RECORD, label: 'Record supplier payments' },
      { key: KEYS.ACCOUNTS_MANAGE, label: 'Manage chart of accounts' },
    ],
  },
  {
    group: 'Reports',
    items: [
      { key: KEYS.REPORTS_VIEW, label: 'View sales/stock reports' },
      { key: KEYS.REPORTS_FINANCIAL, label: 'View financial statements (P&L, balance sheet)' },
    ],
  },
  {
    group: 'Team',
    items: [
      { key: KEYS.USERS_MANAGE, label: 'Add/manage staff accounts' },
      { key: KEYS.ROLES_MANAGE, label: 'Create/edit roles' },
      { key: KEYS.ORG_ALL_BRANCHES, label: 'Access all branches (bypasses per-branch access restriction)' },
    ],
  },
  {
    group: 'Manufacturing and services',
    items: [
      { key: KEYS.MANUFACTURING_MANAGE, label: 'Manage bills of materials and work orders' },
      { key: KEYS.SERVICE_ORDER_MANAGE, label: 'Manage service/job orders' },
    ],
  },
  {
    group: 'Banking and CRM',
    items: [
      { key: KEYS.BANKING_MANAGE, label: 'Transfer funds, reverse vouchers, reconcile accounts' },
      { key: KEYS.LOYALTY_MANAGE, label: 'Configure the loyalty program' },
      { key: KEYS.CRM_MANAGE, label: 'Create and send marketing campaigns' },
    ],
  },
  {
    group: 'HR and payroll',
    items: [
      { key: KEYS.HR_MANAGE, label: 'Manage employees, attendance, and leave' },
      { key: KEYS.PAYROLL_POST, label: 'Generate and post payroll' },
    ],
  },
  {
    group: 'Integrations',
    items: [
      { key: KEYS.ECOMMERCE_MANAGE, label: 'Configure the e-commerce integration and webhook token' },
    ],
  },
];

module.exports = { ...KEYS, CATALOG };
