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
    <aside className="w-72 shrink-0 bg-surface border-r border-border flex flex-col min-h-screen">
      <div className="px-8 py-10 border-b border-border">
        <span className="font-display text-2xl tracking-wider text-text-primary">MARC PEYSALE</span>
        <p className="text-xs text-muted mt-1 tracking-widest uppercase">Back-office</p>
      </div>

      <nav className="flex-1 px-4 py-8">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive }) =>
              `sidebar-nav-link flex items-center text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'is-active text-text-primary bg-elevated border-l-2 border-accent'
                  : 'text-muted hover:text-text-primary hover:bg-elevated'
              }`
            }
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user-block px-8 py-6 border-t border-border">
        <p className="text-xs text-muted">
          {user?.firstName} {user?.lastName}
        </p>
        <button
          onClick={handleLogout}
          aria-label="Se déconnecter"
          className="sidebar-logout-btn flex items-center gap-2 text-xs text-faint hover:text-accent transition-colors"
        >
          <LogOut size={14} aria-hidden="true" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
};
