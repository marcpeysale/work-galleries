import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchUserAttributes,
  confirmSignIn,
} from 'aws-amplify/auth';

interface AuthUser {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ needsNewPassword: boolean }>;
  confirmNewPassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const current = await getCurrentUser();
      const attrs = await fetchUserAttributes();
      setUser({
        sub: current.userId,
        email: attrs['email'] ?? '',
        firstName: attrs['given_name'] ?? '',
        lastName: attrs['family_name'] ?? '',
      });
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    loadUser().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
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
    await signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, confirmNewPassword: confirmNewPasswordFn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
