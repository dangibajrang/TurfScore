/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './LoginPage';

function renderLogin() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  it('renders login and guest actions', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /^login$/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^register$/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^register$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeTruthy();
  });
});
