import { NavLink, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

const NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/companies', label: 'Companies' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/admins', label: 'Admins' },
  { to: '/admin/audit-logs', label: 'Audit log' },
];

export function AdminLayout() {
  const { admin, logout } = useAdminAuth();

  return (
    <div className="min-h-screen bg-paper">
      {/* Near-black strip, unique to this section — the one deliberate
          visual break from the shop app's light paper background, so
          there's never a moment's doubt which mode you're in. */}
      <div className="bg-ink text-paper">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 md:py-0 md:h-12 flex flex-col md:flex-row md:items-center gap-2 md:gap-0 md:justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <p className="font-display text-base leading-none">ZAM ERP <span className="text-white/50 font-sans text-xs align-middle ml-1">Platform Admin</span></p>
            <nav className="flex gap-1 flex-wrap">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `px-2.5 py-1 text-sm rounded ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <span className="truncate">{admin?.name} · <span className="uppercase text-xs">{admin?.role}</span></span>
            <button onClick={logout} className="hover:text-white shrink-0">Sign out</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <Outlet />
      </div>
    </div>
  );
}
