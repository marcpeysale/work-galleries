import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Project } from '@gallery/shared';
import { PROJECT_STATUS_LABELS } from '@gallery/shared';
import { ImageIcon, Video, ArrowRight, LogOut } from 'lucide-react';

export const ProjectsPage = () => {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Project[]>('/gallery/projects')
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border px-8 py-6 md:px-14 flex items-center justify-between">
        <span className="font-display text-2xl tracking-wider">MARC PEYSALE</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted py-3 px-1">{user?.firstName} {user?.lastName}</span>
          <button
            onClick={logout}
            aria-label="Se déconnecter"
            className="flex items-center gap-2 text-xs text-faint hover:text-accent transition-colors uppercase tracking-widest py-3 px-4 rounded-md hover:bg-elevated"
          >
            <LogOut size={13} aria-hidden="true" /> Déconnexion
          </button>
        </div>
      </header>

      <main className="px-8 py-14 md:px-14 md:py-16 max-w-wrap mx-auto">
        <div className="mb-12 pt-2 pb-4">
          <p className="text-xs text-accent font-semibold tracking-widest uppercase mb-3">Mes galeries</p>
          <h1 className="font-display text-5xl tracking-wider">Vos projets</h1>
        </div>

        {loading ? (
          <p className="text-muted text-sm">Chargement…</p>
        ) : projects.length === 0 ? (
          <div className="border border-border p-14 md:p-20 text-center">
            <p className="text-muted">Aucun projet disponible pour l'instant.</p>
            <p className="text-faint text-sm mt-2">Votre galerie sera accessible dès que Marc aura livré votre projet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const ProjectCard = ({ project }: { project: Project }) => (
  <Link
    to={`/projects/${project.id}`}
    aria-label={`Ouvrir le projet ${project.name}`}
    className="group bg-surface border border-border hover:border-accent/40 transition-colors p-10 flex flex-col gap-5"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="font-semibold text-text-primary group-hover:text-accent transition-colors">{project.name}</p>
        <p className="text-xs text-muted mt-1">
          {String(project.month).padStart(2, '0')}/{project.year}
        </p>
      </div>
      <ArrowRight size={16} className="text-faint group-hover:text-accent transition-colors mt-0.5" aria-hidden="true" />
    </div>

    <div className="flex items-center gap-3">
      {project.mediaTypes.includes('photo') && (
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <ImageIcon size={12} aria-hidden="true" /> Photos
        </span>
      )}
      {project.mediaTypes.includes('video') && (
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Video size={12} aria-hidden="true" /> Vidéos
        </span>
      )}
    </div>

    <span className={`self-start text-xs font-semibold tracking-wider uppercase px-2.5 py-0.5 ${
      project.status === 'delivered' ? 'bg-green-900/40 text-green-300' : 'bg-elevated text-muted'
    }`}>
      {PROJECT_STATUS_LABELS[project.status]}
    </span>
  </Link>
);
