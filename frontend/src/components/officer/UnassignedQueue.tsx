import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUnassigned, acknowledgeFIR } from '../../api/officer';
import { INCIDENT_LABELS, type FIR } from '../../api/fir';

interface Props {
  onViewFIR: (id: string) => void;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function UnassignedQueue({ onViewFIR }: Props) {
  const { token } = useAuth();
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getUnassigned(token);
      setFirs(data);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const handleAcknowledge = async (fir: FIR) => {
    if (!token) return;
    setClaiming(fir.id);
    try {
      await acknowledgeFIR(token, fir.id);
      setFirs(prev => prev.filter(f => f.id !== fir.id));
      setToast(`FIR ${fir.fir_number} claimed — check My Cases.`);
      setTimeout(() => setToast(''), 5000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      if (msg.includes('already claimed')) {
        setToast('Already claimed by another officer. Refreshing…');
        load();
      } else {
        setError(msg);
      }
      setTimeout(() => setToast(''), 4000);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div>
      <div className="dash-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1>Unassigned Queue</h1>
          <p>Submitted FIRs not yet claimed by any officer — oldest first</p>
        </div>
        <button className="btn-secondary" style={{ flexShrink: 0 }} onClick={load}>↻ Refresh</button>
      </div>

      {toast && <div className="officer-toast">{toast}</div>}
      {error && <div className="dash-error">⚠ {error}</div>}

      {loading ? (
        <div className="dash-loading">Loading queue…</div>
      ) : firs.length === 0 ? (
        <div className="officer-empty">
          <div className="officer-empty-icon">✓</div>
          <h3>Queue is clear</h3>
          <p>No unassigned FIRs at your station right now.</p>
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
                <th>Complainant</th>
                <th>Filed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {firs.map(fir => (
                <tr key={fir.id}>
                  <td>
                    <button className="fir-link-btn" onClick={() => onViewFIR(fir.id)}>
                      <strong>{fir.fir_number}</strong>
                    </button>
                  </td>
                  <td>{INCIDENT_LABELS[fir.incident_type]}</td>
                  <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fir.incident_location}
                  </td>
                  <td>{fir.complainant_name}</td>
                  <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.82rem' }}>
                    {timeAgo(fir.created_at)}
                  </td>
                  <td>
                    <button
                      className="btn-acknowledge"
                      onClick={() => handleAcknowledge(fir)}
                      disabled={claiming === fir.id}
                    >
                      {claiming === fir.id ? 'Claiming…' : 'Acknowledge'}
                    </button>
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
