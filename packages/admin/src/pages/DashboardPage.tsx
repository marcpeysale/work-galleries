import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Users, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Project, User } from '@gallery/shared';
import { PROJECT_STATUS_LABELS } from '@gallery/shared';
import { StatusBadge } from '../components/ui/Badge';

export const DashboardPage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Project[]>('/admin/projects'),
      api.get<User[]>('/admin/users'),
    ])
      .then(([p, u]) => { setProjects(p); setUsers(u); })
      .finally(() => setLoading(false));
  }, []);

  const recentProjects = projects.slice(0, 5);
  const activeProjects = projects.filter((p) => p.status === 'in-progress' || p.status === 'post-shooting');

  return (
    <div className="p-8 max-w-wrap mx-auto">
      <div className="mb-10">
        <p className="text-xs text-accent font-semibold tracking-widest uppercase mb-2">Tableau de bord</p>
        <h1 className="font-display text-4xl tracking-wider text-text-primary">
          Bonjour, {user?.firstName}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <StatCard icon={FolderOpen} label="Projets total" value={loading ? '—' : String(projects.length)} />
        <StatCard icon={FolderOpen} label="En cours" value={loading ? '—' : String(activeProjects.length)} />
        <StatCard icon={Users} label="Clients" value={loading ? '—' : String(users.length)} />
      </div>

      <div className="bg-surface border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl tracking-wider">Projets récents</h2>
          <Link to="/projects" className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors uppercase tracking-widest font-semibold">
            Voir tout <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <p className="text-muted text-sm">Chargement…</p>
        ) : recentProjects.length === 0 ? (
          <p className="text-muted text-sm">Aucun projet pour l'instant.</p>
        ) : (
          <div className="divide-y divide-border">
            {recentProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between py-3.5">
                <div>
                  <Link to={`/projects/${project.id}`} className="text-sm font-medium hover:text-accent transition-colors">
                    {project.name}
                  </Link>
                  <p className="text-xs text-muted mt-0.5">
                    {project.clientInfo.firstName} {project.clientInfo.lastName} — {String(project.month).padStart(2, '0')}/{project.year}
                  </p>
                </div>
                <StatusBadge status={project.status} label={PROJECT_STATUS_LABELS[project.status]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: typeof FolderOpen; label: string; value: string }) => (
  <div className="bg-surface border border-border p-6">
    <div className="flex items-center gap-3 mb-3">
      <Icon size={16} className="text-accent" aria-hidden="true" />
      <span className="text-xs text-muted font-semibold tracking-widest uppercase">{label}</span>
    </div>
    <p className="font-display text-3xl tracking-wider">{value}</p>
  </div>
);
