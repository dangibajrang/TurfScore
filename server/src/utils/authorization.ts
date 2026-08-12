import { Types } from 'mongoose';
import type { AuthContext } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export function assertOwnerOrAdmin(
  createdBy: Types.ObjectId | string,
  auth: AuthContext,
  message = 'You do not have permission to perform this action',
): void {
  if (auth.role === 'ADMIN') return;
  if (String(createdBy) !== auth.id) {
    throw new AppError(message, { statusCode: 403, code: 'FORBIDDEN' });
  }
}

export function parseObjectId(id: string, label = 'Resource'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`${label} not found`, { statusCode: 404, code: 'NOT_FOUND' });
  }
  return new Types.ObjectId(id);
}
