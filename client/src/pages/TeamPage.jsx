import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

export function TeamPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('staff');

  return (
    <div>
      <p className="page-title mb-4">Team</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['staff', 'Staff'], ['roles', 'Roles']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'staff' && <StaffTab canManage={can('users.manage')} />}
      {tab === 'roles' && <RolesTab canManage={can('roles.manage')} />}
    </div>
  );
}

function StaffTab({ canManage }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/users').then(setUsers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggleActive(user) {
    try {
      await api.patch(`/users/${user._id}/active`, { isActive: !user.isActive });
      toast(user.isActive ? 'Staff member suspended.' : 'Staff member reactivated.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      {canManage && (
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowForm(true)}>Add staff member</button>
        </div>
      )}

      {loading && <Loading />}
      {!loading && users.length === 0 && (
        <EmptyState title="No staff yet" description="Add cashiers, managers, and other staff who need to log into this counter." action={canManage && <button className="btn-primary" onClick={() => setShowForm(true)}>Add staff member</button>} />
      )}
      {!loading && users.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Joined</th>
                {canManage && <th className="px-3 py-2 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{u.email}</td>
                  <td className="px-3 py-2">{u.roleId?.name || <span className="chip-neutral">Super-admin</span>}</td>
                  <td className="px-3 py-2"><span className={u.isActive ? 'chip-accent' : 'chip-danger'}>{u.isActive ? 'active' : 'suspended'}</span></td>
                  <td className="px-3 py-2 text-ink-muted">{formatDate(u.createdAt)}</td>
                  {canManage && (
                    <td className="px-3 py-2 text-right">
                      <button className={u.isActive ? 'btn-ghost !text-danger' : 'btn-ghost !text-accent'} onClick={() => toggleActive(u)}>
                        {u.isActive ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <StaffForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function StaffForm({ onClose, onSaved }) {
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', branchId: '', roleId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/roles').then(setRoles).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', { ...form, branchId: form.branchId || undefined, roleId: form.roleId || undefined });
      toast('Staff member added.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Add staff member</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Email (their login)</label><input type="email" required className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="field-label">Temporary password</label><input type="text" required minLength={8} className="field-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters — they should change it after first login" /></div>
          <div>
            <label className="field-label">Branch</label>
            <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Unassigned</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Role</label>
            <select className="field-input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              <option value="">No role (full access — use carefully)</option>
              {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding…' : 'Add staff member'}</button>
        </div>
      </form>
    </div>
  );
}

function RolesTab({ canManage }) {
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    api.get('/roles').then(setRoles).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);
  useEffect(() => { api.get('/roles/permissions-catalog').then(setCatalog).catch(() => {}); }, []);

  return (
    <div>
      {canManage && (
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowForm(true)}>New role</button>
        </div>
      )}

      {loading && <Loading />}
      {!loading && roles.length === 0 && (
        <EmptyState title="No custom roles yet" description="Roles let you give staff exactly the access they need — a cashier who can sell but not see financial reports, for example." action={canManage && <button className="btn-primary" onClick={() => setShowForm(true)}>Create a role</button>} />
      )}
      {!loading && roles.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {roles.map((r) => (
            <button key={r._id} onClick={() => canManage && setEditing(r)} className="card p-3 text-left hover:border-accent transition-colors">
              <p className="text-sm font-medium">{r.name}</p>
              <p className="text-xs text-ink-muted mt-1">{r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'} granted</p>
            </button>
          ))}
        </div>
      )}

      {(showForm || editing) && (
        <RoleForm
          role={editing}
          catalog={catalog}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function RoleForm({ role, catalog, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(role?.name || '');
  const [permissions, setPermissions] = useState(new Set(role?.permissions || []));
  const [saving, setSaving] = useState(false);

  function toggle(key) {
    setPermissions((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, permissions: Array.from(permissions) };
      if (role) await api.patch(`/roles/${role._id}`, payload);
      else await api.post('/roles', payload);
      toast(role ? 'Role updated.' : 'Role created.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">{role ? 'Edit role' : 'New role'}</p>

        <div className="mb-4">
          <label className="field-label">Role name</label>
          <input required autoFocus className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cashier, Manager" />
        </div>

        <div className="space-y-4 mb-4">
          {catalog.map((group) => (
            <div key={group.group}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">{group.group}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={permissions.has(item.key)} onChange={() => toggle(item.key)} />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save role'}</button>
        </div>
      </form>
    </div>
  );
}
