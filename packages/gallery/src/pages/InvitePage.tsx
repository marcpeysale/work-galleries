import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { redeemInvite, setStoredInviteToken } from '../lib/invite';
import { useAuth } from '../context/AuthContext';

export const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refetch } = useAuth();
  const [error, setError] = useState(() => (token ? '' : "Ce lien d'invitation est incomplet."));

  useEffect(() => {
    if (!token) return;

    redeemInvite(token)
      .then(() => {
        setStoredInviteToken(token);
        return refetch();
      })
      .then(() => navigate('/', { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Ce lien d'invitation est invalide ou a été révoqué.");
      });
  }, [token, navigate, refetch]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-display text-4xl tracking-wider text-text-primary mb-6">MARC PEYSALE</h1>
        {error ? (
          <div className="bg-surface border border-border p-8">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <p className="text-muted text-sm">Connexion à votre galerie…</p>
        )}
      </div>
    </div>
  );
};
