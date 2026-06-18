const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export type FIRStatus =
  | 'draft' | 'submitted' | 'acknowledged'
  | 'under_investigation' | 'resolved' | 'rejected'
  | 'closed' | 'escalated';

export type IncidentType =
  | 'theft' | 'assault' | 'missing_person' | 'sexual_assault'
  | 'hit_and_run' | 'fraud' | 'cyber_crime' | 'property_damage'
  | 'domestic_violence' | 'other';

export interface FIR {
  id: string;
  fir_number: string;
  status: FIRStatus;
  incident_type: IncidentType;
  description: string;
  incident_location: string;
  incident_date: string;
  incident_time?: string;
  complainant_name: string;
  complainant_address: string;
  complainant_phone: string;
  witness_info?: string;
  ai_interview_summary?: string;
  suggested_ipc_sections?: string;
  station_id: string;
  reapply_count: number;
  created_at: string;
  updated_at: string;
}

export interface StatusHistoryItem {
  previous_status?: FIRStatus;
  new_status: FIRStatus;
  notes?: string;
  changed_at: string;
  changed_by: string;
}

export interface FIRDetail extends FIR {
  status_history: StatusHistoryItem[];
}

export interface PoliceStation {
  id: string;
  name: string;
  district: string;
  state: string;
  address: string;
  phone?: string;
}

export interface FileFIRPayload {
  station_id: string;
  incident_type: IncidentType;
  description: string;
  incident_location: string;
  incident_date: string;
  incident_time?: string;
  complainant_name: string;
  complainant_father_name?: string;
  complainant_address: string;
  complainant_phone: string;
  witness_info?: string;
  ai_interview_summary?: string;
  suggested_ipc_sections?: string;
}

export interface InterviewMessage {
  role: 'model' | 'user';
  text: string;
}

export interface InterviewResult {
  question: string;
  done: boolean;
}

export interface SummarizeResult {
  summary: string;
  ipc_sections: string;
}

const authH = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export async function getMyFIRs(token: string): Promise<FIR[]> {
  const res = await fetch(`${API_URL}/api/v1/fir/my`, { headers: authH(token) });
  if (!res.ok) throw new Error('Failed to fetch FIRs');
  return res.json();
}

export async function getFIRDetail(token: string, id: string): Promise<FIRDetail> {
  const res = await fetch(`${API_URL}/api/v1/fir/${id}`, { headers: authH(token) });
  if (!res.ok) throw new Error('Failed to fetch FIR detail');
  return res.json();
}

export async function fileFIR(token: string, payload: FileFIRPayload): Promise<FIR> {
  const res = await fetch(`${API_URL}/api/v1/fir/`, {   // trailing slash required
    method: 'POST',
    headers: authH(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = data.detail;
    const msg = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ')
        : 'Failed to file FIR';
    throw new Error(msg);
  }
  return data;
}

export async function cancelFIR(token: string, id: string): Promise<FIR> {
  const res = await fetch(`${API_URL}/api/v1/fir/${id}/cancel`, {
    method: 'POST',
    headers: authH(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to cancel FIR');
  return data;
}

export async function escalateFIR(token: string, id: string, reason: string): Promise<FIR> {
  const res = await fetch(`${API_URL}/api/v1/fir/${id}/escalate`, {
    method: 'POST',
    headers: authH(token),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to escalate FIR');
  return data;
}

export async function getStationDistricts(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/v1/admin/stations/districts`);
  if (!res.ok) return [];
  return res.json();
}

export async function getStations(token: string): Promise<PoliceStation[]> {
  const res = await fetch(`${API_URL}/api/v1/admin/stations`, { headers: authH(token) });
  if (!res.ok) return [];
  return res.json();
}

export async function conductInterview(
  token: string,
  payload: { incident_type: string; description: string; history: InterviewMessage[]; question_count: number }
): Promise<InterviewResult> {
  const res = await fetch(`${API_URL}/api/v1/ai/interview`, {
    method: 'POST',
    headers: authH(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Interview request failed');
  return data;
}

export async function summarizeInterview(
  token: string,
  payload: { incident_type: string; description: string; conversation: InterviewMessage[] }
): Promise<SummarizeResult> {
  const res = await fetch(`${API_URL}/api/v1/ai/summarize-interview`, {
    method: 'POST',
    headers: authH(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Summarize request failed');
  return data;
}

export async function getNearbyStations(address: string): Promise<PoliceStation[]> {
  const params = new URLSearchParams({ address });
  const res = await fetch(`${API_URL}/api/v1/admin/stations/nearby?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to find nearby stations');
  return data;
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<FIRStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  under_investigation: 'Under Investigation',
  resolved: 'Resolved',
  rejected: 'Rejected',
  closed: 'Closed',
  escalated: 'Escalated',
};

export const STATUS_COLORS: Record<FIRStatus, string> = {
  draft: '#9e9e9e',
  submitted: '#f59e0b',
  acknowledged: '#3b82f6',
  under_investigation: '#1d4ed8',
  resolved: '#22c55e',
  rejected: '#ef4444',
  closed: '#64748b',
  escalated: '#f97316',
};

export const INCIDENT_LABELS: Record<IncidentType, string> = {
  theft: 'Theft',
  assault: 'Assault',
  missing_person: 'Missing Person',
  sexual_assault: 'Sexual Assault',
  hit_and_run: 'Hit & Run',
  fraud: 'Fraud',
  cyber_crime: 'Cyber Crime',
  property_damage: 'Property Damage',
  domestic_violence: 'Domestic Violence',
  other: 'Other',
};
