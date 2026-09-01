import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useToast } from '../../components/Toast';
import { Loading } from '../../components/Loading';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../lib/format';

export function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    adminApi.get('/admin/users').then(setUsers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggleActive(user) {
    try {
      await adminApi.post(`/admin/users/${user._id}/active`, { isActive: !user.isActive });
      toast(user.isActive ? 'User suspended.' : 'User reactivated.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <p className="page-title mb-1">Users</p>
      <p className="text-sm text-ink-muted mb-5">Every user across every tenant company. This is platform-level moderation — a company owner manages their own staff from inside their own app.</p>

      {loading && <Loading />}
      {!loading && users.length === 0 && <EmptyState title="No users yet" />}
      {!loading && users.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-sunken border-b border-rule text-left">
                  <th className="px-4 py-3 eyebrow">Name</th>
                  <th className="px-4 py-3 eyebrow">Email</th>
                  <th className="px-4 py-3 eyebrow">Company</th>
                  <th className="px-4 py-3 eyebrow">Status</th>
                  <th className="px-4 py-3 eyebrow">Joined</th>
                  <th className="px-4 py-3 eyebrow"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken transition-colors">
                    <td className="px-4 py-3 font-medium text-ink">{u.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                    <td className="px-4 py-3 text-ink">{u.companyId?.name || '—'}</td>
                    <td className="px-4 py-3"><span className={u.isActive ? 'chip-accent' : 'chip-danger'}>{u.isActive ? 'active' : 'suspended'}</span></td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button className={u.isActive ? 'btn-ghost !text-danger' : 'btn-ghost !text-accent'} onClick={() => toggleActive(u)}>
                        {u.isActive ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
