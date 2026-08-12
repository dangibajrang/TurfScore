import { apiRequest } from '@/lib/apiClient';

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Team = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  description: string | null;
  captainId: string | null;
  viceCaptainId: string | null;
  playerCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamPlayer = {
  id: string;
  name: string;
  role: string;
  battingStyle: string | null;
  bowlingStyle: string | null;
  profileImageUrl: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export const teamsApi = {
  list(params?: { page?: number; limit?: number; search?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    return apiRequest<Paginated<Team>>(`/api/teams${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      auth: true,
    });
  },
  create(body: { name: string; shortName?: string; description?: string; logoUrl?: string }) {
    return apiRequest<Team>('/api/teams', { method: 'POST', body, auth: true });
  },
  get(id: string) {
    return apiRequest<Team>(`/api/teams/${id}`, { method: 'GET', auth: true });
  },
  update(id: string, body: Partial<{ name: string; shortName: string; description: string; logoUrl: string }>) {
    return apiRequest<Team>(`/api/teams/${id}`, { method: 'PATCH', body, auth: true });
  },
  remove(id: string) {
    return apiRequest<{ success: boolean }>(`/api/teams/${id}`, { method: 'DELETE', auth: true });
  },
  players(id: string) {
    return apiRequest<{ items: TeamPlayer[] }>(`/api/teams/${id}/players`, {
      method: 'GET',
      auth: true,
    });
  },
  addPlayer(teamId: string, playerId: string) {
    return apiRequest<Team>(`/api/teams/${teamId}/players/${playerId}`, {
      method: 'POST',
      auth: true,
    });
  },
  removePlayer(teamId: string, playerId: string) {
    return apiRequest<Team>(`/api/teams/${teamId}/players/${playerId}`, {
      method: 'DELETE',
      auth: true,
    });
  },
  setCaptain(teamId: string, playerId: string) {
    return apiRequest<Team>(`/api/teams/${teamId}/captain`, {
      method: 'PATCH',
      body: { playerId },
      auth: true,
    });
  },
  setViceCaptain(teamId: string, playerId: string) {
    return apiRequest<Team>(`/api/teams/${teamId}/vice-captain`, {
      method: 'PATCH',
      body: { playerId },
      auth: true,
    });
  },
};
