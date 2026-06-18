import { useState } from 'react';
import type React from 'react';
import { type FIR, type FIRStatus, STATUS_LABELS, STATUS_COLORS, INCIDENT_LABELS } from '../../api/fir';

interface Props {
  firs: FIR[];
  loading: boolean;
  onViewFIR: (id: string) => void;
  onFileFIR: () => void;
}

const FILTERS: { label: string; value: FIRStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Acknowledged', value: 'acknowledged' },
  { label: 'Under Investigation', value: 'under_investigation' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Closed', value: 'closed' },
  { label: 'Escalated', value: 'escalated' },
];

export default function MyFIRs({ firs, loading, onViewFIR, onFileFIR }: Props) {
  const [activeFilter, setActiveFilter] = useState<FIRStatus | 'ALL'>('ALL');

  const filtered = activeFilter === 'ALL'
    ? firs
    : firs.filter(f => f.status === activeFilter);

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2>My FIRs</h2>
        <button className="btn-primary" onClick={onFileFIR}>+ File New FIR</button>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {FILTERS.map(f => {
          const count = f.value !== 'ALL' ? firs.filter(fir => fir.status === f.value).length : null;
          const isZero = count !== null && count === 0;
          return (
            <button
              key={f.value}
              className={[
                'filter-tab',
                activeFilter === f.value ? 'active' : '',
                isZero ? 'zero-count' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setActiveFilter(f.value)}
            >
              {f.label}
              {count !== null && (
                <span style={{ marginLeft: '0.4rem', opacity: 0.65 }}>({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="dash-loading">Loading FIRs…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" />
          <h3>No FIRs found</h3>
          <p>{activeFilter === 'ALL' ? "You haven't filed any FIRs yet." : `No FIRs with status "${STATUS_LABELS[activeFilter as FIRStatus]}".`}</p>
          {activeFilter === 'ALL' && (
            <button className="btn-primary" onClick={onFileFIR}>+ File New FIR</button>
          )}
        </div>
      ) : (
        <table className="fir-table">
          <thead>
            <tr>
              <th>FIR Number</th>
              <th>Type</th>
              <th>Location</th>
              <th>Incident Date</th>
              <th>Filed On</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(fir => (
              <tr
                key={fir.id}
                onClick={() => onViewFIR(fir.id)}
                style={{ '--row-accent': STATUS_COLORS[fir.status] } as React.CSSProperties}
              >
                <td><strong className="fir-number">{fir.fir_number}</strong></td>
                <td>{INCIDENT_LABELS[fir.incident_type]}</td>
                <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fir.incident_location}
                </td>
                <td>{new Date(fir.incident_date).toLocaleDateString('en-IN')}</td>
                <td>{new Date(fir.created_at).toLocaleDateString('en-IN')}</td>
                <td>
                  <span className={`status-badge status-badge--${fir.status}`}>
                    {STATUS_LABELS[fir.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
