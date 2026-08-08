const TOKEN_KEY = 'gg_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function apiBase(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (!configured) throw new Error('VITE_API_URL não configurada');

  // No celular (ou outro PC), 127.0.0.1 aponta para o próprio aparelho.
  // Se a página foi aberta pelo IP da rede, reaproveita esse host na API.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      try {
        const url = new URL(configured);
        url.hostname = host;
        return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
      } catch {
        /* usa o valor configurado */
      }
    }
  }

  return configured.replace(/\/+$/, '');
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${apiBase()}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: { error?: string; details?: unknown } | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string; details?: unknown };
    } catch {
      throw new ApiError('Resposta inválida da API', res.status);
    }
  }

  if (!res.ok) {
    throw new ApiError(data?.error || 'Falha na requisição', res.status, data?.details);
  }
  return data as T;
}
