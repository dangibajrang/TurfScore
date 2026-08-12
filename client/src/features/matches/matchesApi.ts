import { apiRequest } from '@/lib/apiClient';
import type { CreateMatchPayload, MatchDto } from './types';

export type PaginatedMatches = {
  items: MatchDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const matchesApi = {
  list(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    teamId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    if (params?.teamId) q.set('teamId', params.teamId);
    if (params?.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params?.dateTo) q.set('dateTo', params.dateTo);
    const qs = q.toString();
    return apiRequest<PaginatedMatches>(`/api/matches${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      auth: true,
    });
  },
  get(id: string) {
    return apiRequest<MatchDto>(`/api/matches/${id}`, { method: 'GET', auth: true });
  },
  create(payload: CreateMatchPayload) {
    return apiRequest<MatchDto>('/api/matches', { method: 'POST', body: payload, auth: true });
  },
  update(id: string, payload: Partial<CreateMatchPayload>) {
    return apiRequest<MatchDto>(`/api/matches/${id}`, {
      method: 'PATCH',
      body: payload,
      auth: true,
    });
  },
  remove(id: string) {
    return apiRequest<{ success: boolean }>(`/api/matches/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  },
  start(id: string) {
    return apiRequest<MatchDto>(`/api/matches/${id}/start`, {
      method: 'POST',
      body: {},
      auth: true,
    });
  },
  cancel(id: string) {
    return apiRequest<MatchDto>(`/api/matches/${id}/cancel`, {
      method: 'POST',
      body: {},
      auth: true,
    });
  },
  abandon(id: string) {
    return apiRequest<MatchDto>(`/api/matches/${id}/abandon`, {
      method: 'POST',
      body: {},
      auth: true,
    });
  },
};
