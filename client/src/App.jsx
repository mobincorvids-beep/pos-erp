import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { ProductsPage } from './pages/ProductsPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { SalesWorkflowPage } from './pages/SalesWorkflowPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { StockTransfersPage } from './pages/StockTransfersPage';
import { StockCountsPage } from './pages/StockCountsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { TicketsPage } from './pages/TicketsPage';
import { SecurityPage } from './pages/SecurityPage';
import { RfqPage } from './pages/RfqPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { EmployeeLoansPage } from './pages/EmployeeLoansPage';
import { RecurringInvoicesPage } from './pages/RecurringInvoicesPage';
import { AgingPage } from './pages/AgingPage';
import { PeriodsPage } from './pages/PeriodsPage';
import { CostCentersPage } from './pages/CostCentersPage';
import { UnitsPage } from './pages/UnitsPage';
import { EarlyPaymentDiscountPage } from './pages/EarlyPaymentDiscountPage';
import { BankingPage } from './pages/BankingPage';
import { ReportsPage } from './pages/ReportsPage';
import { CustomersPage } from './pages/CustomersPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { TeamPage } from './pages/TeamPage';
import { HrPage } from './pages/HrPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ManufacturingPage } from './pages/ManufacturingPage';
import { ServiceOrdersPage } from './pages/ServiceOrdersPage';
import { CrmPage } from './pages/CrmPage';
import { LoyaltyPage } from './pages/LoyaltyPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { EcommercePage } from './pages/EcommercePage';
import { AiInsightsPage } from './pages/AiInsightsPage';
import { INDUSTRY_MODULES } from './industryModuleRegistry';
import { Suspense } from 'react';

import { AdminAuthProvider } from './admin/context/AdminAuthContext';
import { AdminLayout } from './admin/components/AdminLayout';
import { AdminProtectedRoute } from './admin/components/AdminProtectedRoute';
import { AdminLoginPage } from './admin/pages/AdminLoginPage';
import { AdminOverviewPage } from './admin/pages/AdminOverviewPage';
import { AdminCompaniesPage } from './admin/pages/AdminCompaniesPage';
import { AdminUsersPage } from './admin/pages/AdminUsersPage';
import { AdminAdminsPage } from './admin/pages/AdminAdminsPage';
import { AdminAuditLogPage } from './admin/pages/AdminAuditLogPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Tenant (shop) app — its own auth context/token, its own look. */}
          <Route
            element={
              <AuthProvider>
                <Outlet />
              </AuthProvider>
            }
          >
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/pos" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/sales" element={<SalesHistoryPage />} />
              <Route path="/sales-workflow" element={<SalesWorkflowPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/stock-transfers" element={<StockTransfersPage />} />
              <Route path="/stock-counts" element={<StockCountsPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/rfqs" element={<RfqPage />} />
              <Route path="/budgets" element={<BudgetsPage />} />
              <Route path="/employee-loans" element={<EmployeeLoansPage />} />
              <Route path="/recurring-invoices" element={<RecurringInvoicesPage />} />
              <Route path="/aging" element={<AgingPage />} />
              <Route path="/periods" element={<PeriodsPage />} />
              <Route path="/cost-centers" element={<CostCentersPage />} />
              <Route path="/units" element={<UnitsPage />} />
              <Route path="/early-payment-discount" element={<EarlyPaymentDiscountPage />} />
              <Route path="/banking" element={<BankingPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/hr" element={<HrPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/manufacturing" element={<ManufacturingPage />} />
              <Route path="/service-orders" element={<ServiceOrdersPage />} />
              <Route path="/crm" element={<CrmPage />} />
              <Route path="/loyalty" element={<LoyaltyPage />} />
              <Route path="/appointments" element={<AppointmentsPage />} />
              <Route path="/ecommerce" element={<EcommercePage />} />
              <Route path="/ai-insights" element={<AiInsightsPage />} />
              {INDUSTRY_MODULES.map(({ key, path, component: Component }) => (
                <Route key={key} path={path} element={<Suspense fallback={<div className="p-6 text-ink-muted text-sm">Loading…</div>}><Component /></Suspense>} />
              ))}
            </Route>
          </Route>

          {/* Platform-admin section — completely separate auth context/token
              (see admin/api.js), never mixed with the tenant app above. */}
          <Route
            element={
              <AdminAuthProvider>
                <Outlet />
              </AdminAuthProvider>
            }
          >
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              element={
                <AdminProtectedRoute>
                  <AdminLayout />
                </AdminProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminOverviewPage />} />
              <Route path="/admin/companies" element={<AdminCompaniesPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/admins" element={<AdminAdminsPage />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
