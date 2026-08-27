import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext';

export function AppLayout() {
  const { company } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile-only topbar — the static sidebar (md and up) already shows
            this info, so this whole bar is hidden at md+ rather than
            duplicating it alongside the always-visible desktop sidebar. */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-rule bg-surface sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="text-ink px-1" aria-label="Open menu">
            <Menu size={20} strokeWidth={2} />
          </button>
          <p className="font-display font-bold text-base text-ink truncate">{company?.name || 'Muhasib'}</p>
        </div>

        <main className="flex-1 min-w-0 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
