import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: '▦', perm: 'dashboard.view', end: true },
  { section: 'Academics' },
  { to: '/admin/semesters', label: 'Semesters & Subjects', icon: '◧', perm: 'semesters.manage' },
  { section: 'People' },
  { to: '/admin/students', label: 'Students', icon: '☺', perm: 'students.view' },
  { to: '/admin/students/import', label: 'Bulk Import', icon: '⇪', perm: 'students.import' },
  { to: '/admin/staff', label: 'Admins & Sub Admins', icon: '⛭', perm: 'subadmins.manage' },
  { section: 'Examinations' },
  { to: '/admin/questions', label: 'Question Bank', icon: '❓', perm: 'questions.view' },
  { to: '/admin/questions/import', label: 'Import Questions', icon: '📥', perm: 'questions.import' },
  { to: '/admin/exams', label: 'Examinations', icon: '✎', perm: 'exams.view' },
  { to: '/admin/results', label: 'Results', icon: '✓', perm: 'results.view' },
  { section: 'System' },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: '☰', perm: 'audit.view' },
];

export default function AdminLayout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = ADMIN_NAV.filter((n) => n.section || hasPermission(n.perm));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-200/60">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((n, i) =>
          n.section ? (
            <p key={`s${i}`} className="px-3 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {n.section}
            </p>
          ) : (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-ring ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/25'
                    : 'text-slate-600 hover:bg-white/70'
                }`
              }
            >
              <span className="w-5 text-center" aria-hidden>
                {n.icon}
              </span>
              {n.label}
            </NavLink>
          )
        )}
      </div>
      <div className="px-4 py-4 border-t border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-bold text-sm">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-700 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role?.replace('admin', ' admin')}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm w-full mt-3">
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden lg:block w-72 shrink-0 glass border-r border-white/60 sticky top-0 h-screen">{sidebar}</aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 glass-strong">{sidebar}</aside>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-40 glass border-b border-white/60 px-4 py-3 flex items-center justify-between">
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Open menu">
            ☰ Menu
          </button>
          <Logo size={30} withText={false} />
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Exit
          </button>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
