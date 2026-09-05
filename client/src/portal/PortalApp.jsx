import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { PortalAuthProvider, usePortalAuth } from '../context/PortalAuthContext';
import { portalApi } from '../api/portalClient';

export function PortalApp() {
  return (
    <PortalAuthProvider>
      <div className="min-h-screen bg-paper">
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="activate" element={<ActivatePage />} />
          <Route path="*" element={<ProtectedPortal />} />
        </Routes>
      </div>
    </PortalAuthProvider>
  );
}

function ProtectedPortal() {
  const { isAuthenticated, loading } = usePortalAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/portal/login" replace />;
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="invoices" element={<InvoicesPage />} />
      <Route path="support" element={<SupportPage />} />
    </Routes>
  );
}

function NavLink({ label, onClick }) {
  return (
    <button
      className="text-sm font-semibold text-white/80 hover:text-white transition-colors"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Shell({ title, children }) {
  const { logout } = usePortalAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <header className="bg-accent">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            className="font-display text-lg font-bold text-white tracking-tight"
            onClick={() => navigate('/portal')}
          >
            ZAM ERP <span className="font-normal text-white/70">Customer Portal</span>
          </button>
          <nav className="flex items-center gap-5">
            <NavLink label="Dashboard" onClick={() => navigate('/portal')} />
            <NavLink label="Invoices" onClick={() => navigate('/portal/invoices')} />
            <NavLink label="Support" onClick={() => navigate('/portal/support')} />
            <button
              className="text-sm font-semibold text-white/80 hover:text-white transition-colors border-l border-white/20 pl-5"
              onClick={() => { logout(); navigate('/portal/login'); }}
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="page-title mb-5">{title}</p>
        {children}
      </div>
    </div>
  );
}

function LoginPage() {
  const { login, isAuthenticated } = usePortalAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/portal'); }, [isAuthenticated]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate('/portal');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="card p-7 w-full max-w-sm">
        <p className="eyebrow mb-2">ZAM ERP</p>
        <p className="font-display text-xl font-bold text-ink mb-1">Customer Portal</p>
        <p className="text-sm text-ink-muted mb-5">Sign in to view your invoices and account.</p>
        {error && (
          <p className="chip-danger w-full justify-start mb-3 py-2 px-3">{error}</p>
        )}
        <div className="space-y-3">
          <div>
            <label className="field-label">Email</label>
            <input type="email" required placeholder="you@example.com" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
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
      await portalApi.post('/portal-session/activate', { inviteToken, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-7 w-full max-w-sm text-center">
          <div className="chip-accent mx-auto mb-3">Activated</div>
          <p className="font-display text-lg font-bold text-ink mb-2">Account activated</p>
          <p className="text-sm text-ink-muted mb-5">You can now sign in with your new password.</p>
          <button className="btn-primary w-full" onClick={() => navigate('/portal/login')}>Go to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="card p-7 w-full max-w-sm">
        <p className="eyebrow mb-2">ZAM ERP</p>
        <p className="font-display text-xl font-bold text-ink mb-1">Set your password</p>
        <p className="text-sm text-ink-muted mb-5">Choose a password to activate your portal account.</p>
        {error && (
          <p className="chip-danger w-full justify-start mb-3 py-2 px-3">{error}</p>
        )}
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
  const { dashboard } = usePortalAuth();
  return (
    <Shell title="Dashboard">
      {!dashboard && <p className="text-sm text-ink-muted">Loading…</p>}
      {dashboard && (
        <>
          <div className="card p-5 mb-6">
            <p className="eyebrow">Outstanding balance</p>
            <p className="num text-3xl font-display font-bold text-ink mt-1">{dashboard.closingBalance}</p>
          </div>
          <p className="text-sm font-semibold text-ink mb-2">Recent invoices</p>
          <div className="card divide-y divide-rule overflow-hidden">
            {dashboard.recentInvoices.map((inv) => (
              <div key={inv._id} className="p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{inv.invoiceNumber || inv.documentNumber}</span>
                <span className="num text-sm text-ink">
                  {inv.totalAmount}{' '}
                  {inv.dueAmount > 0 && <span className="chip-danger ml-1">{inv.dueAmount} due</span>}
                </span>
              </div>
            ))}
            {dashboard.recentInvoices.length === 0 && (
              <p className="text-xs text-ink-muted p-4">No invoices yet.</p>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

function InvoicesPage() {
  const [invoices, setInvoices] = useState(null);
  useEffect(() => { portalApi.get('/portal-session/invoices').then(setInvoices).catch(() => setInvoices([])); }, []);
  return (
    <Shell title="Invoices">
      {!invoices && <p className="text-sm text-ink-muted">Loading…</p>}
      {invoices && invoices.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-muted">No invoices yet.</p>
        </div>
      )}
      {invoices && invoices.length > 0 && (
        <div className="card divide-y divide-rule overflow-hidden">
          {invoices.map((inv) => (
            <div key={inv._id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{inv.invoiceNumber || inv.documentNumber}</p>
                <p className="text-xs text-ink-muted mt-0.5">{new Date(inv.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="num text-sm text-ink">
                {inv.totalAmount}{' '}
                {inv.dueAmount > 0 && <span className="chip-danger ml-1">{inv.dueAmount} due</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function SupportPage() {
  const [form, setForm] = useState({ category: 'general', subject: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await portalApi.post('/portal-session/tickets', form);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell title="Support">
      {done ? (
        <div className="card p-6">
          <div className="chip-accent mb-3">Submitted</div>
          <p className="text-sm text-ink">Your request has been submitted — our team will get back to you.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          {error && <p className="chip-danger w-full justify-start py-2 px-3">{error}</p>}
          <div>
            <label className="field-label">Subject</label>
            <input required className="field-input" placeholder="What do you need help with?" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea required className="field-input" placeholder="Describe your issue…" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Submitting…' : 'Submit request'}</button>
        </form>
      )}
    </Shell>
  );
}
