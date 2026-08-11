export interface Invite {
  token: string;
  projectIds: string[];
  label?: string;
  createdAt: string;
  createdBy: string;
  revoked: boolean;
  useCount: number;
  lastUsedAt?: string;
}

export type CreateInviteInput = {
  projectIds: string[];
  label?: string;
};

export interface InviteAccess {
  token: string;
  projectIds: string[];
  label?: string;
}
