import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { StatusBadge } from '../components/ui/Badge';
import type { Project, CreateProjectInput } from '@gallery/shared';
import { PROJECT_STATUS_LABELS } from '@gallery/shared';

const MONTHS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];

const YEARS = Array.from({ length: 6 }, (_, i) => {
  const y = new Date().getFullYear() - 1 + i;
  return { value: String(y), label: String(y) };
});

const STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label }));

const emptyForm = (): CreateProjectInput => ({
  name: '',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  status: 'created',
  clientInfo: { firstName: '', lastName: '', email: '', phone: '' },
  mediaTypes: [],
});

export const ProjectsPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateProjectInput>(emptyForm());
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    const data = await api.get<Project[]>('/admin/projects');
    setProjects(data);
  };

  useEffect(() => {
    fetchProjects().finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setActionLoading(true);
    try {
      await api.post('/admin/projects', form);
      setForm(emptyForm());
      setShowForm(false);
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-wrap mx-auto">
      <div className="flex items-center justify-between mb-12">
        <div>
          <p className="text-xs text-accent font-semibold tracking-widest uppercase mb-2">Gestion</p>
          <h1 className="font-display text-4xl tracking-wider">Projets</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={14} aria-hidden="true" /> Nouveau projet
        </Button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border p-10 mb-10">
          <h2 className="font-display text-xl tracking-wider mb-8">Nouveau projet</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <Input label="Nom du projet" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <Select
                label="Mois"
                options={MONTHS}
                value={String(form.month)}
                onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
              />
              <Select
                label="Année"
                options={YEARS}
                value={String(form.year)}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              />
              <Select
                label="Statut"
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}
              />
            </div>

            <div>
              <p className="text-xs text-muted font-semibold tracking-widest uppercase mb-3">Informations client</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Prénom" value={form.clientInfo.firstName} onChange={(e) => setForm({ ...form, clientInfo: { ...form.clientInfo, firstName: e.target.value } })} required />
                <Input label="Nom" value={form.clientInfo.lastName} onChange={(e) => setForm({ ...form, clientInfo: { ...form.clientInfo, lastName: e.target.value } })} required />
                <Input label="Email" type="email" value={form.clientInfo.email} onChange={(e) => setForm({ ...form, clientInfo: { ...form.clientInfo, email: e.target.value } })} required />
                <Input label="Téléphone" type="tel" value={form.clientInfo.phone ?? ''} onChange={(e) => setForm({ ...form, clientInfo: { ...form.clientInfo, phone: e.target.value } })} />
              </div>
            </div>

            <div>
              <p className="text-xs text-muted font-semibold tracking-widest uppercase mb-3">Types de médias</p>
              <div className="flex gap-6">
                {(['photo', 'video'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer text-sm text-muted hover:text-text-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={form.mediaTypes.includes(type)}
                      onChange={(e) => setForm({
                        ...form,
                        mediaTypes: e.target.checked
                          ? [...form.mediaTypes, type]
                          : form.mediaTypes.filter((t) => t !== type),
                      })}
                      className="accent-accent"
                    />
                    {type === 'photo' ? 'Photos' : 'Vidéos'}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" loading={actionLoading}>Créer le projet</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface border border-border">
        <div className="grid grid-cols-[1fr_auto_auto_auto] px-10 py-5 border-b border-border">
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Projet</span>
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Date</span>
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Statut</span>
          <span />
        </div>

        {loading ? (
          <p className="px-10 py-12 text-muted text-sm">Chargement…</p>
        ) : projects.length === 0 ? (
          <p className="px-10 py-12 text-muted text-sm">Aucun projet.</p>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="grid grid-cols-[1fr_auto_auto_auto] px-10 py-6 border-b border-border last:border-0 items-center gap-4">
              <div>
                <p className="text-sm font-medium">{project.name}</p>
                <p className="text-xs text-muted mt-0.5">{project.clientInfo.firstName} {project.clientInfo.lastName}</p>
              </div>
              <span className="text-xs text-muted">{String(project.month).padStart(2, '0')}/{project.year}</span>
              <StatusBadge status={project.status} label={PROJECT_STATUS_LABELS[project.status]} />
              <Link
                to={`/projects/${project.id}`}
                aria-label={`Voir le projet ${project.name}`}
                className="p-3 text-muted hover:text-accent transition-colors rounded-md hover:bg-elevated -mr-1"
              >
                <ArrowRight size={15} />
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
