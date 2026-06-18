export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type Refresher = () => Promise<string | null>;
let _refresh: Refresher | null = null;
let _logout: (() => void) | null = null;

export function configureClient(refresh: Refresher, logout: () => void): void {
  _refresh = refresh;
  _logout = logout;
}

export async function apiFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const buildHeaders = (t: string): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
    Authorization: `Bearer ${t}`,
  });

  let res = await fetch(`${API_URL}${path}`, { ...init, headers: buildHeaders(token) });

  if (res.status === 401 && _refresh) {
    const newToken = await _refresh();
    if (newToken) {
      res = await fetch(`${API_URL}${path}`, { ...init, headers: buildHeaders(newToken) });
    } else {
      _logout?.();
      throw new Error('Session expired. Please log in again.');
    }
  }

  return res;
}
