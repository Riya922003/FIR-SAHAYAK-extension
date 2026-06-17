import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDistrictDirectives, type DirectiveItem } from '../../api/authority';

export default function DirectivesLog() {
  const { token } = useAuth();
  const [items, setItems] = useState<DirectiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    if (!token) return;
    setLoading(true);
    getDistrictDirectives(token)
      .then(setItems)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  return (
    <div>
      <div className="dash-header">
        <div>
          <h1>Directives Issued</h1>
          <p>All authority directives recorded in your district</p>
        </div>
        <button className="btn-refresh" onClick={load} disabled={loading}>
          {loading ? '…' : '↻'} Refresh
        </button>
      </div>

      {error && <div className="dash-error">⚠ {error}</div>}

      {loading ? (
        <div className="dash-loading">Loading directives…</div>
      ) : items.length === 0 ? (
        <div className="officer-empty">
          <div className="officer-empty-icon">📋</div>
          <h3>No directives yet</h3>
          <p>Directives you issue through the Escalation Queue will appear here.</p>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="fir-table">
            <thead>
              <tr>
                <th>FIR Number</th>
                <th>Station</th>
                <th>Directive</th>
                <th style={{ textAlign: 'center' }}>Hand Back</th>
                <th>Issued On</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d, i) => (
                <tr key={i} style={{ background: d.hand_back ? '#f0fdf4' : undefined }}>
                  <td><strong>{d.fir_number}</strong></td>
                  <td style={{ fontSize: '0.82rem', color: '#475569' }}>{d.station_name}</td>
                  <td style={{ maxWidth: 300 }}>
                    <span style={{ fontSize: '0.875rem', color: '#334155' }}>{d.directive}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {d.hand_back
                      ? <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.82rem' }}>Yes</span>
                      : <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>—</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: '#64748b' }}>
                    {new Date(d.issued_at).toLocaleDateString('en-IN')}
                    <br />
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      {new Date(d.issued_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
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
