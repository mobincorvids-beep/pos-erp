import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { EmployeePortalAuthProvider, useEmployeePortalAuth } from '../context/EmployeePortalAuthContext';
import { employeePortalApi } from '../api/employeePortalClient';

export function EmployeePortalApp() {
  return (
    <EmployeePortalAuthProvider>
      <div className="min-h-screen bg-paper">
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="activate" element={<ActivatePage />} />
          <Route path="*" element={<ProtectedPortal />} />
        </Routes>
      </div>
    </EmployeePortalAuthProvider>
  );
}

function ProtectedPortal() {
  const { isAuthenticated, loading } = useEmployeePortalAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-ink-muted">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/employee-portal/login" replace />;
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="attendance" element={<AttendancePage />} />
      <Route path="payslips" element={<PayslipsPage />} />
      <Route path="leave" element={<LeavePage />} />
      <Route path="profile" element={<ProfilePage />} />
    </Routes>
  );
}

const NAV_ITEMS = [
  { to: '/employee-portal', label: 'Dashboard', icon: 'space_dashboard', end: true },
  { to: '/employee-portal/attendance', label: 'Attendance', icon: 'event_available' },
  { to: '/employee-portal/payslips', label: 'Payslips', icon: 'receipt_long' },
  { to: '/employee-portal/leave', label: 'Leave', icon: 'flight_takeoff' },
  { to: '/employee-portal/profile', label: 'Profile', icon: 'person' },
];

function Shell({ title, children }) {
  const { logout } = useEmployeePortalAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-surface">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Employee Portal</p>
            <p className="page-title mt-0.5">{title}</p>
          </div>
          <button className="btn-ghost" onClick={() => { logout(); navigate('/employee-portal/login'); }}>
            <span className="material-symbols-outlined text-base font-icon">logout</span>
            Log out
          </button>
        </div>
        <nav className="max-w-3xl mx-auto px-4 flex gap-1.5 overflow-x-auto pb-3">
          {NAV_ITEMS.map((item) => {
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={active ? 'pill-active whitespace-nowrap' : 'pill whitespace-nowrap'}
              >
                <span className="material-symbols-outlined text-base font-icon mr-1">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function LoginPage() {
  const { login, isAuthenticated } = useEmployeePortalAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/employee-portal'); }, [isAuthenticated]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate('/employee-portal');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="eyebrow mb-2">Employee Portal</p>
        <p className="page-title mb-1">Sign in</p>
        <p className="text-sm text-ink-muted mb-5">Sign in to view your attendance, payslips, and leave.</p>
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
      await employeePortalApi.post('/employee-portal-session/activate', { inviteToken, password });
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
          <span className="material-symbols-outlined text-4xl font-icon text-accent mb-2 block">check_circle</span>
          <p className="page-title mb-2">Account activated</p>
          <p className="text-sm text-ink-muted mb-4">You can now sign in with your new password.</p>
          <button className="btn-primary w-full" onClick={() => navigate('/employee-portal/login')}>Go to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="page-title mb-1">Set your password</p>
        <p className="text-sm text-ink-muted mb-5">Choose a password to activate your employee portal account.</p>
        {error && <p className="text-sm text-danger mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="field-label">New password</label>
            <input type="password" required minLength={8} placeholder="At least 8 characters" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Confirm password</label>
            <input type="password" required minLength={8} placeholder="Repeat password" className="field-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full mt-5">{submitting ? 'Activating…' : 'Activate account'}</button>
      </form>
    </div>
  );
}

function statusChipClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'present' || s === 'approved') return 'chip-accent';
  if (s === 'late' || s === 'pending') return 'chip-warning';
  if (s === 'absent' || s === 'rejected') return 'chip-danger';
  return 'chip-neutral';
}

function DashboardPage() {
  const { dashboard } = useEmployeePortalAuth();
  return (
    <Shell title="Dashboard">
      {!dashboard && <p className="text-sm text-ink-muted">Loading…</p>}
      {dashboard && (
        <>
          <div className="card p-5 mb-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center font-display font-bold text-lg shrink-0">
              {(dashboard.profile.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="eyebrow">Name</p>
              <p className="font-display text-lg font-bold text-ink mt-0.5">{dashboard.profile.name}</p>
              <p className="text-sm text-ink-muted mt-0.5">{dashboard.profile.designation} &middot; <span className="capitalize">{dashboard.profile.status}</span></p>
            </div>
          </div>

          <p className="eyebrow mb-3">Recent attendance</p>
          <div className="space-y-2">
            {dashboard.recentAttendance.map((a) => (
              <div key={a._id} className="card p-3.5 flex items-center justify-between">
                <span className="text-sm text-ink">{new Date(a.date).toLocaleDateString()}</span>
                <span className={statusChipClass(a.status) + ' capitalize'}>{a.status}</span>
              </div>
            ))}
            {dashboard.recentAttendance.length === 0 && (
              <div className="card p-6 text-center">
                <p className="text-sm text-ink-muted">No attendance recorded yet.</p>
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

function AttendancePage() {
  const [attendance, setAttendance] = useState(null);
  useEffect(() => { employeePortalApi.get('/employee-portal-session/attendance').then(setAttendance).catch(() => setAttendance([])); }, []);
  return (
    <Shell title="Attendance">
      {!attendance && <p className="text-sm text-ink-muted">Loading…</p>}
      {attendance && attendance.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-muted">No attendance recorded for this month.</p>
        </div>
      )}
      {attendance && attendance.length > 0 && (
        <div className="space-y-2">
          {attendance.map((a) => (
            <div key={a._id} className="card p-3.5 flex items-center justify-between">
              <span className="text-sm text-ink">{new Date(a.date).toLocaleDateString()}</span>
              <span className={statusChipClass(a.status) + ' capitalize'}>{a.status}</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function PayslipsPage() {
  const [payslips, setPayslips] = useState(null);
  useEffect(() => { employeePortalApi.get('/employee-portal-session/payslips').then(setPayslips).catch(() => setPayslips([])); }, []);
  return (
    <Shell title="Payslips">
      {!payslips && <p className="text-sm text-ink-muted">Loading…</p>}
      {payslips && payslips.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-muted">No payslips yet.</p>
        </div>
      )}
      {payslips && payslips.length > 0 && (
        <div className="space-y-2">
          {payslips.map((p) => (
            <div key={p.payrollRunId} className="card p-3.5 flex items-center justify-between">
              <span className="text-sm text-ink">{p.month}/{p.year}</span>
              <span className="num text-sm font-semibold text-ink">{p.netPay}</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function LeavePage() {
  const [requests, setRequests] = useState(null);
  const [form, setForm] = useState({ fromDate: '', toDate: '', type: 'annual', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function load() {
    employeePortalApi.get('/employee-portal-session/leave-requests').then(setRequests).catch(() => setRequests([]));
  }
  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await employeePortalApi.post('/employee-portal-session/leave-requests', form);
      setForm({ fromDate: '', toDate: '', type: 'annual', reason: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell title="Leave">
      <form onSubmit={handleSubmit} className="card p-4 space-y-3 mb-6">
        <p className="eyebrow">Request leave</p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="field-label">From</label>
            <input type="date" required className="field-input" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
          </div>
          <div className="flex-1">
            <label className="field-label">To</label>
            <input type="date" required className="field-input" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="field-label">Type</label>
          <select className="field-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="annual">Annual</option>
            <option value="sick">Sick</option>
            <option value="unpaid">Unpaid</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="field-label">Reason (optional)</label>
          <textarea className="field-input" placeholder="Reason (optional)" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Submitting…' : 'Request leave'}</button>
      </form>

      <p className="eyebrow mb-3">My requests</p>
      {!requests && <p className="text-sm text-ink-muted">Loading…</p>}
      {requests && requests.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-muted">No leave requests yet.</p>
        </div>
      )}
      {requests && requests.length > 0 && (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r._id} className="card p-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm text-ink">{new Date(r.fromDate).toLocaleDateString()} – {new Date(r.toDate).toLocaleDateString()}</p>
                <p className="text-xs text-ink-muted capitalize mt-0.5">{r.type}</p>
              </div>
              <span className={statusChipClass(r.status) + ' capitalize'}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    employeePortalApi.get('/employee-portal-session/profile').then((p) => { setProfile(p); setPhone(p.phone || ''); });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSaved(false);
    try {
      const updated = await employeePortalApi.patch('/employee-portal-session/profile', { phone, ...(email ? { email } : {}) });
      setProfile(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell title="Profile">
      {!profile && <p className="text-sm text-ink-muted">Loading…</p>}
      {profile && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          {saved && <p className="text-sm text-accent">Saved.</p>}
          <div>
            <p className="field-label">Name</p>
            <p className="text-sm text-ink">{profile.name}</p>
          </div>
          <div>
            <p className="field-label">Designation</p>
            <p className="text-sm text-ink">{profile.designation || '—'}</p>
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Update login email</label>
            <input type="email" className="field-input" placeholder="Leave blank to keep current" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Saving…' : 'Save changes'}</button>
        </form>
      )}
    </Shell>
  );
}
