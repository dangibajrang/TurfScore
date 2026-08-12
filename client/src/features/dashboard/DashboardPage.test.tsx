/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '@/pages/DashboardPage';
import { useAuthStore } from '@/features/auth/authStore';

describe('DashboardPage', () => {
  it('shows guest empty state', () => {
    useAuthStore.setState({ status: 'guest', user: null });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/guest dashboard/i)).toBeTruthy();
    expect(screen.getByText(/sign in to see live metrics/i)).toBeTruthy();
  });
});
