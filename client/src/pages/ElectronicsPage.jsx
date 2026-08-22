import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function ElectronicsPage() {
  const [tab, setTab] = useState('check');
  return (
    <div>
      <p className="page-title mb-4">Electronics — Warranty</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['check', 'Check warranty'], ['register', 'Register warranty'], ['claims', 'Claims']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>{label}</button>
        ))}
      </div>
      {tab === 'check' && <CheckTab />}
      {tab === 'register' && <RegisterTab />}
      {tab === 'claims' && <ClaimsTab />}
    </div>
  );
}

function CheckTab() {
  const toast = useToast();
  const [serialNumber, setSerialNumber] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');

  async function check(e) {
    e.preventDefault();
    try {
      const r = await api.get(`/electronics/warranties/${serialNumber}/check`);
      setResult(r);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitClaim() {
    setSubmitting(true);
    try {
      await api.post(`/electronics/warranties/${result.warranty._id}/claims`, { issueDescription });
      toast('Claim submitted.', 'success');
      setIssueDescription('');
    } catch (err) { toast(err.message, 'error'); } finally { setSubmitting(false); }
  }

  return (
    <div className="max-w-sm">
      <form onSubmit={check} className="card p-4 mb-4">
        <label className="field-label">Serial number</label>
        <input required className="field-input mb-3" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        <button type="submit" className="btn-primary w-full">Check</button>
      </form>
      {result && !result.found && <EmptyState title="No warranty found for this serial" />}
      {result && result.found && (
        <div className="card p-4">
          <p className={result.underWarranty ? 'chip-accent' : 'chip-danger'}>{result.underWarranty ? 'Under warranty' : 'Expired'}</p>
          <p className="text-sm mt-2">{result.underWarranty ? `${result.daysRemaining} days remaining` : `Expired ${result.daysExpired} days ago`}</p>
          {result.underWarranty && (
            <>
              <div className="tear-line my-3" />
              <label className="field-label">Submit a claim</label>
              <textarea className="field-input mb-2" rows={2} value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} placeholder="Describe the issue" />
              <button className="btn-secondary w-full" disabled={!issueDescription || submitting} onClick={submitClaim}>{submitting ? 'Submitting…' : 'Submit claim'}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RegisterTab() {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ serialNumber: '', warrantyMonths: 12, customerId: '', startDate: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/electronics/warranties', { ...form, warrantyMonths: Number(form.warrantyMonths) });
      toast('Warranty registered.', 'success');
      setForm({ serialNumber: '', warrantyMonths: 12, customerId: '', startDate: '' });
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 max-w-sm">
      <div className="space-y-3">
        <div><label className="field-label">Serial number</label><input required className="field-input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></div>
        <div><label className="field-label">Customer</label><select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Select…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
        <div><label className="field-label">Warranty months</label><input type="number" className="field-input num" value={form.warrantyMonths} onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })} /></div>
        <div><label className="field-label">Start date</label><input type="date" className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full mt-4">{saving ? 'Registering…' : 'Register'}</button>
    </form>
  );
}

function ClaimsTab() {
  const toast = useToast();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/electronics/claims').then(setClaims).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  async function decide(id, approve) {
    try {
      await api.post(`/electronics/claims/${id}/decide`, { approve });
      toast(approve ? 'Approved.' : 'Rejected.', 'success');
      setClaims((prev) => prev.map((c) => c._id === id ? { ...c, status: approve ? 'approved' : 'rejected' } : c));
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (claims.length === 0) return <EmptyState title="No claims yet" />;
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide"><th className="px-3 py-2 font-medium">Issue</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium"></th></tr></thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c._id} className="border-b border-rule last:border-0">
              <td className="px-3 py-2">{c.issueDescription}</td>
              <td className="px-3 py-2"><span className="chip-neutral">{c.status}</span></td>
              <td className="px-3 py-2 text-right">{c.status === 'submitted' && <><button className="btn-ghost !text-accent" onClick={() => decide(c._id, true)}>Approve</button><button className="btn-ghost !text-danger" onClick={() => decide(c._id, false)}>Reject</button></>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
