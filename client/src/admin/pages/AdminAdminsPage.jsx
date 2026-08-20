import { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminApi } from '../api';
import { useToast } from '../../components/Toast';

export function AdminAdminsPage() {
  const { admin } = useAdminAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', role: 'support' });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminApi.post('/admin/auth/admins', form);
      setResult(res);
      toast('Admin created.', 'success');
      setForm({ name: '', email: '', role: 'support' });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (admin?.role !== 'admin') {
    return (
      <div>
        <p className="page-title mb-1">Platform admins</p>
        <p className="text-sm text-ink-muted">Only an admin-role account can create other platform admins — you're signed in as support (read-only).</p>
      </div>
    );
  }

  return (
    <div>
      <p className="page-title mb-1">Platform admins</p>
      <p className="text-sm text-ink-muted mb-6">Create another platform admin — this is the in-app path so <code className="num">npm run seed:admin</code> only has to run once, ever.</p>

      <div className="grid grid-cols-2 gap-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="card p-4">
          <div className="space-y-3">
            <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="field-label">Email</label><input type="email" required className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div>
              <label className="field-label">Role</label>
              <select className="field-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="support">Support (read-only)</option>
                <option value="admin">Admin (full access)</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full mt-4">{saving ? 'Creating…' : 'Create admin'}</button>
        </form>

        {result && (
          <div className="card p-4">
            <p className="text-sm font-medium mb-2">{result.admin.name} is ready</p>
            <p className="text-sm mb-1"><span className="text-ink-muted">Login email:</span> {result.admin.email}</p>
            <p className="text-sm mb-3"><span className="text-ink-muted">Temporary password:</span> <span className="num">{result.generatedPassword}</span></p>
            <p className="text-xs text-ink-muted">Shown once — copy it now. They should change it after first login (no self-service change yet — use reset if needed).</p>
          </div>
        )}
      </div>
    </div>
  );
}
