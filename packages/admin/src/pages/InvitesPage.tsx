import { useEffect, useState } from 'react';
import { Plus, Copy, Check, Ban, Link2 } from 'lucide-react';
import { api } from '../lib/api';
import { GALLERY_URL } from '../lib/amplify';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import type { Invite, Project } from '@gallery/shared';

const buildInviteUrl = (token: string) => `${GALLERY_URL}/invite/${token}`;

export const InvitesPage = () => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchData = async () => {
    const [invitesData, projectsData] = await Promise.all([
      api.get<Invite[]>('/admin/invites'),
      api.get<Project[]>('/admin/projects'),
    ]);
    setInvites(invitesData);
    setProjects(projectsData);
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  const projectName = (projectId: string) => projects.find((p) => p.id === projectId)?.name ?? projectId;

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (selectedProjectIds.length === 0) {
      setError('Sélectionnez au moins un projet');
      return;
    }
    setActionLoading(true);
    try {
      await api.post('/admin/invites', { projectIds: selectedProjectIds, label: label || undefined });
      setLabel('');
      setSelectedProjectIds([]);
      setShowForm(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = async (token: string) => {
    await navigator.clipboard.writeText(buildInviteUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken((current) => (current === token ? null : current)), 2000);
  };

  const handleRevoke = async (token: string) => {
    setRevokingToken(token);
    try {
      await api.delete(`/admin/invites/${token}`);
      await fetchData();
    } finally {
      setRevokingToken(null);
    }
  };

  return (
    <div className="max-w-wrap mx-auto">
      <div className="flex items-center justify-between mb-12">
        <div>
          <p className="text-xs text-accent font-semibold tracking-widest uppercase mb-2">Gestion</p>
          <h1 className="font-display text-4xl tracking-wider">Invitations</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={14} aria-hidden="true" /> Nouveau lien
        </Button>
      </div>

      <p className="text-sm text-muted mb-10 max-w-2xl">
        Un lien d'invitation permet à un client d'accéder directement à ses galeries sans créer de compte.
        Le lien reste valide et réutilisable tant qu'il n'est pas révoqué.
      </p>

      {showForm && (
        <div className="bg-surface border border-border p-10 mb-10">
          <h2 className="font-display text-xl tracking-wider mb-8">Nouveau lien d'invitation</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-6">
            <Input
              label="Nom (optionnel)"
              placeholder="Ex : Famille Dupont"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <div>
              <p className="text-xs text-muted font-semibold tracking-widest uppercase mb-3">Projets accessibles</p>
              {projects.length === 0 ? (
                <p className="text-sm text-faint">Aucun projet disponible.</p>
              ) : (
                <div className="bg-elevated border border-border divide-y divide-border max-h-64 overflow-auto">
                  {projects.map((project) => (
                    <label
                      key={project.id}
                      htmlFor={`invite-project-${project.id}`}
                      className="flex items-center gap-3 px-5 py-3 cursor-pointer text-sm hover:bg-surface transition-colors"
                    >
                      <input
                        id={`invite-project-${project.id}`}
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={() => toggleProject(project.id)}
                        className="accent-accent"
                      />
                      <span>{project.name}</span>
                      <span className="text-xs text-faint ml-auto">
                        {String(project.month).padStart(2, '0')}/{project.year}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" loading={actionLoading}>Générer le lien</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface border border-border">
        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] px-10 py-5 border-b border-border">
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Invitation</span>
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Projets</span>
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Utilisations</span>
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Statut</span>
          <span />
        </div>

        {loading ? (
          <p className="px-10 py-12 text-muted text-sm">Chargement…</p>
        ) : invites.length === 0 ? (
          <p className="px-10 py-12 text-muted text-sm">Aucune invitation créée pour l'instant.</p>
        ) : (
          invites.map((invite) => (
            <div key={invite.token} className="grid grid-cols-[1fr_1fr_auto_auto_auto] px-10 py-6 border-b border-border last:border-0 items-center gap-4">
              <div>
                <p className="text-sm font-medium">{invite.label || 'Sans nom'}</p>
                <p className="text-xs text-muted mt-0.5">
                  Créée le {new Date(invite.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <p className="text-xs text-muted truncate">
                {invite.projectIds.map(projectName).join(', ')}
              </p>
              <span className="text-xs text-muted">
                {invite.useCount} utilisation{invite.useCount !== 1 ? 's' : ''}
              </span>
              <span className={`text-xs font-semibold tracking-wider uppercase ${invite.revoked ? 'text-red-400' : 'text-green-400'}`}>
                {invite.revoked ? 'Révoqué' : 'Actif'}
              </span>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => handleCopy(invite.token)}
                  disabled={invite.revoked}
                  aria-label="Copier le lien d'invitation"
                  title="Copier le lien"
                  className="p-2 text-muted hover:text-text-primary transition-colors disabled:opacity-30"
                >
                  {copiedToken === invite.token ? <Check size={15} /> : <Copy size={15} />}
                </button>
                {!invite.revoked && (
                  <button
                    onClick={() => handleRevoke(invite.token)}
                    disabled={revokingToken === invite.token}
                    aria-label="Révoquer le lien"
                    title="Révoquer"
                    className="p-2 text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    <Ban size={15} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && invites.some((i) => !i.revoked) && (
        <div className="mt-10 bg-surface border border-border p-8">
          <div className="flex items-center gap-2 mb-4">
            <Link2 size={15} className="text-muted" aria-hidden="true" />
            <h2 className="font-display text-lg tracking-wider">Liens actifs</h2>
          </div>
          <div className="flex flex-col gap-3">
            {invites.filter((i) => !i.revoked).map((invite) => (
              <div key={invite.token} className="flex items-center justify-between gap-4 bg-elevated px-5 py-3">
                <code className="text-xs text-muted truncate">{buildInviteUrl(invite.token)}</code>
                <Button variant="secondary" onClick={() => handleCopy(invite.token)} className="shrink-0">
                  {copiedToken === invite.token ? <Check size={13} /> : <Copy size={13} />}
                  {copiedToken === invite.token ? 'Copié' : 'Copier'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
