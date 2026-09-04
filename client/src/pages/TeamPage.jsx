import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

export function TeamPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [tab, setTab] = useState('staff');

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="page-title mb-1.5">{t('team.title')}</p>
          <p className="text-ink-muted">{t('team.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {[['staff', t('team.staff')], ['roles', t('team.roles')]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'staff' && <StaffTab canManage={can('users.manage')} />}
      {tab === 'roles' && <RolesTab canManage={can('roles.manage')} />}
    </div>
  );
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function StaffTab({ canManage }) {
  const { t } = useTranslation();
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
      toast(user.isActive ? t('team.staffSuspended') : t('team.staffReactivated'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="card p-5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display text-lg font-semibold text-accent">{t('team.staffAccounts')}</h3>
          {canManage && <button className="btn-primary" onClick={() => setShowForm(true)}>{t('team.addStaffMember')}</button>}
        </div>

        {loading && <Loading />}
        {!loading && users.length === 0 && (
          <EmptyState title={t('team.noStaffYet')} description={t('team.noStaffDescription')} action={canManage && <button className="btn-primary" onClick={() => setShowForm(true)}>{t('team.addStaffMemberAction')}</button>} />
        )}
        {!loading && users.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {users.map((u) => (
              <div key={u._id} className="p-5 rounded-xl border border-rule hover:border-accent/50 hover:shadow-sm transition-all bg-surface-sunken/40">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center text-accent-strong font-display font-bold text-sm">
                    {initials(u.name)}
                  </div>
                  <span className={u.isActive ? 'chip-accent uppercase tracking-wider text-[10px]' : 'chip-danger uppercase tracking-wider text-[10px]'}>
                    {u.isActive ? t('team.active') : t('team.suspended')}
                  </span>
                </div>
                <h4 className="font-display text-base font-semibold text-ink mb-0.5">{u.name}</h4>
                <p className="text-xs text-ink-muted mb-4 truncate">{u.email}</p>
                <div className="space-y-2 border-t border-rule pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-ink-muted">{t('team.role')}</span>
                    {u.roleId?.name ? <span className="text-sm font-medium text-ink">{u.roleId.name}</span> : <span className="chip-neutral">{t('team.superAdmin')}</span>}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-ink-muted">{t('team.joined')}</span>
                    <span className="num text-sm font-medium text-ink">{formatDate(u.createdAt)}</span>
                  </div>
                </div>
                {canManage && (
                  <button className={`w-full mt-4 py-2 rounded-lg text-xs font-semibold transition-colors ${u.isActive ? 'bg-danger-soft text-danger hover:opacity-80' : 'bg-accent-soft text-accent-strong hover:opacity-80'}`} onClick={() => toggleActive(u)}>
                    {u.isActive ? t('team.suspend') : t('team.reactivate')}
                  </button>
                )}
              </div>
            ))}
            {canManage && (
              <button onClick={() => setShowForm(true)} className="p-5 rounded-xl border border-dashed border-rule-strong hover:border-accent/50 hover:bg-surface-sunken transition-all flex flex-col items-center justify-center text-center min-h-[220px]">
                <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center text-ink-muted mb-3">
                  <span className="text-2xl leading-none">+</span>
                </div>
                <p className="text-sm font-semibold text-accent mb-1">{t('team.addStaffMemberAction')}</p>
                <p className="text-xs text-ink-muted">{t('team.addStaffMemberHint')}</p>
              </button>
            )}
          </div>
        )}
      </div>

      {showForm && <StaffForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function StaffForm({ onClose, onSaved }) {
  const { t } = useTranslation();
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
      toast(t('team.staffMemberAdded'), 'success');
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
        <p className="font-display text-lg font-semibold text-accent mb-4">{t('team.addStaffMemberAction')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('team.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">{t('team.emailLogin')}</label><input type="email" required className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="field-label">{t('team.temporaryPassword')}</label><input type="text" required minLength={8} className="field-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('team.passwordHint')} /></div>
          <div>
            <label className="field-label">{t('team.branch')}</label>
            <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('team.unassigned')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('team.role')}</label>
            <select className="field-input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              <option value="">{t('team.noRoleFullAccess')}</option>
              {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('team.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('team.adding') : t('team.addStaffMemberAction')}</button>
        </div>
      </form>
    </div>
  );
}

function RolesTab({ canManage }) {
  const { t } = useTranslation();
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

  async function deleteRole(role) {
    if (!window.confirm(t('team.deleteRoleConfirm', { name: role.name }))) return;
    try {
      await api.del(`/roles/${role._id}`);
      toast(t('team.roleDeleted'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="card p-5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display text-lg font-semibold text-accent">{t('team.rolesAndPermissions')}</h3>
          {canManage && <button className="btn-primary" onClick={() => setShowForm(true)}>{t('team.newRole')}</button>}
        </div>

        {loading && <Loading />}
        {!loading && roles.length === 0 && (
          <EmptyState title={t('team.noCustomRolesYet')} description={t('team.noCustomRolesDescription')} action={canManage && <button className="btn-primary" onClick={() => setShowForm(true)}>{t('team.createARole')}</button>} />
        )}
        {!loading && roles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {roles.map((r) => (
              <div key={r._id} className="relative p-5 rounded-xl border border-rule hover:border-accent/50 hover:shadow-sm transition-all bg-surface-sunken/40 text-left">
                {canManage && (
                  <button
                    type="button"
                    title={t('team.deleteRole')}
                    onClick={(e) => { e.stopPropagation(); deleteRole(r); }}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-ink-muted hover:text-danger hover:bg-danger-soft transition-colors"
                  >
                    ×
                  </button>
                )}
                <button type="button" onClick={() => canManage && setEditing(r)} className="w-full text-left">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center text-accent-strong">
                      <span className="text-lg">◆</span>
                    </div>
                    <span className="chip-info uppercase tracking-wider text-[10px] mr-6">{t('team.roleLabel')}</span>
                  </div>
                  <h4 className="font-display text-base font-semibold text-ink mb-1">{r.name}</h4>
                  <p className="text-xs text-ink-muted">{r.permissions.length === 1 ? t('team.permissionGrantedOne', { count: r.permissions.length }) : t('team.permissionGrantedOther', { count: r.permissions.length })}</p>
                </button>
              </div>
            ))}
            {canManage && (
              <button onClick={() => setShowForm(true)} className="p-5 rounded-xl border border-dashed border-rule-strong hover:border-accent/50 hover:bg-surface-sunken transition-all flex flex-col items-center justify-center text-center min-h-[160px]">
                <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center text-ink-muted mb-3">
                  <span className="text-2xl leading-none">+</span>
                </div>
                <p className="text-sm font-semibold text-accent mb-1">{t('team.newRole')}</p>
                <p className="text-xs text-ink-muted">{t('team.newRoleHint')}</p>
              </button>
            )}
          </div>
        )}
      </div>

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
  const { t } = useTranslation();
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
      toast(role ? t('team.roleUpdated') : t('team.roleCreated'), 'success');
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
        <p className="font-display text-lg font-semibold text-accent mb-4">{role ? t('team.editRole') : t('team.newRole')}</p>

        <div className="mb-4">
          <label className="field-label">{t('team.roleName')}</label>
          <input required autoFocus className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('team.roleNamePlaceholder')} />
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
          <button type="button" className="btn-secondary" onClick={onClose}>{t('team.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('team.saving') : t('team.saveRole')}</button>
        </div>
      </form>
    </div>
  );
}
