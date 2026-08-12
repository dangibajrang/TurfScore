import { apiRequest } from '@/lib/apiClient';
import type { Paginated } from '@/features/teams/teamsApi';

export type Player = {
  id: string;
  name: string;
  role: string;
  battingStyle: string | null;
  bowlingStyle: string | null;
  profileImageUrl: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  bio: string | null;
  status: string;
  primaryTeamId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PlayerTeam = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type PlayerListParams = {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  battingStyle?: string;
  bowlingStyle?: string;
};

export const playersApi = {
  list(params?: PlayerListParams) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.role) q.set('role', params.role);
    if (params?.battingStyle) q.set('battingStyle', params.battingStyle);
    if (params?.bowlingStyle) q.set('bowlingStyle', params.bowlingStyle);
    const qs = q.toString();
    return apiRequest<Paginated<Player>>(`/api/players${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      auth: true,
    });
  },
  create(body: {
    name: string;
    role?: string;
    battingStyle?: string;
    bowlingStyle?: string;
    bio?: string;
    phone?: string;
    profileImageUrl?: string;
  }) {
    return apiRequest<Player>('/api/players', { method: 'POST', body, auth: true });
  },
  get(id: string) {
    return apiRequest<Player>(`/api/players/${id}`, { method: 'GET', auth: true });
  },
  update(
    id: string,
    body: Partial<{
      name: string;
      role: string;
      battingStyle: string;
      bowlingStyle: string;
      bio: string;
      phone: string;
      profileImageUrl: string;
      status: 'ACTIVE' | 'INACTIVE';
    }>,
  ) {
    return apiRequest<Player>(`/api/players/${id}`, { method: 'PATCH', body, auth: true });
  },
  remove(id: string) {
    return apiRequest<{ success: boolean }>(`/api/players/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  },
  teams(id: string) {
    return apiRequest<{ items: PlayerTeam[] }>(`/api/players/${id}/teams`, {
      method: 'GET',
      auth: true,
    });
  },
};
