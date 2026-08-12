import { describe, expect, it } from 'vitest';
import { tokens } from './tokens';

describe('design tokens', () => {
  it('keeps TurfScore primary green', () => {
    expect(tokens.primary.toLowerCase()).toBe('#35d05f');
  });

  it('keeps deep navy background', () => {
    expect(tokens.background.toLowerCase()).toBe('#06151a');
  });
});
