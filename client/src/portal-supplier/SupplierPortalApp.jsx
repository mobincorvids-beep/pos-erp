import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { SupplierPortalAuthProvider, useSupplierPortalAuth } from '../context/SupplierPortalAuthContext';
import { supplierPortalApi } from '../api/supplierPortalClient';

export function SupplierPortalApp() {
  return (
    <SupplierPortalAuthProvider>
      <div className="min-h-screen bg-paper font-sans text-ink">
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="activate" element={<ActivatePage />} />
          <Route path="*" element={<ProtectedPortal />} />
        </Routes>
      </div>
    </SupplierPortalAuthProvider>
  );
}

function ProtectedPortal() {
  const { isAuthenticated, loading } = useSupplierPortalAuth();
  if (loading) return <div className="p-8 text-center text-sm text-ink-muted">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/supplier-portal/login" replace />;
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
      <Route path="payments" element={<PaymentsPage />} />
    </Routes>
  );
}

function Shell({ title, children }) {
  const { logout } = useSupplierPortalAuth();
  const navigate = useNavigate();
  const isActive = (path) =>
    path === '/supplier-portal'
      ? window.location.pathname === '/supplier-portal' || window.location.pathname === '/supplier-portal/'
      : window.location.pathname.startsWith(path);

  const navItems = [
    { label: 'Dashboard', path: '/supplier-portal' },
    { label: 'Purchase Orders', path: '/supplier-portal/purchase-orders' },
    { label: 'Payments', path: '/supplier-portal/payments' },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-surface">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <p className="eyebrow">Supplier Portal</p>
            <p className="page-title text-xl mt-0.5">{title}</p>
          </div>
          <button className="btn-ghost" onClick={() => { logout(); navigate('/supplier-portal/login'); }}>
            Log out
          </button>
        </div>
        <nav className="max-w-2xl mx-auto px-4 flex gap-2 pb-3">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={isActive(item.path) ? 'pill-active' : 'pill'}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}

function LoginPage() {
  const { login, isAuthenticated } = useSupplierPortalAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/supplier-portal'); }, [isAuthenticated]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate('/supplier-portal');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="page-title text-xl mb-1">Supplier Portal</p>
        <p className="text-sm text-ink-muted mb-5">Sign in to view your purchase orders and payments.</p>
        {error && <p className="text-sm text-danger mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="field-label">Email</label>
            <input type="email" required placeholder="you@company.com" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input type="password" required placeholder="••••••••" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full mt-5">{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function ActivatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await supplierPortalApi.post('/supplier-portal-session/activate', { inviteToken, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
        <div className="card p-6 w-full max-w-sm text-center">
          <p className="page-title text-lg mb-2">Account activated</p>
          <p className="text-sm text-ink-muted mb-4">You can now sign in with your new password.</p>
          <button className="btn-primary w-full" onClick={() => navigate('/supplier-portal/login')}>Go to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="page-title text-xl mb-1">Set your password</p>
        <p className="text-sm text-ink-muted mb-5">Choose a password to activate your supplier portal account.</p>
        {error && <p className="text-sm text-danger mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="field-label">New password</label>
            <input type="password" required minLength={8} placeholder="••••••••" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Confirm password</label>
            <input type="password" required minLength={8} placeholder="••••••••" className="field-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full mt-5">{submitting ? 'Activating…' : 'Activate account'}</button>
      </form>
    </div>
  );
}

function DashboardPage() {
  const { dashboard } = useSupplierPortalAuth();
  return (
    <Shell title="Dashboard">
      {!dashboard && <p className="text-sm text-ink-muted">Loading…</p>}
      {dashboard && (
        <>
          <div className="card p-5 mb-6">
            <p className="eyebrow">Outstanding balance owed to you</p>
            <p className="num text-3xl font-display font-bold text-ink mt-1.5">{dashboard.closingBalance}</p>
          </div>
          <p className="text-sm font-semibold text-ink mb-2">Recent purchase orders</p>
          <div className="space-y-2">
            {dashboard.recentOrders.map((po) => (
              <div key={po._id} className="card p-4 flex justify-between items-center">
                <span className="text-sm text-ink">
                  {po.poNumber} <span className="chip-neutral ml-1.5">{po.status}</span>
                </span>
                <span className="num text-sm text-ink">
                  {po.totalAmount}{' '}
                  {po.dueAmount > 0 && <span className="chip-danger ml-1">{po.dueAmount} due</span>}
                </span>
              </div>
            ))}
            {dashboard.recentOrders.length === 0 && <p className="text-xs text-ink-muted">No purchase orders yet.</p>}
          </div>
        </>
      )}
    </Shell>
  );
}

function PurchaseOrdersPage() {
  const [orders, setOrders] = useState(null);
  useEffect(() => { supplierPortalApi.get('/supplier-portal-session/purchase-orders').then(setOrders).catch(() => setOrders([])); }, []);
  return (
    <Shell title="Purchase Orders">
      {!orders && <p className="text-sm text-ink-muted">Loading…</p>}
      {orders && orders.length === 0 && <p className="text-sm text-ink-muted">No purchase orders yet.</p>}
      {orders && orders.length > 0 && (
        <div className="space-y-2">
          {orders.map((po) => (
            <div key={po._id} className="card p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-ink">{po.poNumber}</p>
                <p className="text-xs text-ink-muted mt-0.5">{po.status} · {new Date(po.orderDate || po.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="num text-sm text-ink">
                {po.totalAmount}{' '}
                {po.dueAmount > 0 && <span className="chip-danger ml-1">{po.dueAmount} due</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function PaymentsPage() {
  const [ledger, setLedger] = useState(null);
  useEffect(() => { supplierPortalApi.get('/supplier-portal-session/payments').then(setLedger).catch(() => setLedger({ entries: [], closingBalance: 0 })); }, []);
  return (
    <Shell title="Payments">
      {!ledger && <p className="text-sm text-ink-muted">Loading…</p>}
      {ledger && (
        <>
          <div className="card p-5 mb-6">
            <p className="eyebrow">Closing balance</p>
            <p className="num text-3xl font-display font-bold text-ink mt-1.5">{ledger.closingBalance}</p>
          </div>
          {(!ledger.entries || ledger.entries.length === 0) && <p className="text-sm text-ink-muted">No payment history yet.</p>}
          {ledger.entries && ledger.entries.length > 0 && (
            <div className="space-y-2">
              {ledger.entries.map((entry, i) => (
                <div key={entry._id || i} className="card p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-ink">{entry.type || entry.description || 'Entry'}</p>
                    <p className="text-xs text-ink-muted mt-0.5">{new Date(entry.date || entry.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="num text-sm text-ink">{entry.amount ?? entry.debit ?? entry.credit}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
