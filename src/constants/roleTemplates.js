/**
 * STARTER_ROLE_TEMPLATES — the role catalog every new company gets
 * automatically, so a business owner doesn't have to hand-build an
 * "Accountant" or "Warehouse staff" role from a blank permission list
 * the moment they want to add their first employee. These are seeded
 * once per company (see companyProvisioningService.onboardCompany and
 * roleService.ensureStarterRoles) and are ordinary Role documents after
 * that — a vendor can rename, edit, or delete them like any role they
 * built themselves; nothing here is hardcoded or protected at the model
 * level, this file only supplies sensible starting content.
 *
 * The owner/first admin account (User.roleId === null) is already
 * unrestricted per requireAuth's super-admin rule, so there is
 * deliberately no "Owner" template here — Admin below is for a second
 * full-access staff member the owner wants to add without granting them
 * the literal unrestricted null-role account.
 */
const {
  POS_SELL, SALES_VIEW, SALES_ORDER_CONVERT,
  PURCHASE_CREATE, PURCHASE_RECEIVE,
  INVENTORY_ADJUST, INVENTORY_TRANSFER,
  CATEGORIES_VIEW, CATEGORIES_CREATE, CATEGORIES_EDIT, CATEGORIES_DELETE,
  EXPENSE_SUBMIT, EXPENSE_APPROVE,
  CUSTOMER_PAYMENT_RECORD, SUPPLIER_PAYMENT_RECORD, CREDIT_NOTES_MANAGE, DEBIT_NOTES_MANAGE,
  REPORTS_VIEW, REPORTS_FINANCIAL,
  ACCOUNTS_MANAGE, USERS_MANAGE, ROLES_MANAGE,
  MANUFACTURING_MANAGE, SERVICE_ORDER_MANAGE, BANKING_MANAGE, LOYALTY_MANAGE, COUPON_MANAGE, GIFT_CARDS_MANAGE, CRM_MANAGE,
  HR_MANAGE, PAYROLL_POST,
  ECOMMERCE_MANAGE,
  DOCUMENTS_VIEW, DOCUMENTS_MANAGE, VENDOR_COMPANY_DOCUMENTS_VIEW, VENDOR_COMPANY_DOCUMENTS_MANAGE,
  FLEET_MANAGE, FIELD_SERVICE_MANAGE, QUALITY_MANAGE, CONTRACTS_MANAGE,
  LOGISTICS_MANAGE, WAREHOUSE_MANAGE, RECRUITMENT_MANAGE, PERFORMANCE_MANAGE, TIMESHEETS_LOG, TIMESHEETS_APPROVE,
  FUNNELS_MANAGE, DEVELOPER_PLATFORM_MANAGE,
  PROJECT_TASKS_MANAGE,
  TAX_PAYMENTS_VIEW, TAX_PAYMENTS_CREATE, TAX_PAYMENTS_PAY,
  ORG_ALL_BRANCHES,
} = require('./permissions');

const STARTER_ROLE_TEMPLATES = [
  {
    name: 'Admin',
    description: 'Full access to every module across all branches, for a trusted staff member who should not use the owner login.',
    permissions: ['*', ORG_ALL_BRANCHES],
  },
  {
    name: 'Manager',
    description: 'Runs day-to-day operations: sales, purchasing, inventory, staff, and reports, without financial-statement or payroll access.',
    permissions: [
      ORG_ALL_BRANCHES,
      POS_SELL, SALES_VIEW, SALES_ORDER_CONVERT,
      PURCHASE_CREATE, PURCHASE_RECEIVE,
      INVENTORY_ADJUST, INVENTORY_TRANSFER,
      CATEGORIES_VIEW, CATEGORIES_CREATE, CATEGORIES_EDIT, CATEGORIES_DELETE,
      EXPENSE_SUBMIT, EXPENSE_APPROVE,
      CUSTOMER_PAYMENT_RECORD, SUPPLIER_PAYMENT_RECORD, CREDIT_NOTES_MANAGE, DEBIT_NOTES_MANAGE,
      REPORTS_VIEW,
      USERS_MANAGE,
      MANUFACTURING_MANAGE, SERVICE_ORDER_MANAGE, LOYALTY_MANAGE, COUPON_MANAGE, GIFT_CARDS_MANAGE, CRM_MANAGE,
      DOCUMENTS_VIEW, DOCUMENTS_MANAGE,
      FLEET_MANAGE, FIELD_SERVICE_MANAGE, QUALITY_MANAGE, CONTRACTS_MANAGE,
      LOGISTICS_MANAGE, WAREHOUSE_MANAGE,
      PROJECT_TASKS_MANAGE, FUNNELS_MANAGE,
    ],
  },
  {
    name: 'Accountant',
    description: 'Financial records, payments, banking, tax, and reporting, without inventory or staff-management access.',
    permissions: [
      SALES_VIEW,
      CUSTOMER_PAYMENT_RECORD, SUPPLIER_PAYMENT_RECORD, CREDIT_NOTES_MANAGE, DEBIT_NOTES_MANAGE,
      REPORTS_VIEW, REPORTS_FINANCIAL,
      ACCOUNTS_MANAGE, BANKING_MANAGE,
      EXPENSE_SUBMIT, EXPENSE_APPROVE,
      PAYROLL_POST,
      TAX_PAYMENTS_VIEW, TAX_PAYMENTS_CREATE, TAX_PAYMENTS_PAY,
      VENDOR_COMPANY_DOCUMENTS_VIEW, VENDOR_COMPANY_DOCUMENTS_MANAGE,
      DOCUMENTS_VIEW,
    ],
  },
  {
    name: 'Cashier',
    description: 'Sells at the checkout counter and records customer payments. No access to purchasing, reports, or settings.',
    permissions: [POS_SELL, SALES_VIEW, CUSTOMER_PAYMENT_RECORD],
  },
  {
    name: 'HR',
    description: 'Manages employees, attendance, leave, payroll, recruitment, and performance reviews.',
    permissions: [
      HR_MANAGE, PAYROLL_POST, RECRUITMENT_MANAGE, PERFORMANCE_MANAGE,
      TIMESHEETS_LOG, TIMESHEETS_APPROVE,
      DOCUMENTS_VIEW, DOCUMENTS_MANAGE,
    ],
  },
  {
    name: 'Warehouse staff',
    description: 'Receives stock, adjusts and transfers inventory, and manages warehouse locations. No sales or financial access.',
    permissions: [
      INVENTORY_ADJUST, INVENTORY_TRANSFER,
      PURCHASE_RECEIVE,
      CATEGORIES_VIEW,
      WAREHOUSE_MANAGE, LOGISTICS_MANAGE, FLEET_MANAGE,
      TIMESHEETS_LOG,
    ],
  },
];

module.exports = { STARTER_ROLE_TEMPLATES };
