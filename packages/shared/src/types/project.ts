export type ProjectStatus =
  | 'created'
  | 'in-progress'
  | 'post-shooting'
  | 'delivered'
  | 'archived';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  'created': 'Créé',
  'in-progress': 'En cours',
  'post-shooting': 'Post-traitement',
  'delivered': 'Livré',
  'archived': 'Archivé',
};

export type MediaType = 'photo' | 'video';

export interface ClientInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
}

export interface Project {
  id: string;
  name: string;
  month: number;
  year: number;
  status: ProjectStatus;
  clientInfo: ClientInfo;
  mediaTypes: MediaType[];
  createdAt: string;
  updatedAt: string;
}

export type CreateProjectInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateProjectInput = Partial<CreateProjectInput>;
