import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { PortalAuthProvider, usePortalAuth } from '../context/PortalAuthContext';
import { portalApi } from '../api/portalClient';

export function PortalApp() {
  return (
    <PortalAuthProvider>
      <div className="min-h-screen bg-ink/[0.02]">
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
  if (loading) return <div className="p-8 text-center text-sm text-ink-muted">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/portal/login" replace />;
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="invoices" element={<InvoicesPage />} />
      <Route path="support" element={<SupportPage />} />
    </Routes>
  );
}

function Shell({ title, children }) {
  const { logout } = usePortalAuth();
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <p className="font-display text-lg">{title}</p>
        <div className="flex gap-3 text-sm">
          <button className="text-accent" onClick={() => navigate('/portal')}>Dashboard</button>
          <button className="text-accent" onClick={() => navigate('/portal/invoices')}>Invoices</button>
          <button className="text-accent" onClick={() => navigate('/portal/support')}>Support</button>
          <button className="text-red-600" onClick={() => { logout(); navigate('/portal/login'); }}>Log out</button>
        </div>
      </div>
      {children}
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
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-xl mb-1">Customer Portal</p>
        <p className="text-sm text-ink-muted mb-5">Sign in to view your invoices and account.</p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="space-y-3">
          <input type="email" required placeholder="Email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" required placeholder="Password" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full mt-4">{submitting ? 'Signing in…' : 'Sign in'}</button>
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
        <div className="card p-6 w-full max-w-sm text-center">
          <p className="font-display text-lg mb-2">Account activated</p>
          <p className="text-sm text-ink-muted mb-4">You can now sign in with your new password.</p>
          <button className="btn-primary w-full" onClick={() => navigate('/portal/login')}>Go to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-xl mb-1">Set your password</p>
        <p className="text-sm text-ink-muted mb-5">Choose a password to activate your portal account.</p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="space-y-3">
          <input type="password" required minLength={8} placeholder="New password" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" required minLength={8} placeholder="Confirm password" className="field-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full mt-4">{submitting ? 'Activating…' : 'Activate account'}</button>
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
          <div className="card p-4 mb-4">
            <p className="text-xs text-ink-muted">Outstanding balance</p>
            <p className="num text-2xl font-display mt-1">{dashboard.closingBalance}</p>
          </div>
          <p className="text-sm font-medium mb-2">Recent invoices</p>
          <div className="space-y-2">
            {dashboard.recentInvoices.map((inv) => (
              <div key={inv._id} className="card p-3 flex justify-between">
                <span className="text-sm">{inv.invoiceNumber || inv.documentNumber}</span>
                <span className="num text-sm">{inv.totalAmount} {inv.dueAmount > 0 && <span className="text-red-600">({inv.dueAmount} due)</span>}</span>
              </div>
            ))}
            {dashboard.recentInvoices.length === 0 && <p className="text-xs text-ink-muted">No invoices yet.</p>}
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
      {invoices && invoices.length === 0 && <p className="text-sm text-ink-muted">No invoices yet.</p>}
      {invoices && invoices.length > 0 && (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div key={inv._id} className="card p-3 flex justify-between">
              <div>
                <p className="text-sm font-medium">{inv.invoiceNumber || inv.documentNumber}</p>
                <p className="text-xs text-ink-muted">{new Date(inv.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="num text-sm">{inv.totalAmount} {inv.dueAmount > 0 && <span className="text-red-600">({inv.dueAmount} due)</span>}</span>
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
        <div className="card p-4 text-sm">Your request has been submitted — our team will get back to you.</div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input required className="field-input" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea required className="field-input" placeholder="Describe your issue…" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Submitting…' : 'Submit request'}</button>
        </form>
      )}
    </Shell>
  );
}
