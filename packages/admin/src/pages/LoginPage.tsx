import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, confirmNewPassword } from '../lib/auth';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { refetch } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'login' | 'new-password'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setStep('new-password');
      } else {
        await refetch();
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await confirmNewPassword(newPassword);
      await refetch();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl tracking-wider text-text-primary">MARC PEYSALE</h1>
          <p className="text-muted text-sm mt-2 tracking-widest uppercase">Administration</p>
        </div>

        <div className="bg-surface border border-border p-8">
          {step === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <Input
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button type="submit" loading={loading} className="mt-2 w-full justify-center">
                Se connecter
              </Button>
            </form>
          ) : (
            <form onSubmit={handleNewPassword} className="flex flex-col gap-5">
              <p className="text-sm text-muted">Créez votre mot de passe permanent.</p>
              <Input
                label="Nouveau mot de passe"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={10}
              />
              <Input
                label="Confirmer le mot de passe"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button type="submit" loading={loading} className="mt-2 w-full justify-center">
                Définir le mot de passe
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
