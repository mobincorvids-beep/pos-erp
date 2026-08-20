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
      <p className="text-sm text-ink-muted mb-4">Every user across every tenant company. This is platform-level moderation — a company owner manages their own staff from inside their own app.</p>

      {loading && <Loading />}
      {!loading && users.length === 0 && <EmptyState title="No users yet" />}
      {!loading && users.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Joined</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{u.email}</td>
                  <td className="px-3 py-2">{u.companyId?.name || '—'}</td>
                  <td className="px-3 py-2"><span className={u.isActive ? 'chip-accent' : 'chip-danger'}>{u.isActive ? 'active' : 'suspended'}</span></td>
                  <td className="px-3 py-2 text-ink-muted">{formatDate(u.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button className={u.isActive ? 'btn-ghost !text-danger' : 'btn-ghost !text-accent'} onClick={() => toggleActive(u)}>
                      {u.isActive ? 'Suspend' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
