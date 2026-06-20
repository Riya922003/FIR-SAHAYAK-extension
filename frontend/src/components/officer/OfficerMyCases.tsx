import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyAssigned } from '../../api/officer';
import { INCIDENT_LABELS, STATUS_LABELS, type FIR, type FIRStatus } from '../../api/fir';

interface Props {
  onViewFIR: (id: string) => void;
}

const STATUS_FILTERS: { label: string; value: FIRStatus | 'all' }[] = [
  { label: 'All',                 value: 'all' },
  { label: 'Acknowledged',        value: 'acknowledged' },
  { label: 'Investigating',       value: 'under_investigation' },
  { label: 'Resolved',            value: 'resolved' },
  { label: 'Rejected',            value: 'rejected' },
  { label: 'Closed',              value: 'closed' },
];

export default function OfficerMyCases({ onViewFIR }: Props) {
  const { token } = useAuth();
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<FIRStatus | 'all'>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getMyAssigned(token);
      setFirs(data);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const counts = {
    total:              firs.length,
    acknowledged:       firs.filter(f => f.status === 'acknowledged').length,
    under_investigation:firs.filter(f => f.status === 'under_investigation').length,
    resolved:           firs.filter(f => f.status === 'resolved').length,
    rejected:           firs.filter(f => f.status === 'rejected').length,
  };

  const filtered = activeFilter === 'all' ? firs : firs.filter(f => f.status === activeFilter);

  return (
    <div>
      <div className="dash-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1>My Cases</h1>
          <p>FIRs assigned to you</p>
        </div>
        <button className="btn-secondary" style={{ flexShrink: 0 }} onClick={load}>↻ Refresh</button>
      </div>

      {error && <div className="dash-error">⚠ {error}</div>}

      {/* Summary cards */}
      <div className="officer-stats">
        <div className="officer-stat-card">
          <div className="officer-stat-num">{counts.total}</div>
          <div className="officer-stat-label">Total Assigned</div>
        </div>
        <div className="officer-stat-card" style={{ borderTop: '3px solid #3b82f6' }}>
          <div className="officer-stat-num" style={{ color: '#3b82f6' }}>{counts.acknowledged}</div>
          <div className="officer-stat-label">Acknowledged</div>
        </div>
        <div className="officer-stat-card" style={{ borderTop: '3px solid #1d4ed8' }}>
          <div className="officer-stat-num" style={{ color: '#1d4ed8' }}>{counts.under_investigation}</div>
          <div className="officer-stat-label">Investigating</div>
        </div>
        <div className="officer-stat-card" style={{ borderTop: '3px solid #22c55e' }}>
          <div className="officer-stat-num" style={{ color: '#22c55e' }}>{counts.resolved}</div>
          <div className="officer-stat-label">Resolved</div>
        </div>
        <div className="officer-stat-card" style={{ borderTop: '3px solid #ef4444' }}>
          <div className="officer-stat-num" style={{ color: '#ef4444' }}>{counts.rejected}</div>
          <div className="officer-stat-label">Rejected</div>
        </div>
      </div>

      {/* Filter tabs */}
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
        <div className="dash-loading">Loading your cases…</div>
      ) : filtered.length === 0 ? (
        <div className="officer-empty">
          <h3>No cases</h3>
          <p>{activeFilter === 'all' ? 'You have no assigned cases yet. Claim one from the queue.' : `No ${STATUS_LABELS[activeFilter as FIRStatus]} cases.`}</p>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-scroll-wrap">
          <table className="fir-table">
            <thead>
              <tr>
                <th>FIR Number</th>
                <th>Type</th>
                <th>Location</th>
                <th>Incident Date</th>
                <th>Last Updated</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(fir => (
                <tr key={fir.id} onClick={() => onViewFIR(fir.id)} style={{ cursor: 'pointer' }}>
                  <td><strong>{fir.fir_number}</strong></td>
                  <td>{INCIDENT_LABELS[fir.incident_type]}</td>
                  <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fir.incident_location}
                  </td>
                  <td>{new Date(fir.incident_date).toLocaleDateString('en-IN')}</td>
                  <td>{new Date(fir.updated_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className={`status-badge status-badge--${fir.status}`}>
                      {STATUS_LABELS[fir.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
