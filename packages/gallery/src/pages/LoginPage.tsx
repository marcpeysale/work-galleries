import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, confirmNewPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [step, setStep] = useState<'login' | 'new-password'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.needsNewPassword) {
        setStep('new-password');
      } else {
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
    if (newPassword !== confirmPwd) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await confirmNewPassword(newPassword);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du mot de passe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl tracking-wider text-text-primary">MARC PEYSALE</h1>
          <p className="text-muted text-sm mt-3 tracking-widest uppercase">Votre galerie privée</p>
        </div>

        <div className="bg-surface border border-border p-8">
          {step === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
              <Field label="Mot de passe" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <SubmitButton loading={loading}>Accéder à ma galerie</SubmitButton>
            </form>
          ) : (
            <form onSubmit={handleNewPassword} className="flex flex-col gap-5">
              <p className="text-sm text-muted leading-relaxed">
                Bienvenue ! Créez votre mot de passe personnel pour sécuriser votre accès.
              </p>
              <Field label="Nouveau mot de passe" type="password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" minLength={10} />
              <Field label="Confirmer le mot de passe" type="password" value={confirmPwd} onChange={setConfirmPwd} autoComplete="new-password" />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <SubmitButton loading={loading}>Confirmer</SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({
  label, type, value, onChange, autoComplete, minLength,
}: {
  label: string; type: string; value: string; onChange: (v: string) => void;
  autoComplete?: string; minLength?: number;
}) => {
  const id = label.toLowerCase().replace(/\s/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold tracking-widest uppercase text-muted">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        className="w-full bg-elevated border border-border focus:border-accent px-4 py-2.5 text-sm text-text-primary placeholder:text-faint outline-none transition-colors"
      />
    </div>
  );
};

const SubmitButton = ({ loading, children }: { loading: boolean; children: string }) => (
  <button
    type="submit"
    disabled={loading}
    className="mt-2 w-full bg-accent hover:bg-accent-hover text-white text-xs font-semibold tracking-widest uppercase py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
  >
    {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />}
    {children}
  </button>
);
