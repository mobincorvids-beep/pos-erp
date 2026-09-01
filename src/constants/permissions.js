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

  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_EDIT: 'categories.edit',
  CATEGORIES_DELETE: 'categories.delete',

  EXPENSE_SUBMIT: 'expenses.submit',
  EXPENSE_APPROVE: 'expenses.approve',

  CUSTOMER_PAYMENT_RECORD: 'customers.record_payment',
  SUPPLIER_PAYMENT_RECORD: 'suppliers.record_payment',
  CREDIT_NOTES_MANAGE: 'credit_notes.manage',
  DEBIT_NOTES_MANAGE: 'debit_notes.manage',

  REPORTS_VIEW: 'reports.view',
  REPORTS_FINANCIAL: 'reports.financial', // P&L, balance sheet, cash/bank book — more sensitive than sales/stock reports

  ACCOUNTS_MANAGE: 'accounts.manage',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',

  MANUFACTURING_MANAGE: 'manufacturing.manage',
  SERVICE_ORDER_MANAGE: 'service_orders.manage',
  BANKING_MANAGE: 'banking.manage',
  LOYALTY_MANAGE: 'loyalty.manage',
  COUPON_MANAGE: 'coupons.manage',
  GIFT_CARDS_MANAGE: 'gift_cards.manage',
  CRM_MANAGE: 'crm.manage',

  HR_MANAGE: 'hr.manage',
  PAYROLL_POST: 'payroll.post',

  ECOMMERCE_MANAGE: 'ecommerce.manage',

  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_MANAGE: 'documents.manage',
  // A deliberately STRICTER permission than the general documents ones
  // above — a supplier's tax registration, bank details, or contract, or
  // the company's own registration/tax documents, are more sensitive
  // than a routine attachment on a Sale or PurchaseOrder, and shouldn't
  // be visible to every role that can see ordinary documents.
  VENDOR_COMPANY_DOCUMENTS_VIEW: 'documents.vendor_company.view',
  VENDOR_COMPANY_DOCUMENTS_MANAGE: 'documents.vendor_company.manage',

  FLEET_MANAGE: 'fleet.manage',
  FIELD_SERVICE_MANAGE: 'field_service.manage',
  QUALITY_MANAGE: 'quality.manage',
  CONTRACTS_MANAGE: 'contracts.manage',

  LOGISTICS_MANAGE: 'logistics.manage',
  WAREHOUSE_MANAGE: 'warehouse.manage',
  RECRUITMENT_MANAGE: 'recruitment.manage',
  PERFORMANCE_MANAGE: 'performance.manage',
  TIMESHEETS_LOG: 'timesheets.log',
  TIMESHEETS_APPROVE: 'timesheets.approve',
  FUNNELS_MANAGE: 'funnels.manage',
  DEVELOPER_PLATFORM_MANAGE: 'developer_platform.manage',

  PROJECT_TASKS_MANAGE: 'project_tasks.manage',

  TAX_PAYMENTS_VIEW: 'tax_payments.view',
  TAX_PAYMENTS_CREATE: 'tax_payments.create',
  TAX_PAYMENTS_PAY: 'tax_payments.pay',
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
      { key: KEYS.CATEGORIES_VIEW, label: 'View categories' },
      { key: KEYS.CATEGORIES_CREATE, label: 'Create categories & subcategories' },
      { key: KEYS.CATEGORIES_EDIT, label: 'Edit categories & subcategories' },
      { key: KEYS.CATEGORIES_DELETE, label: 'Delete categories & subcategories' },
    ],
  },
  {
    group: 'Money',
    items: [
      { key: KEYS.EXPENSE_SUBMIT, label: 'Submit expenses' },
      { key: KEYS.EXPENSE_APPROVE, label: 'Approve or reject expenses' },
      { key: KEYS.CUSTOMER_PAYMENT_RECORD, label: 'Record customer payments' },
      { key: KEYS.SUPPLIER_PAYMENT_RECORD, label: 'Record supplier payments' },
      { key: KEYS.CREDIT_NOTES_MANAGE, label: 'Issue/void customer credit notes' },
      { key: KEYS.DEBIT_NOTES_MANAGE, label: 'Issue/void supplier debit notes' },
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
    group: 'Documents',
    items: [
      { key: KEYS.DOCUMENTS_VIEW, label: 'View attached documents (contracts, invoices, licenses...)' },
      { key: KEYS.DOCUMENTS_MANAGE, label: 'Upload/manage documents' },
      { key: KEYS.VENDOR_COMPANY_DOCUMENTS_VIEW, label: 'View SUPPLIER and COMPANY documents (tax registration, bank details, contracts — more sensitive than ordinary attachments)' },
      { key: KEYS.VENDOR_COMPANY_DOCUMENTS_MANAGE, label: 'Upload/manage SUPPLIER and COMPANY documents' },
    ],
  },
  {
    group: 'Manufacturing and services',
    items: [
      { key: KEYS.MANUFACTURING_MANAGE, label: 'Manage bills of materials and work orders' },
      { key: KEYS.SERVICE_ORDER_MANAGE, label: 'Manage service/job orders' },
      { key: KEYS.FIELD_SERVICE_MANAGE, label: 'Manage field service dispatch jobs' },
      { key: KEYS.QUALITY_MANAGE, label: 'Manage quality NCRs and corrective actions' },
    ],
  },
  {
    group: 'Fleet & contracts',
    items: [
      { key: KEYS.FLEET_MANAGE, label: 'Manage vehicles, fuel logs, and trips' },
      { key: KEYS.CONTRACTS_MANAGE, label: 'Manage contracts' },
    ],
  },
  {
    group: 'Logistics & warehouse',
    items: [
      { key: KEYS.LOGISTICS_MANAGE, label: 'Manage shipments and delivery tracking' },
      { key: KEYS.WAREHOUSE_MANAGE, label: 'Manage warehouse zones, bins, and pick waves' },
    ],
  },
  {
    group: 'Banking and CRM',
    items: [
      { key: KEYS.BANKING_MANAGE, label: 'Transfer funds, reverse vouchers, reconcile accounts' },
      { key: KEYS.LOYALTY_MANAGE, label: 'Configure the loyalty program' },
      { key: KEYS.COUPON_MANAGE, label: 'Create and manage discount coupons' },
      { key: KEYS.GIFT_CARDS_MANAGE, label: 'Issue and manage gift cards' },
      { key: KEYS.CRM_MANAGE, label: 'Create and send marketing campaigns' },
    ],
  },
  {
    group: 'HR and payroll',
    items: [
      { key: KEYS.HR_MANAGE, label: 'Manage employees, attendance, and leave' },
      { key: KEYS.PAYROLL_POST, label: 'Generate and post payroll' },
      { key: KEYS.RECRUITMENT_MANAGE, label: 'Manage job openings, candidates, and hiring' },
      { key: KEYS.PERFORMANCE_MANAGE, label: 'Manage goals and performance reviews' },
      { key: KEYS.TIMESHEETS_LOG, label: 'Log and submit own timesheets' },
      { key: KEYS.TIMESHEETS_APPROVE, label: 'Approve or reject submitted timesheets' },
    ],
  },
  {
    group: 'Tax payments',
    items: [
      { key: KEYS.TAX_PAYMENTS_VIEW, label: 'View tax payment records' },
      { key: KEYS.TAX_PAYMENTS_CREATE, label: 'Record a tax liability to pay' },
      { key: KEYS.TAX_PAYMENTS_PAY, label: 'Pay tax liability online via JazzCash' },
    ],
  },
  {
    group: 'Projects',
    items: [
      { key: KEYS.PROJECT_TASKS_MANAGE, label: 'Create, assign, and manage project tasks' },
    ],
  },
  {
    group: 'Marketing',
    items: [
      { key: KEYS.FUNNELS_MANAGE, label: 'Create, publish, and edit lead-capture landing pages' },
    ],
  },
  {
    group: 'Integrations',
    items: [
      { key: KEYS.ECOMMERCE_MANAGE, label: 'Configure the e-commerce integration and webhook token' },
      { key: KEYS.DEVELOPER_PLATFORM_MANAGE, label: 'Manage API keys and webhooks' },
    ],
  },
];

module.exports = { ...KEYS, CATALOG };
