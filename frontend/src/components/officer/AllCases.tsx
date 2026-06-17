import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllStation } from '../../api/officer';
import { INCIDENT_LABELS, STATUS_LABELS, STATUS_COLORS, type FIR, type FIRStatus } from '../../api/fir';

interface Props {
  onViewFIR: (id: string) => void;
}

const STATUS_FILTERS: { label: string; value: FIRStatus | 'all' }[] = [
  { label: 'All',              value: 'all' },
  { label: 'Submitted',        value: 'submitted' },
  { label: 'Acknowledged',     value: 'acknowledged' },
  { label: 'Investigating',    value: 'under_investigation' },
  { label: 'Resolved',         value: 'resolved' },
  { label: 'Rejected',         value: 'rejected' },
  { label: 'Closed',           value: 'closed' },
];

export default function AllCases({ onViewFIR }: Props) {
  const { token } = useAuth();
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<FIRStatus | 'all'>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAllStation(token);
      setFirs(data);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = activeFilter === 'all' ? firs : firs.filter(f => f.status === activeFilter);

  return (
    <div>
      <div className="dash-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1>All Station Cases</h1>
          <p>All FIRs filed at this station — read only</p>
        </div>
        <button className="btn-secondary" style={{ flexShrink: 0 }} onClick={load}>↻ Refresh</button>
      </div>

      {error && <div className="dash-error">⚠ {error}</div>}

      <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-tab${activeFilter === f.value ? ' active' : ''}`}
            onClick={() => setActiveFilter(f.value)}
          >
            {f.label}
            {f.value !== 'all' && (
              <span style={{ marginLeft: '0.4rem', opacity: 0.7 }}>
                ({firs.filter(fir => fir.status === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="dash-loading">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="officer-empty">
          <h3>No FIRs found</h3>
          <p>{activeFilter === 'all' ? 'No FIRs at this station yet.' : `No FIRs with this status.`}</p>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="fir-table">
            <thead>
              <tr>
                <th>FIR Number</th>
                <th>Type</th>
                <th>Location</th>
                <th>Complainant</th>
                <th>Incident Date</th>
                <th>Filed On</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(fir => (
                <tr key={fir.id} onClick={() => onViewFIR(fir.id)} style={{ cursor: 'pointer' }}>
                  <td><strong>{fir.fir_number}</strong></td>
                  <td>{INCIDENT_LABELS[fir.incident_type]}</td>
                  <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fir.incident_location}
                  </td>
                  <td>{fir.complainant_name}</td>
                  <td>{new Date(fir.incident_date).toLocaleDateString('en-IN')}</td>
                  <td>{new Date(fir.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className="status-badge" style={{
                      background: STATUS_COLORS[fir.status] + '1a',
                      color: STATUS_COLORS[fir.status],
                    }}>
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
