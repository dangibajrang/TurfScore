export type UserRole = 'USER' | 'ADMIN';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profileImage: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};
