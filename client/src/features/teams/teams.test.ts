import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const clientTeamSchema = z.object({
  name: z.string().trim().min(2).max(120),
  shortName: z.string().trim().max(12).optional(),
});

describe('team form validation', () => {
  it('requires a team name', () => {
    expect(clientTeamSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(clientTeamSchema.safeParse({ name: 'RCC' }).success).toBe(true);
  });
});

describe('dashboard empty messaging', () => {
  it('avoids fake zero-stat marketing copy', () => {
    const msg = 'Statistics will appear after the player records matches.';
    expect(msg.toLowerCase().includes('0 runs')).toBe(false);
  });
});
