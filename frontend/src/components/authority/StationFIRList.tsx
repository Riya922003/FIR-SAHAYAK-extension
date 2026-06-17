import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getStationFIRs, type StationHealth } from '../../api/authority';
import { STATUS_LABELS, STATUS_COLORS, INCIDENT_LABELS, type FIR, type FIRStatus } from '../../api/fir';

interface Props {
  station: StationHealth;
  onBack: () => void;
}

const FILTERS: { label: string; value: FIRStatus | 'all' }[] = [
  { label: 'All',           value: 'all' },
  { label: 'Submitted',     value: 'submitted' },
  { label: 'Acknowledged',  value: 'acknowledged' },
  { label: 'Investigating', value: 'under_investigation' },
  { label: 'Escalated',     value: 'escalated' },
  { label: 'Resolved',      value: 'resolved' },
  { label: 'Rejected',      value: 'rejected' },
  { label: 'Closed',        value: 'closed' },
];

export default function StationFIRList({ station, onBack }: Props) {
  const { token } = useAuth();
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FIRStatus | 'all'>('all');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getStationFIRs(token, station.id)
      .then(setFirs)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, station.id]);

  const filtered = filter === 'all' ? firs : firs.filter(f => f.status === filter);

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← Back to District Overview</button>

      {/* Station header */}
      <div className="dash-header">
        <div>
          <h1>{station.name}</h1>
          <p>{station.address} · {station.district}, {station.state}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Active', value: station.total_active, color: '#1d4ed8' },
          { label: 'Pending',      value: station.pending,      color: '#f59e0b' },
          { label: 'Investigating',value: station.investigating, color: '#3b82f6' },
          { label: 'Escalated',    value: station.escalated,    color: '#ef4444' },
          { label: 'Overdue',      value: station.overdue,      color: '#f97316' },
        ].map(s => (
          <div
            key={s.label}
            style={{
              background: '#fff', border: '1px solid #e2e8f0',
              borderTop: `3px solid ${s.color}`, borderRadius: 10,
              padding: '0.7rem 1rem', textAlign: 'center', minWidth: 90,
            }}
          >
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.value > 0 ? s.color : '#cbd5e1' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-tab${filter === f.value ? ' active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            {f.value !== 'all' && (
              <span style={{ marginLeft: '0.35rem', opacity: 0.7 }}>
                ({firs.filter(fir => fir.status === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="dash-error">⚠ {error}</div>}

      {loading ? (
        <div className="dash-loading">Loading FIRs…</div>
      ) : filtered.length === 0 ? (
        <div className="officer-empty">
          <h3>No FIRs</h3>
          <p>{filter === 'all' ? 'No FIRs filed at this station yet.' : `No FIRs with status "${STATUS_LABELS[filter as FIRStatus]}".`}</p>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="fir-table">
            <thead>
              <tr>
                <th>FIR Number</th>
                <th>Type</th>
                <th>Complainant</th>
                <th>Location</th>
                <th>Incident Date</th>
                <th>Last Updated</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(fir => (
                <tr key={fir.id} style={{ cursor: 'default' }}>
                  <td><strong>{fir.fir_number}</strong></td>
                  <td>{INCIDENT_LABELS[fir.incident_type]}</td>
                  <td>{fir.complainant_name}</td>
                  <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fir.incident_location}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(fir.incident_date).toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.82rem' }}>
                    {new Date(fir.updated_at).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        background: STATUS_COLORS[fir.status] + '1a',
                        color: STATUS_COLORS[fir.status],
                      }}
                    >
                      {STATUS_LABELS[fir.status]}
                    </span>
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
