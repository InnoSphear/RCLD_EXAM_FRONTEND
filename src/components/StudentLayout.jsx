import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const NAV = [
  { to: '/student', label: 'Dashboard', icon: '▦', end: true },
  { to: '/student/exams', label: 'My Exams', icon: '✎' },
  { to: '/student/results', label: 'Results', icon: '✓' },
  { to: '/student/profile', label: 'Profile', icon: '☺' },
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const items = NAV.map((n) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-ring ${
          isActive ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/25' : 'text-slate-600 hover:bg-white/70'
        }`
      }
    >
      <span className="w-5 text-center" aria-hidden>
        {n.icon}
      </span>
      {n.label}
    </NavLink>
  ));

  const sidebarContent = (
    <nav className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-200/60">
        <Logo />
      </div>
      <div className="flex-1 px-3 py-4 space-y-1">{items}</div>
      <div className="px-4 py-4 border-t border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-bold text-sm">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-700 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.studentId}</p>
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
      <aside className="hidden lg:block w-72 shrink-0 glass border-r border-white/60 sticky top-0 h-screen">{sidebarContent}</aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 glass-strong">{sidebarContent}</aside>
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
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1200px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
