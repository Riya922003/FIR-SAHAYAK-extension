import type { FIR, IncidentType } from './fir';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const authH = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const handleError = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  const detail = data.detail;
  throw new Error(
    typeof detail === 'string' ? detail
    : Array.isArray(detail) ? detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ')
    : 'Request failed',
  );
};

export interface DistrictStats {
  total_stations: number;
  total_active_firs: number;
  pending_escalations: number;
  resolved_this_month: number;
}

export interface StationHealth {
  id: string;
  name: string;
  district: string;
  state: string;
  address: string;
  phone: string | null;
  pending: number;
  escalated: number;
  investigating: number;
  overdue: number;
  total_active: number;
}

export async function getDistrictStats(token: string): Promise<DistrictStats> {
  const res = await fetch(`${API}/api/v1/authority/district/stats`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function getDistrictStations(token: string): Promise<StationHealth[]> {
  const res = await fetch(`${API}/api/v1/authority/district/stations`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}

export interface EscalationItem {
  fir_id: string;
  fir_number: string;
  complainant_name: string;
  incident_type: IncidentType;
  incident_location: string;
  station_id: string;
  station_name: string;
  escalated_at: string;
  reason: string;
  days_pending: number;
}

export async function getDistrictEscalations(token: string): Promise<EscalationItem[]> {
  const res = await fetch(`${API}/api/v1/authority/district/escalations`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function postEscalationAction(
  token: string,
  firId: string,
  directive: string,
  handBack: boolean,
): Promise<FIR> {
  const res = await fetch(`${API}/api/v1/authority/district/escalations/${firId}/action`, {
    method: 'POST',
    headers: authH(token),
    body: JSON.stringify({ directive, hand_back: handBack }),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function getStationFIRs(token: string, stationId: string): Promise<FIR[]> {
  const res = await fetch(`${API}/api/v1/authority/district/stations/${stationId}/firs`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}
