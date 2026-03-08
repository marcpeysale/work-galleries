import { signIn, signOut, getCurrentUser, fetchUserAttributes, confirmSignIn } from 'aws-amplify/auth';

export interface AuthUser {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
}

export const login = async (email: string, password: string) => {
  const result = await signIn({ username: email, password });
  return result;
};

export const confirmNewPassword = async (newPassword: string) => {
  return confirmSignIn({ challengeResponse: newPassword });
};

export const logout = async () => {
  await signOut();
};

export const getAuthUser = async (): Promise<AuthUser | null> => {
  try {
    const user = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    const groups: string[] = (attrs['custom:groups'] ?? '').split(',').filter(Boolean);
    return {
      sub: user.userId,
      email: attrs['email'] ?? '',
      firstName: attrs['given_name'] ?? '',
      lastName: attrs['family_name'] ?? '',
      groups,
    };
  } catch {
    return null;
  }
};
