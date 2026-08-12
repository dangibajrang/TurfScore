/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchCreatePage } from '@/pages/MatchCreatePage';
import { MatchesPage } from '@/pages/MatchesPage';
import { useAuthStore } from '@/features/auth/authStore';
import { validateTeamsStep, validateTossStep, createInitialWizardState } from './schemas';
import { buildRulePreset, defaultMaxOversPerBowler } from './rulePresets';

describe('match wizard helpers', () => {
  it('builds 10-over preset defaults', () => {
    const rules = buildRulePreset('10');
    expect(rules.overs).toBe(10);
    expect(rules.maxOversPerBowler).toBe(2);
    expect(defaultMaxOversPerBowler(20)).toBe(4);
  });

  it('validates teams and toss', () => {
    const state = createInitialWizardState();
    expect(validateTeamsStep(state)).toBeTruthy();
    state.teamAId = 'a';
    state.teamBId = 'a';
    expect(validateTeamsStep(state)).toMatch(/different/i);
    state.teamBId = 'b';
    expect(validateTeamsStep(state)).toBeNull();
    expect(validateTossStep(state)).toBeTruthy();
    state.tossWinnerId = 'a';
    state.tossDecision = 'BAT';
    expect(validateTossStep(state)).toBeNull();
  });
});

describe('match pages', () => {
  it('renders create wizard step 1', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        id: '1',
        name: 'Test',
        email: 't@example.com',
        role: 'USER',
        profileImage: null,
      },
    });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <MatchCreatePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/match details/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
  });

  it('shows guest empty state on matches list', () => {
    useAuthStore.setState({ status: 'guest', user: null });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <MatchesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/sign in to manage matches/i)).toBeTruthy();
  });
});
