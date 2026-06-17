import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDistrictCases, getDistrictStations, type FIRWithStation, type StationHealth } from '../../api/authority';
import { STATUS_LABELS, STATUS_COLORS, INCIDENT_LABELS, type FIRStatus } from '../../api/fir';

const STATUS_FILTERS: { label: string; value: FIRStatus | 'all' }[] = [
  { label: 'All',           value: 'all' },
  { label: 'Submitted',     value: 'submitted' },
  { label: 'Acknowledged',  value: 'acknowledged' },
  { label: 'Investigating', value: 'under_investigation' },
  { label: 'Escalated',     value: 'escalated' },
  { label: 'Resolved',      value: 'resolved' },
  { label: 'Rejected',      value: 'rejected' },
  { label: 'Closed',        value: 'closed' },
];

export default function ActiveCases() {
  const { token } = useAuth();
  const [cases, setCases] = useState<FIRWithStation[]>([]);
  const [stations, setStations] = useState<StationHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<FIRStatus | 'all'>('all');
  const [stationFilter, setStationFilter] = useState<string>('all');

  const load = (status = statusFilter, station = stationFilter) => {
    if (!token) return;
    setLoading(true);
    setError('');
    getDistrictCases(
      token,
      status !== 'all' ? status : undefined,
      station !== 'all' ? station : undefined,
    )
      .then(setCases)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  // Load stations for the dropdown once
  useEffect(() => {
    if (!token) return;
    getDistrictStations(token).then(setStations).catch(() => {});
  }, [token]);

  useEffect(() => { load(); }, [token]);

  const handleStatusChange = (s: FIRStatus | 'all') => {
    setStatusFilter(s);
    load(s, stationFilter);
  };

  const handleStationChange = (s: string) => {
    setStationFilter(s);
    load(statusFilter, s);
  };

  // Count per status (from full loaded set; recounted locally)
  const countFor = (s: FIRStatus) => cases.filter(c => c.status === s).length;

  const filtered = cases; // filtering is server-side

  return (
    <div>
      <div className="dash-header">
        <div>
          <h1>Active Cases</h1>
          <p>All FIRs across your district</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Station filter */}
          <select
            value={stationFilter}
            onChange={e => handleStationChange(e.target.value)}
            style={{
              border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.4rem 0.75rem',
              fontSize: '0.82rem', color: '#334155', background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="all">All Stations</option>
            {stations.map(st => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>

          <button className="btn-refresh" onClick={() => load()} disabled={loading}>
            {loading ? '…' : '↻'} Refresh
          </button>
        </div>
      </div>

      {error && <div className="dash-error">⚠ {error}</div>}

      {/* Status filter tabs */}
      <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-tab${statusFilter === f.value ? ' active' : ''}`}
            onClick={() => handleStatusChange(f.value)}
          >
            {f.label}
            {f.value !== 'all' && statusFilter === 'all' && (
              <span style={{ marginLeft: '0.35rem', opacity: 0.6 }}>
                ({countFor(f.value as FIRStatus)})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      {!loading && (
        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
          Showing <strong>{filtered.length}</strong> FIR{filtered.length !== 1 ? 's' : ''}
          {statusFilter !== 'all' && <> with status <strong>{STATUS_LABELS[statusFilter as FIRStatus]}</strong></>}
          {stationFilter !== 'all' && <> at <strong>{stations.find(s => s.id === stationFilter)?.name}</strong></>}
        </div>
      )}

      {loading ? (
        <div className="dash-loading">Loading cases…</div>
      ) : filtered.length === 0 ? (
        <div className="officer-empty">
          <div className="officer-empty-icon">📁</div>
          <h3>No cases found</h3>
          <p>No FIRs match the selected filters.</p>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="fir-table">
            <thead>
              <tr>
                <th>FIR Number</th>
                <th>Status</th>
                <th>Type</th>
                <th>Complainant</th>
                <th>Station</th>
                <th>Location</th>
                <th>Incident Date</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.fir_number}</strong></td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        background: STATUS_COLORS[c.status] + '1a',
                        color: STATUS_COLORS[c.status],
                      }}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{INCIDENT_LABELS[c.incident_type]}</td>
                  <td>{c.complainant_name}</td>
                  <td style={{ fontSize: '0.82rem', color: '#475569', whiteSpace: 'nowrap' }}>
                    {c.station_name}
                  </td>
                  <td
                    style={{
                      maxWidth: 140, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontSize: '0.82rem', color: '#64748b',
                    }}
                  >
                    {c.incident_location}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                    {new Date(c.incident_date).toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#94a3b8' }}>
                    {new Date(c.updated_at).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
