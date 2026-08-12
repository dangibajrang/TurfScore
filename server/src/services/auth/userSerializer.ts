import type { Types } from 'mongoose';
import type { UserRole } from '../../models/User.js';

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profileImage: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type UserLike = {
  _id: Types.ObjectId | string;
  name: string;
  email: string;
  role: UserRole;
  profileImageUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

/** Never include passwordHash or refresh secrets */
export function toSafeUser(user: UserLike): SafeUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImageUrl ?? null,
    ...(user.createdAt ? { createdAt: user.createdAt.toISOString() } : {}),
    ...(user.updatedAt ? { updatedAt: user.updatedAt.toISOString() } : {}),
  };
}
