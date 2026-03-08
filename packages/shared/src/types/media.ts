import type { MediaType } from './project';

export interface Media {
  id: string;
  projectId: string;
  type: MediaType;
  filename: string;
  s3Key: string;
  size: number;
  order: number;
  uploadedAt: string;
  url?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  mediaId: string;
  s3Key: string;
}

export interface ExportResponse {
  downloadUrl: string;
  expiresAt: string;
}
