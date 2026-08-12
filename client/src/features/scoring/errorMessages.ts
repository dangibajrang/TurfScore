import { ApiError } from '@/lib/apiClient';

const MESSAGES: Record<string, string> = {
  MATCH_VERSION_CONFLICT:
    'Another scoring action was recorded. Refreshing the match state — confirm before scoring again.',
  DUPLICATE_EVENT: 'That delivery was already recorded.',
  INVALID_DELIVERY: 'That delivery is not valid for the current match state.',
  INVALID_WICKET: 'That wicket combination is not allowed.',
  INVALID_BATTER: 'Selected batter is not eligible.',
  INVALID_BOWLER: 'Selected bowler is not eligible.',
  INVALID_STRIKER: 'Selected striker is not eligible.',
  INVALID_NON_STRIKER: 'Selected non-striker is not eligible.',
  BOWLER_LIMIT_REACHED: 'This bowler has reached the maximum overs for this match.',
  NEW_BATTER_REQUIRED: 'Select a replacement batter before continuing.',
  NEW_BOWLER_REQUIRED: 'Select the next bowler before continuing.',
  MATCH_NOT_LIVE: 'This match is not live.',
  INNINGS_COMPLETED: 'This innings is already complete.',
  MATCH_COMPLETED: 'This match is already complete.',
  NO_DELIVERY_TO_UNDO: 'There is no delivery to undo.',
  FORBIDDEN: 'You are not authorized to score this match.',
  AUTH_REQUIRED: 'Please sign in to continue scoring.',
  NETWORK_ERROR: 'Network error. Check your connection and try again.',
};

export function scoringErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return MESSAGES[err.code] ?? err.message;
  }
  if (err instanceof TypeError) {
    return MESSAGES.NETWORK_ERROR;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong while scoring.';
}

export function isVersionConflict(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'MATCH_VERSION_CONFLICT';
}
