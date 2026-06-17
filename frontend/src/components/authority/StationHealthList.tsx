import type { StationHealth } from '../../api/authority';

interface Props {
  stations: StationHealth[];
  onDrillIn: (station: StationHealth) => void;
}

function Badge({ n, color, label }: { n: number; color: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: n > 0 ? color : '#cbd5e1' }}>{n}</div>
      <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

export default function StationHealthList({ stations, onDrillIn }: Props) {
  if (stations.length === 0) {
    return (
      <div className="officer-empty" style={{ marginTop: '1.5rem' }}>
        <div className="officer-empty-icon">🏛️</div>
        <h3>No stations found</h3>
        <p>No police stations are registered under your district yet.</p>
      </div>
    );
  }

  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
        <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
          Station Health
        </h2>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
          Sorted by urgency — escalated &amp; overdue first
        </p>
      </div>

      <table className="fir-table">
        <thead>
          <tr>
            <th style={{ width: '30%' }}>Station</th>
            <th style={{ textAlign: 'center' }}>Total Active</th>
            <th style={{ textAlign: 'center' }}>Pending</th>
            <th style={{ textAlign: 'center' }}>Investigating</th>
            <th style={{ textAlign: 'center', color: '#ef4444' }}>Escalated</th>
            <th style={{ textAlign: 'center', color: '#f97316' }}>Overdue</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {stations.map(st => {
            const urgent = st.escalated > 0 || st.overdue > 0;
            return (
              <tr
                key={st.id}
                onClick={() => onDrillIn(st)}
                style={{
                  cursor: 'pointer',
                  background: urgent ? '#fffbeb' : undefined,
                }}
              >
                <td>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                    {st.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                    {st.address}
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <Badge n={st.total_active} color="#1d4ed8" label="active" />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <Badge n={st.pending} color="#f59e0b" label="pending" />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <Badge n={st.investigating} color="#3b82f6" label="investig." />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <Badge n={st.escalated} color="#ef4444" label="escalated" />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <Badge n={st.overdue} color="#f97316" label="overdue" />
                </td>
                <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#8b5cf6', fontWeight: 600 }}>
                    View →
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
