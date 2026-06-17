import type { FIR, FIRStatus, IncidentType } from './fir';

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

export interface FIRWithStation {
  id: string;
  fir_number: string;
  status: FIRStatus;
  incident_type: IncidentType;
  complainant_name: string;
  incident_location: string;
  incident_date: string;
  station_id: string;
  station_name: string;
  citizen_id: string;
  officer_id: string | null;
  ipc_sections: string | null;
  created_at: string;
  updated_at: string;
}

export async function getDistrictCases(
  token: string,
  status?: FIRStatus | 'all',
  stationId?: string,
): Promise<FIRWithStation[]> {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (stationId) params.set('station_id', stationId);
  const qs = params.toString();
  const res = await fetch(`${API}/api/v1/authority/district/cases${qs ? `?${qs}` : ''}`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
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

export interface DirectiveItem {
  fir_id: string;
  fir_number: string;
  station_name: string;
  directive: string;
  hand_back: boolean;
  issued_at: string;
  issued_by_id: string;
}

export interface OfficerInfo {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  station_id: string | null;
  station_name: string;
}

export async function postFIRNote(token: string, firId: string, note: string): Promise<FIR> {
  const res = await fetch(`${API}/api/v1/authority/district/cases/${firId}/note`, {
    method: 'POST',
    headers: authH(token),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function getDistrictDirectives(token: string): Promise<DirectiveItem[]> {
  const res = await fetch(`${API}/api/v1/authority/district/directives`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function getDistrictOfficers(token: string): Promise<OfficerInfo[]> {
  const res = await fetch(`${API}/api/v1/authority/district/officers`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function getStationFIRs(token: string, stationId: string): Promise<FIR[]> {
  const res = await fetch(`${API}/api/v1/authority/district/stations/${stationId}/firs`, { headers: authH(token) });
  if (!res.ok) await handleError(res);
  return res.json();
}
