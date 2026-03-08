export type UserRole = 'admin' | 'client';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  projectIds: string[];
}

export type CreateUserInput = {
  email: string;
  firstName: string;
  lastName: string;
};

export interface ApiError {
  message: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
}
