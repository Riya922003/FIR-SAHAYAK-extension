import type { FIR, FIRDetail } from './fir';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const authH = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const handleError = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  const detail = data.detail;
  const msg = typeof detail === 'string' ? detail
    : Array.isArray(detail) ? detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ')
    : 'Request failed';
  throw new Error(msg);
};

export async function getUnassigned(token: string): Promise<FIR[]> {
  const res = await fetch(`${API_URL}/api/v1/fir/station/unassigned`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function getMyAssigned(token: string, statusFilter?: string): Promise<FIR[]> {
  const params = statusFilter ? `?status_filter=${statusFilter}` : '';
  const res = await fetch(`${API_URL}/api/v1/fir/station/mine${params}`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function getAllStation(token: string, statusFilter?: string): Promise<FIR[]> {
  const params = statusFilter ? `?status_filter=${statusFilter}` : '';
  const res = await fetch(`${API_URL}/api/v1/fir/station/all${params}`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function getOfficerFIRDetail(token: string, firId: string): Promise<FIRDetail> {
  const res = await fetch(`${API_URL}/api/v1/fir/${firId}`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function acknowledgeFIR(token: string, firId: string): Promise<FIR> {
  const res = await fetch(`${API_URL}/api/v1/fir/${firId}/acknowledge`, {
    method: 'POST',
    headers: authH(token),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function updateFIRStatus(
  token: string,
  firId: string,
  new_status: string,
  notes?: string,
  ipc_sections?: string,
): Promise<FIR> {
  const res = await fetch(`${API_URL}/api/v1/fir/${firId}/status`, {
    method: 'PATCH',
    headers: authH(token),
    body: JSON.stringify({ new_status, notes: notes || undefined, ipc_sections: ipc_sections || undefined }),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function getStation(stationId: string): Promise<{ id: string; name: string; district: string; state: string; address: string; phone?: string }> {
  const res = await fetch(`${API_URL}/api/v1/admin/stations/${stationId}`);
  if (!res.ok) await handleError(res);
  return res.json();
}

// Transition map mirrors backend VALID_TRANSITIONS
export const OFFICER_TRANSITIONS: Record<string, string[]> = {
  acknowledged:       ['under_investigation'],
  under_investigation:['resolved', 'rejected'],
  resolved:           ['closed'],
};

export const NEXT_STATUS_LABELS: Record<string, string> = {
  under_investigation: 'Start Investigation',
  resolved:            'Mark as Resolved',
  rejected:            'Reject FIR',
  closed:              'Close / Archive Case',
};
