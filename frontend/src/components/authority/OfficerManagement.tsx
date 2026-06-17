import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDistrictOfficers, type OfficerInfo } from '../../api/authority';

const ROLE_LABELS: Record<string, string> = {
  officer: 'Officer',
  station_admin: 'Station Admin',
};

export default function OfficerManagement() {
  const { token } = useAuth();
  const [officers, setOfficers] = useState<OfficerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    if (!token) return;
    setLoading(true);
    getDistrictOfficers(token)
      .then(setOfficers)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const filtered = search.trim()
    ? officers.filter(o =>
        o.full_name.toLowerCase().includes(search.toLowerCase()) ||
        o.station_name.toLowerCase().includes(search.toLowerCase()) ||
        o.email.toLowerCase().includes(search.toLowerCase()),
      )
    : officers;

  // Group by station for display
  const byStation: Record<string, OfficerInfo[]> = {};
  filtered.forEach(o => {
    const key = o.station_name;
    if (!byStation[key]) byStation[key] = [];
    byStation[key].push(o);
  });

  return (
    <div>
      <div className="dash-header">
        <div>
          <h1>Officers</h1>
          <p>All officers and station admins in your district</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search officers…"
            style={{
              border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.4rem 0.75rem',
              fontSize: '0.82rem', color: '#334155', outline: 'none', width: 180,
            }}
          />
          <button className="btn-refresh" onClick={load} disabled={loading}>
            {loading ? '…' : '↻'} Refresh
          </button>
        </div>
      </div>

      {error && <div className="dash-error">⚠ {error}</div>}

      {loading ? (
        <div className="dash-loading">Loading officers…</div>
      ) : filtered.length === 0 ? (
        <div className="officer-empty">
          <div className="officer-empty-icon">👮</div>
          <h3>{search ? 'No results' : 'No officers found'}</h3>
          <p>{search ? 'Try a different search term.' : 'No officers are registered under stations in your district.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {Object.entries(byStation).map(([stationName, stationOfficers]) => (
            <div key={stationName} className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>🏛️ {stationName}</span>
                <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '0.5rem' }}>
                  {stationOfficers.length} officer{stationOfficers.length !== 1 ? 's' : ''}
                </span>
              </div>
              <table className="fir-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {stationOfficers.map(o => (
                    <tr key={o.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>{o.full_name}</div>
                      </td>
                      <td>
                        <span style={{
                          background: o.role === 'station_admin' ? '#ddd6fe' : '#dbeafe',
                          color: o.role === 'station_admin' ? '#6d28d9' : '#1d4ed8',
                          fontSize: '0.75rem', fontWeight: 700,
                          padding: '0.2rem 0.5rem', borderRadius: 6,
                        }}>
                          {ROLE_LABELS[o.role] || o.role}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#475569' }}>{o.email}</td>
                      <td style={{ fontSize: '0.82rem', color: '#475569' }}>{o.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
