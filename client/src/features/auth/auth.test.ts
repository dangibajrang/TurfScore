import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './schemas';
import { requireAccountMessage } from './authStore';

describe('auth schemas', () => {
  it('accepts valid login input', () => {
    const result = loginSchema.safeParse({
      email: 'arjun@example.com',
      password: 'Password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid login email', () => {
    const result = loginSchema.safeParse({
      email: 'bad',
      password: 'Password123',
    });
    expect(result.success).toBe(false);
  });

  it('requires matching passwords on register', () => {
    const result = registerSchema.safeParse({
      name: 'Arjun',
      email: 'arjun@example.com',
      password: 'Password123',
      confirmPassword: 'Password124',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid registration', () => {
    const result = registerSchema.safeParse({
      name: 'Arjun Kumar',
      email: 'arjun@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    expect(result.success).toBe(true);
  });
});

describe('guest messaging', () => {
  it('returns the required account message', () => {
    expect(requireAccountMessage()).toContain('Create an account');
  });
});
