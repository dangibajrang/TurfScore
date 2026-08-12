export const scoringKeys = {
  all: ['scoring'] as const,
  state: (matchId: string) => ['scoring', matchId, 'state'] as const,
  scorecard: (matchId: string) => ['scoring', matchId, 'scorecard'] as const,
  match: (matchId: string) => ['match', matchId] as const,
};
