import { apiRequest, setToken } from './apiClient';

export type UserRole = 'admin' | 'user';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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

export async function updateProfile(input: { name?: string; email?: string }) {
  const res = await apiRequest<{ token: string; user: User }>('/me', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  setToken(res.token);
  return res;
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  return apiRequest<{ ok: boolean }>('/me/password', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function listUsers() {
  return apiRequest<{ users: User[] }>('/admin/users');
}

export async function deleteUser(id: string) {
  return apiRequest<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' });
}
