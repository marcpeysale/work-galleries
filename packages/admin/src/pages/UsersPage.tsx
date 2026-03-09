import { useEffect, useState } from 'react';
import { Plus, UserX, UserCheck, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import type { User, CreateUserInput } from '@gallery/shared';

export const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState<CreateUserInput>({ email: '', firstName: '', lastName: '' });

  const fetchUsers = async () => {
    const data = await api.get<User[]>('/admin/users');
    setUsers(data);
  };

  useEffect(() => {
    fetchUsers().finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setActionLoading('create');
    try {
      await api.post('/admin/users', form);
      setSuccess('Utilisateur créé, invitation envoyée par email.');
      setForm({ email: '', firstName: '', lastName: '' });
      setShowForm(false);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (userId: string, suspended: boolean) => {
    setActionLoading(userId);
    try {
      const path = suspended ? `/admin/users/${userId}/activate` : `/admin/users/${userId}/suspend`;
      await api.put(path, {});
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    setActionLoading(`reset-${userId}`);
    try {
      await api.post(`/admin/users/${userId}/reset-password`, {});
      setSuccess('Email de réinitialisation envoyé.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-wrap mx-auto">
      <div className="flex items-center justify-between mb-12">
        <div>
          <p className="text-xs text-accent font-semibold tracking-widest uppercase mb-2">Gestion</p>
          <h1 className="font-display text-4xl tracking-wider">Utilisateurs</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={14} aria-hidden="true" /> Nouvel utilisateur
        </Button>
      </div>

      {(error || success) && (
        <div className={`mb-6 px-4 py-3 text-sm border ${error ? 'border-red-900/50 text-red-400 bg-red-900/10' : 'border-green-900/50 text-green-400 bg-green-900/10'}`}>
          {error || success}
        </div>
      )}

      {showForm && (
        <div className="bg-surface border border-border p-10 mb-10">
          <h2 className="font-display text-xl tracking-wider mb-8">Nouvel utilisateur</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            <Input label="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <div className="md:col-span-3 flex gap-3 mt-2">
              <Button type="submit" loading={actionLoading === 'create'}>Créer</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface border border-border">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] px-10 py-5 border-b border-border">
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Nom</span>
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Email</span>
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Statut</span>
          <span className="text-xs text-muted font-semibold tracking-widest uppercase">Actions</span>
        </div>

        {loading ? (
          <p className="px-10 py-12 text-muted text-sm">Chargement…</p>
        ) : users.length === 0 ? (
          <p className="px-10 py-12 text-muted text-sm">Aucun utilisateur.</p>
        ) : (
          users.map((user) => {
            const isSuspended = user.status === 'suspended';
            return (
              <div key={user.id} className="grid grid-cols-[1fr_1fr_1fr_auto] px-10 py-6 border-b border-border last:border-0 items-center">
                <span className="text-sm">{user.firstName} {user.lastName}</span>
                <span className="text-sm text-muted">{user.email}</span>
                <span className={`text-xs font-semibold tracking-wider uppercase ${isSuspended ? 'text-red-400' : 'text-green-400'}`}>
                  {isSuspended ? 'Suspendu' : user.status === 'pending' ? 'En attente' : 'Actif'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSuspend(user.id, isSuspended)}
                    disabled={actionLoading === user.id}
                    aria-label={isSuspended ? 'Réactiver' : 'Suspendre'}
                    title={isSuspended ? 'Réactiver' : 'Suspendre'}
                    className="p-2 text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                  >
                    {isSuspended ? <UserCheck size={15} /> : <UserX size={15} />}
                  </button>
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    disabled={actionLoading === `reset-${user.id}`}
                    aria-label="Réinitialiser le mot de passe"
                    title="Réinitialiser le mot de passe"
                    className="p-2 text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
