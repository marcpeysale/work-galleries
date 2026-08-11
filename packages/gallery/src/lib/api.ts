import { fetchAuthSession } from 'aws-amplify/auth';
import { API_URL } from './amplify';
import { getStoredInviteToken } from './invite';

const getToken = async (): Promise<string> => {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error('Non authentifié');
  return token;
};

const resolvePath = (path: string, inviteToken: string | null): string => {
  if (inviteToken && path.startsWith('/gallery/')) {
    return `/invite/${inviteToken}${path.slice('/gallery'.length)}`;
  }
  return path;
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const inviteToken = getStoredInviteToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (!inviteToken) {
    headers.Authorization = `Bearer ${await getToken()}`;
  }

  const response = await fetch(`${API_URL}${resolvePath(path, inviteToken)}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erreur réseau' }));
    throw new Error(error.message ?? `Erreur ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
};

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};
