import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchUserAttributes,
  confirmSignIn,
} from 'aws-amplify/auth';
import { getStoredInviteToken, clearStoredInviteToken, redeemInvite } from '../lib/invite';

interface AuthUser {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  isInvite: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ needsNewPassword: boolean }>;
  confirmNewPassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCognitoUser = async (): Promise<boolean> => {
    try {
      const current = await getCurrentUser();
      const attrs = await fetchUserAttributes();
      setUser({
        sub: current.userId,
        email: attrs['email'] ?? '',
        firstName: attrs['given_name'] ?? '',
        lastName: attrs['family_name'] ?? '',
        isInvite: false,
      });
      return true;
    } catch {
      return false;
    }
  };

  const loadInviteUser = async (): Promise<boolean> => {
    const inviteToken = getStoredInviteToken();
    if (!inviteToken) return false;
    try {
      const access = await redeemInvite(inviteToken);
      setUser({
        sub: `invite:${access.token}`,
        email: '',
        firstName: access.label || 'Espace client',
        lastName: '',
        isInvite: true,
      });
      return true;
    } catch {
      clearStoredInviteToken();
      return false;
    }
  };

  const loadUser = async () => {
    const hasCognitoSession = await loadCognitoUser();
    if (hasCognitoSession) return;
    const hasInviteSession = await loadInviteUser();
    if (hasInviteSession) return;
    setUser(null);
  };

  useEffect(() => {
    loadUser().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    clearStoredInviteToken();
    const result = await signIn({ username: email, password });
    if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      return { needsNewPassword: true };
    }
    await loadUser();
    return { needsNewPassword: false };
  };

  const confirmNewPasswordFn = async (newPassword: string) => {
    await confirmSignIn({ challengeResponse: newPassword });
    await loadUser();
  };

  const logout = async () => {
    if (user?.isInvite) {
      clearStoredInviteToken();
    } else {
      await signOut();
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, confirmNewPassword: confirmNewPasswordFn, logout, refetch: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
