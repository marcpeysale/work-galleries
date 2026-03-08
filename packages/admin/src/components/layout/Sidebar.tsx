import { NavLink } from 'react-router-dom';
import { Users, FolderOpen, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/projects', icon: FolderOpen, label: 'Projets' },
  { to: '/users', icon: Users, label: 'Utilisateurs' },
];

export const Sidebar = () => {
  const { user, handleLogout } = useAuth();

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-border flex flex-col min-h-screen">
      <div className="px-6 py-8 border-b border-border">
        <span className="font-display text-2xl tracking-wider text-text-primary">MARC PEYSALE</span>
        <p className="text-xs text-muted mt-1 tracking-widest uppercase">Back-office</p>
      </div>

      <nav className="flex-1 px-3 py-6">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors duration-150 mb-1 ${
                isActive
                  ? 'text-text-primary bg-elevated border-l-2 border-accent pl-[10px]'
                  : 'text-muted hover:text-text-primary hover:bg-elevated'
              }`
            }
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-5 border-t border-border">
        <p className="text-xs text-muted mb-3">
          {user?.firstName} {user?.lastName}
        </p>
        <button
          onClick={handleLogout}
          aria-label="Se déconnecter"
          className="flex items-center gap-2 text-xs text-faint hover:text-accent transition-colors"
        >
          <LogOut size={14} aria-hidden="true" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
};
