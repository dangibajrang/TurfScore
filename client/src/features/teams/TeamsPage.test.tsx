/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/authStore';
import { TeamsPage } from '@/pages/TeamsPage';

describe('Phase 3 pages', () => {
  it('shows guest empty state on teams', () => {
    useAuthStore.setState({ status: 'guest', user: null });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <TeamsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/sign in to manage teams/i)).toBeTruthy();
  });
});
