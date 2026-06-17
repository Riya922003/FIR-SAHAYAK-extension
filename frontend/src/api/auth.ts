const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  full_name: string;
  phone: string;
  aadhar_number: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  station_id: string | null;
  district: string | null;
}

export async function setMyDistrict(token: string, district: string): Promise<User> {
  const res = await fetch(`${API_URL}/api/v1/auth/me/district`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ district }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to set district');
  return data;
}

export async function setMyStation(token: string, station_id: string): Promise<User> {
  const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/auth/me/station`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ station_id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to set station');
  return data;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export async function registerUser(payload: RegisterPayload): Promise<User> {
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Registration failed');
  return data;
}

export async function loginUser(payload: LoginPayload): Promise<TokenResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Invalid email or password');
  return data;
}
