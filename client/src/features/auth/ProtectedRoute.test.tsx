/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from './authStore';

describe('ProtectedRoute', () => {
  it('redirects anonymous users to login', () => {
    useAuthStore.setState({ status: 'anonymous', user: null });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Login screen')).toBeTruthy();
    expect(screen.queryByText('Secret dashboard')).toBeNull();
  });

  it('allows authenticated users', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        id: '1',
        name: 'Arjun',
        email: 'arjun@example.com',
        role: 'USER',
        profileImage: null,
      },
    });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Secret dashboard')).toBeTruthy();
  });
});
