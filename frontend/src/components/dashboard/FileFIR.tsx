import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fileFIR, getStations, PoliceStation, IncidentType, INCIDENT_LABELS } from '../../api/fir';

interface Props {
  onSuccess: (firNumber: string) => void;
  onCancel: () => void;
}

const INCIDENT_TYPES = Object.entries(INCIDENT_LABELS) as [IncidentType, string][];

const EMPTY_FORM = {
  station_id: '',
  incident_type: '' as IncidentType | '',
  description: '',
  incident_location: '',
  incident_date: '',
  incident_time: '',
  complainant_address: '',
  witness_info: '',
};

export default function FileFIR({ onSuccess, onCancel }: Props) {
  const { token, user } = useAuth();
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stationsLoading, setStationsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getStations(token)
      .then(setStations)
      .finally(() => setStationsLoading(false));
  }, [token]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.incident_type) { setError('Please select an incident type'); return; }
    if (form.description.length < 50) { setError('Description must be at least 50 characters'); return; }
    if (!form.station_id) { setError('Please select a police station'); return; }

    setLoading(true);
    try {
      const fir = await fileFIR(token!, {
        station_id: form.station_id,
        incident_type: form.incident_type as IncidentType,
        description: form.description,
        incident_location: form.incident_location,
        incident_date: form.incident_date,
        incident_time: form.incident_time || undefined,
        complainant_name: user!.full_name,
        complainant_address: form.complainant_address,
        complainant_phone: user!.phone,
        witness_info: form.witness_info || undefined,
      });
      onSuccess(fir.fir_number);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to file FIR');
    } finally {
      setLoading(false);
    }
  };

  const descLen = form.description.length;

  return (
    <>
      <button className="back-btn" onClick={onCancel}>← Back</button>

      <div className="dash-header">
        <h1>File a New FIR</h1>
        <p>Submit your complaint — it will be assigned to the selected police station</p>
      </div>

      {error && <div className="dash-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      <div className="dash-card">
        <form className="file-fir-form" onSubmit={handleSubmit}>

          {/* Section 1: Incident */}
          <div>
            <div className="form-section-title">1. Incident Information</div>
            <div className="form-row-2">
              <div className="form-group-dash">
                <label>Incident Type *</label>
                <select name="incident_type" value={form.incident_type} onChange={handleChange} required>
                  <option value="">Select type…</option>
                  {INCIDENT_TYPES.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group-dash">
                <label>Police Station *</label>
                {stationsLoading ? (
                  <select disabled><option>Loading stations…</option></select>
                ) : stations.length === 0 ? (
                  <div className="no-station-notice">
                    ⚠ No police stations are registered yet. Please contact the system admin.
                  </div>
                ) : (
                  <select name="station_id" value={form.station_id} onChange={handleChange} required>
                    <option value="">Select station…</option>
                    {stations.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.district}, {s.state}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="form-row-2" style={{ marginTop: '1rem' }}>
              <div className="form-group-dash">
                <label>Incident Date *</label>
                <input
                  type="date"
                  name="incident_date"
                  value={form.incident_date}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="form-group-dash">
                <label>Incident Time (optional)</label>
                <input
                  type="time"
                  name="incident_time"
                  value={form.incident_time}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group-dash" style={{ marginTop: '1rem' }}>
              <label>Incident Location *</label>
              <input
                type="text"
                name="incident_location"
                value={form.incident_location}
                onChange={handleChange}
                placeholder="e.g. Near SBI ATM, Sector 21, Noida"
                required
              />
            </div>

            <div className="form-group-dash" style={{ marginTop: '1rem' }}>
              <label>Description * (min 50 characters)</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the incident in detail — what happened, when, who was involved, any evidence…"
                rows={5}
                required
              />
              <div className={`char-count ${descLen < 50 ? 'warn' : 'ok'}`}>
                {descLen} / 50 min {descLen >= 50 ? '✓' : `(${50 - descLen} more needed)`}
              </div>
            </div>
          </div>

          {/* Section 2: Complainant */}
          <div>
            <div className="form-section-title">2. Complainant Details</div>
            <div className="form-row-2">
              <div className="form-group-dash">
                <label>Full Name</label>
                <input type="text" value={user?.full_name || ''} disabled />
              </div>
              <div className="form-group-dash">
                <label>Phone</label>
                <input type="text" value={user?.phone || ''} disabled />
              </div>
            </div>
            <div className="form-group-dash" style={{ marginTop: '1rem' }}>
              <label>Residential Address *</label>
              <input
                type="text"
                name="complainant_address"
                value={form.complainant_address}
                onChange={handleChange}
                placeholder="House No., Street, Area, City, PIN"
                required
              />
            </div>
          </div>

          {/* Section 3: Witness */}
          <div>
            <div className="form-section-title">3. Witness Information (optional)</div>
            <div className="form-group-dash">
              <textarea
                name="witness_info"
                value={form.witness_info}
                onChange={handleChange}
                placeholder="Names, contact details, or descriptions of any witnesses…"
                rows={3}
              />
            </div>
          </div>

          <div className="action-bar">
            <button type="submit" className="btn-primary" disabled={loading || descLen < 50}>
              {loading ? 'Filing FIR…' : 'Submit FIR'}
            </button>
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>

        </form>
      </div>
    </>
  );
}
