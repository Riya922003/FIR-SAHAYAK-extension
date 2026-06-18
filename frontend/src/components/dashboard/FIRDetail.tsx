import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getFIRDetail, cancelFIR, escalateFIR, type FIRDetail as FIRDetailType, type FIRStatus, STATUS_LABELS, INCIDENT_LABELS } from '../../api/fir';

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
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [escalateError, setEscalateError] = useState('');

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

  const handleEscalate = async () => {
    if (!token || !fir) return;
    if (escalateReason.trim().length < 30) {
      setEscalateError('Please provide at least 30 characters explaining why you are escalating.');
      return;
    }
    setEscalating(true);
    setEscalateError('');
    try {
      await escalateFIR(token, fir.id, escalateReason.trim());
      onRefresh();
      onBack();
    } catch (e: unknown) {
      setEscalateError(e instanceof Error ? e.message : 'Escalation failed');
    } finally {
      setEscalating(false);
    }
  };

  if (loading) return <div className="dash-loading">Loading FIR details…</div>;
  if (error) return <div className="dash-error">⚠ {error}</div>;
  if (!fir) return null;

  const isTerminal = TERMINAL.includes(fir.status);
  const canCancel = ['submitted', 'draft', 'acknowledged'].includes(fir.status);
  const canEscalate = ['acknowledged', 'under_investigation'].includes(fir.status);

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
          <span className={`status-badge status-badge--${fir.status}`}>
            {STATUS_LABELS[fir.status]}
          </span>
        </div>
        <p>Filed on {new Date(fir.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* FIR Info */}
      <div className="dash-card">
        <h2 className="section-label">
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
        <h2 className="section-label">
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

      {/* Escalated info box (citizen visibility — Phase 9) */}
      {fir.status === 'escalated' && (
        <div style={{
          background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12,
          padding: '1rem 1.25rem', marginBottom: '1rem',
          display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>⚠</span>
          <div>
            <div style={{ fontWeight: 700, color: '#9a3412', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              Escalated to District Higher Authority
            </div>
            <div style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: 1.6 }}>
              Your FIR has been escalated and is now under review by the district authority. You will be notified if any action is taken. You can no longer close or withdraw this FIR.
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {(canCancel || canEscalate) && (
        <div className="dash-card">
          <h2 className="section-label">
            Actions
          </h2>

          {/* Close / Withdraw */}
          {canCancel && (
            <div className="action-bar" style={{ marginBottom: canEscalate ? '1rem' : 0 }}>
              {!cancelConfirm && (
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
          )}

          {/* Escalate to Higher Authority */}
          {canEscalate && (
            <div>
              {!showEscalate ? (
                <button
                  className="btn-secondary"
                  style={{ borderColor: '#f97316', color: '#f97316' }}
                  onClick={() => { setShowEscalate(true); setEscalateError(''); }}
                >
                  ⚠ Escalate to Higher Authority
                </button>
              ) : (
                <div style={{ border: '1px solid #fed7aa', borderRadius: 10, padding: '1rem', background: '#fff7ed' }}>
                  <p style={{ fontSize: '0.875rem', color: '#9a3412', margin: '0 0 0.75rem', fontWeight: 600 }}>
                    Escalate to District Authority
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.75rem' }}>
                    Use this if the officer has not taken action or you feel your case needs oversight. The district authority will be notified.
                  </p>
                  <textarea
                    value={escalateReason}
                    onChange={e => setEscalateReason(e.target.value)}
                    placeholder="Explain why you are escalating this FIR (minimum 30 characters)…"
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box', resize: 'vertical',
                      border: '1px solid #e2e8f0', borderRadius: 8,
                      padding: '0.6rem 0.75rem', fontSize: '0.875rem', fontFamily: 'inherit',
                      marginBottom: '0.5rem',
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', color: escalateReason.length < 30 ? '#94a3b8' : '#22c55e', marginBottom: '0.75rem' }}>
                    {escalateReason.length}/30 min characters
                  </div>
                  {escalateError && (
                    <div style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: '0.75rem' }}>⚠ {escalateError}</div>
                  )}
                  <div className="action-bar">
                    <button
                      className="btn-primary"
                      style={{ background: '#f97316', borderColor: '#f97316' }}
                      onClick={handleEscalate}
                      disabled={escalating || escalateReason.trim().length < 30}
                    >
                      {escalating ? 'Escalating…' : 'Submit Escalation'}
                    </button>
                    <button className="btn-secondary" onClick={() => { setShowEscalate(false); setEscalateError(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
