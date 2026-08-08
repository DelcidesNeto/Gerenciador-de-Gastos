import { apiRequest } from './apiClient';

export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export async function register(input: { name: string; email: string; password: string }) {
  return apiRequest<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function login(input: { email: string; password: string }) {
  return apiRequest<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logout() {
  return apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

export async function getMe() {
  return apiRequest<{ user: User }>('/me');
}
