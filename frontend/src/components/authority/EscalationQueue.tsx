import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDistrictEscalations, postEscalationAction, type EscalationItem } from '../../api/authority';
import { INCIDENT_LABELS } from '../../api/fir';

interface Props {
  onSelectFIR?: (firId: string) => void;
}

export default function EscalationQueue({ onSelectFIR }: Props) {
  const { token } = useAuth();
  const [items, setItems] = useState<EscalationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Directive modal state
  const [active, setActive] = useState<EscalationItem | null>(null);
  const [directive, setDirective] = useState('');
  const [handBack, setHandBack] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const load = () => {
    if (!token) return;
    setLoading(true);
    getDistrictEscalations(token)
      .then(setItems)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load escalations'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const openModal = (item: EscalationItem) => {
    setActive(item);
    setDirective('');
    setHandBack(false);
    setSubmitError('');
  };

  const handleSubmit = async () => {
    if (!token || !active) return;
    if (directive.trim().length < 10) {
      setSubmitError('Directive must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await postEscalationAction(token, active.fir_id, directive.trim(), handBack);
      setActive(null);
      load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="dash-header">
        <div>
          <h1>Escalation Queue</h1>
          <p>FIRs escalated by citizens in your district</p>
        </div>
        <button className="btn-refresh" onClick={load} disabled={loading}>
          {loading ? '…' : '↻'} Refresh
        </button>
      </div>

      {error && <div className="dash-error">⚠ {error}</div>}

      {loading ? (
        <div className="dash-loading">Loading escalations…</div>
      ) : items.length === 0 ? (
        <div className="officer-empty">
          <div className="officer-empty-icon">✅</div>
          <h3>No escalations</h3>
          <p>No FIRs have been escalated in your district.</p>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-scroll-wrap">
          <table className="fir-table">
            <thead>
              <tr>
                <th>FIR Number</th>
                <th>Complainant</th>
                <th>Station</th>
                <th>Type</th>
                <th>Reason</th>
                <th>Escalated</th>
                <th>Days Pending</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr
                  key={item.fir_id}
                  style={{ background: item.days_pending >= 3 ? '#fef2f2' : undefined }}
                >
                  <td><strong>{item.fir_number}</strong></td>
                  <td>{item.complainant_name}</td>
                  <td style={{ fontSize: '0.82rem', color: '#475569' }}>{item.station_name}</td>
                  <td>{INCIDENT_LABELS[item.incident_type]}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span title={item.reason}>{item.reason}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.82rem' }}>
                    {new Date(item.escalated_at).toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      fontWeight: 700,
                      color: item.days_pending >= 3 ? '#ef4444' : item.days_pending >= 1 ? '#f97316' : '#64748b',
                    }}>
                      {item.days_pending}d
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      {onSelectFIR && (
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                          onClick={() => onSelectFIR(item.fir_id)}
                        >
                          View
                        </button>
                      )}
                      <button
                        className="btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', color: '#8b5cf6', borderColor: '#8b5cf6' }}
                        onClick={() => openModal(item)}
                      >
                        Act
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Directive modal */}
      {active && (
        <div className="district-picker-overlay" style={{ position: 'fixed', zIndex: 200 }}>
          <div className="district-picker-card" style={{ maxWidth: 520 }}>
            <div className="district-picker-header">
              <div className="district-picker-icon">📋</div>
              <h2>Issue Directive — {active.fir_number}</h2>
              <p>
                <strong>{active.complainant_name}</strong> · {active.station_name}
                <br />
                <em style={{ fontSize: '0.8rem', color: '#9a3412' }}>
                  Reason: "{active.reason}"
                </em>
              </p>
            </div>

            <div className="district-picker-form">
              <textarea
                value={directive}
                onChange={e => setDirective(e.target.value)}
                placeholder="Write your directive or note for the station officer (min 10 characters)…"
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  border: '1px solid #e2e8f0', borderRadius: 8,
                  padding: '0.65rem 0.75rem', fontSize: '0.875rem', fontFamily: 'inherit',
                }}
              />

              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={handBack}
                  onChange={e => setHandBack(e.target.checked)}
                />
                Hand back to station — change status to <strong>Under Investigation</strong>
              </label>

              {submitError && (
                <div style={{ fontSize: '0.8rem', color: '#dc2626' }}>⚠ {submitError}</div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn-primary"
                  style={{ flex: 1, background: '#8b5cf6', borderColor: '#8b5cf6' }}
                  onClick={handleSubmit}
                  disabled={submitting || directive.trim().length < 10}
                >
                  {submitting ? 'Submitting…' : handBack ? 'Issue Directive & Hand Back' : 'Issue Directive'}
                </button>
                <button className="btn-secondary" onClick={() => setActive(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
