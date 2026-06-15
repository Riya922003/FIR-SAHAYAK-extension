import { FIR, STATUS_LABELS, STATUS_COLORS, INCIDENT_LABELS } from '../../api/fir';

interface Props {
  firs: FIR[];
  loading: boolean;
  onViewFIR: (id: string) => void;
  onFileFIR: () => void;
}

export default function Overview({ firs, loading, onViewFIR, onFileFIR }: Props) {
  const total      = firs.length;
  const pending    = firs.filter(f => f.status === 'SUBMITTED').length;
  const active     = firs.filter(f => ['ACKNOWLEDGED', 'UNDER_INVESTIGATION'].includes(f.status)).length;
  const resolved   = firs.filter(f => f.status === 'RESOLVED').length;
  const recent     = firs.slice(0, 5);

  return (
    <>
      {/* Stats */}
      <div className="stat-cards">
        <div className="stat-card total">
          <div className="stat-label">Total FIRs</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-label">Pending</div>
          <div className="stat-value">{pending}</div>
        </div>
        <div className="stat-card active">
          <div className="stat-label">Under Investigation</div>
          <div className="stat-value">{active}</div>
        </div>
        <div className="stat-card resolved">
          <div className="stat-label">Resolved</div>
          <div className="stat-value">{resolved}</div>
        </div>
      </div>

      {/* Recent FIRs */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h2>Recent FIRs</h2>
          <button className="btn-primary" onClick={onFileFIR}>+ File New FIR</button>
        </div>

        {loading ? (
          <div className="dash-loading">Loading FIRs…</div>
        ) : firs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No FIRs filed yet</h3>
            <p>You haven't filed any FIRs. Click below to file your first complaint.</p>
            <button className="btn-primary" onClick={onFileFIR}>+ File New FIR</button>
          </div>
        ) : (
          <table className="fir-table">
            <thead>
              <tr>
                <th>FIR Number</th>
                <th>Type</th>
                <th>Date Filed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(fir => (
                <tr key={fir.id} onClick={() => onViewFIR(fir.id)}>
                  <td><strong>{fir.fir_number}</strong></td>
                  <td>{INCIDENT_LABELS[fir.incident_type]}</td>
                  <td>{new Date(fir.created_at).toLocaleDateString('en-IN')}</td>
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
        )}
      </div>
    </>
  );
}
