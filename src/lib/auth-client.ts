'use client';

import type { AppSession, AppUser, AuthResult } from '@/lib/auth-types';

const request = async <T>(url: string, init?: RequestInit): Promise<AuthResult<T>> => {
  try {
    const response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    const result = await response.json();
    if (!response.ok) return { data: result, error: result.error || { message: 'Authentication request failed.' } };
    return { data: result, error: null };
  } catch (error) {
    return {
      data: null as T,
      error: { message: error instanceof Error ? error.message : 'Authentication request failed.' },
    };
  }
};

export const authClient = {
  async getSession(): Promise<AuthResult<{ session: AppSession | null }>> {
    return request('/api/auth/session');
  },
  async getUser(): Promise<AuthResult<{ user: AppUser | null }>> {
    return request('/api/auth/session');
  },
  async refreshSession(): Promise<AuthResult<{ session: AppSession | null }>> {
    return this.getSession();
  },
  async signInWithPassword(credentials: { email: string; password: string }) {
    return request<{ user: AppUser; session: AppSession }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  async signOut() {
    const result = await request<Record<string, never>>('/api/auth/session', { method: 'DELETE' });
    return { error: result.error };
  },
  async updateUser(attributes: { password?: string; data?: Record<string, unknown> }) {
    return request<{ user: AppUser }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify(attributes),
    });
  },
  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
    return request<Record<string, never>>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, redirectTo: options?.redirectTo }),
    }).then(({ error }) => ({ error }));
  },
  onAuthStateChange(callback: (event: string, session: AppSession | null) => void) {
    let active = true;
    this.getSession().then(({ data }) => {
      if (active) callback('INITIAL_SESSION', data.session);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => { active = false; },
        },
      },
    };
  },
};

export type BrowserAuthClient = typeof authClient;
