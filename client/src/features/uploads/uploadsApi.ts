import { apiRequest } from '@/lib/apiClient';

export type UploadImageResult = {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
};

export const uploadsApi = {
  uploadImage(file: File) {
    const body = new FormData();
    body.append('image', file);
    return apiRequest<UploadImageResult>('/api/uploads/image', {
      method: 'POST',
      body,
      auth: true,
    });
  },
};
