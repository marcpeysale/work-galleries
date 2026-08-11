import { API_URL } from './amplify';
import type { InviteAccess } from '@gallery/shared';

const STORAGE_KEY = 'gallery_invite_token';

export const getStoredInviteToken = (): string | null => localStorage.getItem(STORAGE_KEY);

export const setStoredInviteToken = (token: string): void => {
  localStorage.setItem(STORAGE_KEY, token);
};

export const clearStoredInviteToken = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const redeemInvite = async (token: string): Promise<InviteAccess> => {
  const response = await fetch(`${API_URL}/invite/${token}`);
  if (!response.ok) {
    throw new Error("Ce lien d'invitation est invalide ou a été révoqué.");
  }
  return response.json();
};
