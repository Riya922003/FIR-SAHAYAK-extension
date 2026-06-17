import { useState, FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fileFIR, getNearbyStations, type PoliceStation, type IncidentType, INCIDENT_LABELS } from '../../api/fir';

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

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Station search
  const [nearbyStations, setNearbyStations] = useState<PoliceStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<PoliceStation | null>(null);
  const [stationSearching, setStationSearching] = useState(false);
  const [stationError, setStationError] = useState('');
  const [searchedAddress, setSearchedAddress] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));

    // Clear station selection when location changes after a search
    if (name === 'incident_location' && searchedAddress && value !== searchedAddress) {
      setNearbyStations([]);
      setSelectedStation(null);
      setSearchedAddress('');
      setForm(prev => ({ ...prev, station_id: '', incident_location: value }));
    }
  };

  const findNearbyStations = async () => {
    const addr = form.incident_location.trim();
    if (!addr) return;
    setStationSearching(true);
    setStationError('');
    setNearbyStations([]);
    setSelectedStation(null);
    setForm(prev => ({ ...prev, station_id: '' }));

    try {
      const stations = await getNearbyStations(addr);
      setNearbyStations(stations);
      setSearchedAddress(addr);
      if (stations.length === 0) {
        setStationError('No police stations found near this location. Try adding the city or district name.');
      }
    } catch (e: unknown) {
      setStationError(e instanceof Error ? e.message : 'Could not find nearby stations.');
    } finally {
      setStationSearching(false);
    }
  };

  const selectStation = (station: PoliceStation) => {
    setSelectedStation(station);
    setForm(prev => ({ ...prev, station_id: station.id }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.incident_type) { setError('Please select an incident type'); return; }
    if (form.description.length < 50) { setError('Description must be at least 50 characters'); return; }
    if (!form.station_id) { setError('Please search for and select a police station'); return; }

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
  const canSearch = form.incident_location.trim().length >= 10 && !stationSearching;
  const locationChanged = searchedAddress && form.incident_location !== searchedAddress;

  return (
    <>
      <button className="back-btn" onClick={onCancel}>← Back</button>

      <div className="dash-header">
        <h1>File a Complaint</h1>
        <p>Submit your complaint — it will be assigned to the nearest police station</p>
      </div>

      {error && <div className="dash-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      <div className="dash-card">
        <form className="file-fir-form" onSubmit={handleSubmit}>

          {/* ── Section 1: Incident ── */}
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
            </div>

            <div className="form-row-2" style={{ marginTop: '1rem' }}>
              <div className="form-group-dash">
                <label>Incident Time (optional)</label>
                <input
                  type="time"
                  name="incident_time"
                  value={form.incident_time}
                  onChange={handleChange}
                />
              </div>
              <div />
            </div>

            {/* Location + Find Stations */}
            <div className="form-group-dash" style={{ marginTop: '1rem' }}>
              <label>Incident Location *</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                <input
                  type="text"
                  name="incident_location"
                  value={form.incident_location}
                  onChange={handleChange}
                  placeholder="e.g. Near SBI ATM, Sector 21, Noida"
                  style={{ flex: 1 }}
                  required
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={findNearbyStations}
                  disabled={!canSearch}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {stationSearching ? 'Searching…' : locationChanged ? 'Search Again' : 'Find Stations'}
                </button>
              </div>
              {!searchedAddress && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
                  Enter where the incident happened, then click "Find Stations" to select the nearest police station.
                </div>
              )}
              {locationChanged && (
                <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: '0.35rem' }}>
                  Location changed — click "Search Again" to update nearby stations.
                </div>
              )}
            </div>

            {/* Station search results */}
            {stationSearching && (
              <div style={{ padding: '0.75rem 0', color: '#64748b', fontSize: '0.875rem' }}>
                Locating nearby police stations…
              </div>
            )}

            {stationError && !stationSearching && (
              <div className="dash-error" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                {stationError}
              </div>
            )}

            {!stationSearching && nearbyStations.length > 0 && (
              <div className="form-group-dash" style={{ marginTop: '0.75rem' }}>
                <label>
                  Select Police Station *
                  {selectedStation && (
                    <span style={{ fontWeight: 400, color: '#22c55e', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                      Station selected
                    </span>
                  )}
                </label>
                <div className="station-picker">
                  {nearbyStations.map(s => {
                    const isSelected = selectedStation?.id === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`station-card${isSelected ? ' selected' : ''}`}
                        onClick={() => selectStation(s)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && selectStation(s)}
                      >
                        <div>
                          <div className="station-card-name">{s.name}</div>
                          <div className="station-card-address">{s.address}</div>
                        </div>
                        {isSelected && (
                          <span style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: '#22c55e', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', flexShrink: 0,
                          }}>✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
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

          {/* ── Section 2: Complainant ── */}
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

          {/* ── Section 3: Witness ── */}
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
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || descLen < 50 || !form.station_id}
            >
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
