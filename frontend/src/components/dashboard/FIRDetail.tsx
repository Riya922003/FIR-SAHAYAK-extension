import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getFIRDetail, cancelFIR, type FIRDetail as FIRDetailType, type FIRStatus, STATUS_LABELS, STATUS_COLORS, INCIDENT_LABELS } from '../../api/fir';

interface Props {
  firId: string;
  onBack: () => void;
  onRefresh: () => void;
}

const TIMELINE_STEPS: FIRStatus[] = [
  'submitted', 'acknowledged', 'under_investigation', 'resolved',
];

const TERMINAL: FIRStatus[] = ['rejected', 'closed', 'escalated'];

export default function FIRDetail({ firId, onBack, onRefresh }: Props) {
  const { token } = useAuth();
  const [fir, setFir] = useState<FIRDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getFIRDetail(token, firId)
      .then(setFir)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [firId, token]);

  const handleCancel = async () => {
    if (!token || !fir) return;
    setCancelling(true);
    try {
      await cancelFIR(token, fir.id);
      onRefresh();
      onBack();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setCancelling(false);
      setCancelConfirm(false);
    }
  };

  if (loading) return <div className="dash-loading">Loading FIR details…</div>;
  if (error) return <div className="dash-error">⚠ {error}</div>;
  if (!fir) return null;

  const isTerminal = TERMINAL.includes(fir.status);
  const canCancel = ['submitted', 'draft', 'acknowledged'].includes(fir.status);

  // Build timeline steps
  const steps = isTerminal
    ? [...TIMELINE_STEPS.slice(0, 3), fir.status]
    : TIMELINE_STEPS;

  const currentIdx = steps.indexOf(fir.status);

  return (
    <>
      <button className="back-btn" onClick={onBack}>← Back to My FIRs</button>

      {/* Header */}
      <div className="dash-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1>{fir.fir_number}</h1>
          <span
            className="status-badge"
            style={{
              background: STATUS_COLORS[fir.status] + '1a',
              color: STATUS_COLORS[fir.status],
              fontSize: '0.8rem',
            }}
          >
            {STATUS_LABELS[fir.status]}
          </span>
        </div>
        <p>Filed on {new Date(fir.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* FIR Info */}
      <div className="dash-card">
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Incident Details
        </h2>
        <div className="fir-detail-grid">
          <div className="detail-row">
            <label>Incident Type</label>
            <span>{INCIDENT_LABELS[fir.incident_type]}</span>
          </div>
          <div className="detail-row">
            <label>Incident Date</label>
            <span>{new Date(fir.incident_date).toLocaleDateString('en-IN')}{fir.incident_time ? ` at ${fir.incident_time}` : ''}</span>
          </div>
          <div className="detail-row">
            <label>Location</label>
            <span>{fir.incident_location}</span>
          </div>
          <div className="detail-row">
            <label>Complainant Phone</label>
            <span>{fir.complainant_phone}</span>
          </div>
          <div className="detail-row detail-description">
            <label>Description</label>
            <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{fir.description}</span>
          </div>
          {fir.witness_info && (
            <div className="detail-row detail-description">
              <label>Witness Information</label>
              <span>{fir.witness_info}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="dash-card">
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Status Timeline
        </h2>

        <div className="status-timeline">
          {steps.map((step, idx) => {
            const historyEntry = fir.status_history.find(h => h.new_status === step);
            const isDone = idx < currentIdx || (fir.status === step && ['resolved', 'closed', 'escalated'].includes(step));
            const isCurrent = fir.status === step;
            const isPending = idx > currentIdx;

            let dotClass = 'pending';
            if (isDone) dotClass = 'done';
            else if (isCurrent && TERMINAL.includes(step) && step !== 'resolved') dotClass = step === 'rejected' ? 'error' : 'current';
            else if (isCurrent) dotClass = 'current';

            return (
              <div className="timeline-item" key={step}>
                <div className="timeline-line-col">
                  <div className={`timeline-dot ${dotClass}`}>
                    {isDone ? '✓' : isCurrent ? '●' : idx + 1}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`timeline-connector${isDone ? ' done' : ''}`} />
                  )}
                </div>
                <div className="timeline-content">
                  <div className={`timeline-status${isPending ? ' pending' : ''}`}>
                    {STATUS_LABELS[step]}
                  </div>
                  {historyEntry && (
                    <div className="timeline-meta">
                      {new Date(historyEntry.changed_at).toLocaleString('en-IN')}
                    </div>
                  )}
                  {historyEntry?.notes && (
                    <div className="timeline-notes">"{historyEntry.notes}"</div>
                  )}
                  {isPending && <div className="timeline-meta">Pending</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      {(canCancel) && (
        <div className="dash-card">
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Actions
          </h2>
          <div className="action-bar">
            {canCancel && !cancelConfirm && (
              <button className="btn-danger" onClick={() => setCancelConfirm(true)}>
                Close / Withdraw FIR
              </button>
            )}
            {cancelConfirm && (
              <>
                <span style={{ fontSize: '0.875rem', color: '#dc2626', alignSelf: 'center' }}>
                  {fir.status === 'acknowledged'
                    ? 'This FIR has been acknowledged by an officer. Closing it will mark it as rejected on their end.'
                    : 'Are you sure you want to close this FIR? This cannot be undone.'}
                </span>
                <button className="btn-danger" onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? 'Closing…' : 'Yes, Close FIR'}
                </button>
                <button className="btn-secondary" onClick={() => setCancelConfirm(false)}>
                  No, Keep It
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
