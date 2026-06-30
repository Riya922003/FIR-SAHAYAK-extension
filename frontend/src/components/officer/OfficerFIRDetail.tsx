import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getOfficerFIRDetail, updateFIRStatus, OFFICER_TRANSITIONS, NEXT_STATUS_LABELS } from '../../api/officer';
import {
  INCIDENT_LABELS, STATUS_LABELS, ENRICHMENT_LABELS, ENRICHMENT_COLORS,
  type FIRDetail,
} from '../../api/fir';
import { capture } from '../../lib/posthog';

interface Props {
  firId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export default function OfficerFIRDetail({ firId, onBack, onRefresh }: Props) {
  const { token } = useAuth();
  const [fir, setFir] = useState<FIRDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [nextStatus, setNextStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [ipcSections, setIpcSections] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getOfficerFIRDetail(token, firId)
      .then(data => {
        setFir(data);
        const transitions = OFFICER_TRANSITIONS[data.status] ?? [];
        if (transitions.length > 0) setNextStatus(transitions[0]);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load FIR'))
      .finally(() => setLoading(false));
  }, [firId, token]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !fir || !nextStatus) return;
    if (nextStatus === 'rejected' && !notes.trim()) {
      setSubmitError('A rejection reason is required.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await updateFIRStatus(token, fir.id, nextStatus, notes.trim() || undefined, ipcSections.trim() || undefined);
      capture('officer_status_updated', { fir_id: fir.id, fir_number: fir.fir_number, new_status: nextStatus });
      setSubmitSuccess(`Status updated to "${STATUS_LABELS[nextStatus as keyof typeof STATUS_LABELS]}"`);
      onRefresh();
      const updated = await getOfficerFIRDetail(token, firId);
      setFir(updated);
      setNotes('');
      setIpcSections('');
      const next = OFFICER_TRANSITIONS[updated.status] ?? [];
      setNextStatus(next[0] ?? '');
      setTimeout(() => setSubmitSuccess(''), 5000);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="dash-loading">Loading FIR details…</div>;
  if (error) return <div className="dash-error">⚠ {error}</div>;
  if (!fir) return null;

  const validNextStatuses = OFFICER_TRANSITIONS[fir.status] ?? [];
  const isTerminal = validNextStatuses.length === 0;
  const isRejecting = nextStatus === 'rejected';
  const currentIdx = fir.status_history.length - 1;

  const es = fir.enrichment_status;
  const eColor = ENRICHMENT_COLORS[es];
  const eLabel = ENRICHMENT_LABELS[es];

  return (
    <>
      <button className="back-btn" onClick={onBack}>← Back</button>

      {/* Header */}
      <div className="dash-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1>{fir.fir_number}</h1>
          <span className={`status-badge status-badge--${fir.status}`}>
            {STATUS_LABELS[fir.status]}
          </span>
          <span style={{
            fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem',
            borderRadius: 999, border: `1px solid ${eColor}`,
            color: eColor, background: `${eColor}18`,
          }}>
            {eLabel}
          </span>
        </div>
        <p>Filed on {new Date(fir.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Incident details */}
      <div className="dash-card">
        <h2 className="section-label">Incident Details</h2>
        <div className="fir-detail-grid">
          <div className="detail-row"><label>Type</label><span>{INCIDENT_LABELS[fir.incident_type]}</span></div>
          <div className="detail-row"><label>Date &amp; Time</label><span>{new Date(fir.incident_date).toLocaleDateString('en-IN')}{fir.incident_time ? ` at ${fir.incident_time}` : ''}</span></div>
          <div className="detail-row"><label>Location</label><span>{fir.incident_location}</span></div>
          <div className="detail-row"><label>Complainant</label><span>{fir.complainant_name}</span></div>
          <div className="detail-row"><label>Phone</label><span>{fir.complainant_phone}</span></div>
          <div className="detail-row"><label>Address</label><span>{fir.complainant_address}</span></div>
          {fir.ipc_sections && <div className="detail-row"><label>IPC Sections</label><span>{fir.ipc_sections}</span></div>}
          <div className="detail-row detail-description">
            <label>Original Description</label>
            <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{fir.description}</span>
          </div>
          {fir.witness_info && (
            <div className="detail-row detail-description">
              <label>Witness Info</label>
              <span>{fir.witness_info}</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Enrichment — shown to officer when complete or in any state */}
      <div className="dash-card" style={{ borderLeft: es === 'complete' ? '4px solid #22c55e' : '4px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h2 className="section-label" style={{ margin: 0 }}>AI Enrichment</h2>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem',
            borderRadius: 999, background: `${eColor}18`,
            color: eColor, border: `1px solid ${eColor}`,
          }}>
            {eLabel}
          </span>
        </div>

        {es === 'complete' && fir.description_enriched ? (
          <>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
              The citizen completed the AI enrichment interview. Enriched summary below:
            </p>
            <div style={{
              background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
              padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#14532d', lineHeight: 1.7,
            }}>
              {fir.description_enriched}
            </div>
            {fir.suggested_ipc_sections && (
              <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI-Suggested IPC Sections</div>
                <div style={{ fontSize: '0.875rem', color: '#14532d', whiteSpace: 'pre-line' }}>{fir.suggested_ipc_sections}</div>
              </div>
            )}
          </>
        ) : es === 'pending' ? (
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            The citizen has not yet started the AI enrichment interview.
          </p>
        ) : es === 'in_progress' ? (
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            The citizen has started but not yet completed the enrichment interview.
          </p>
        ) : es === 'expired' ? (
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            The enrichment window expired when this FIR was acknowledged. No enrichment data available.
          </p>
        ) : (
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            AI enrichment was not available for this FIR.
          </p>
        )}
      </div>

      {/* Status history */}
      <div className="dash-card">
        <h2 className="section-label">Status Timeline</h2>
        <div className="status-timeline">
          {fir.status_history.map((h, idx) => (
            <div className="timeline-item" key={idx}>
              <div className="timeline-line-col">
                <div className={`timeline-dot ${idx < currentIdx ? 'done' : 'current'}`}>
                  {idx < currentIdx ? '✓' : '●'}
                </div>
                {idx < fir.status_history.length - 1 && <div className="timeline-connector done" />}
              </div>
              <div className="timeline-content">
                <div className="timeline-status">{STATUS_LABELS[h.new_status]}</div>
                <div className="timeline-meta">{new Date(h.changed_at).toLocaleString('en-IN')}</div>
                {h.notes && <div className="timeline-notes">"{h.notes}"</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status update form */}
      {!isTerminal && (
        <div className="dash-card">
          <h2 className="section-label">Update Status</h2>

          {submitSuccess && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
              ✓ {submitSuccess}
            </div>
          )}
          {submitError && <div className="dash-error" style={{ marginBottom: '1rem' }}>⚠ {submitError}</div>}

          <form onSubmit={handleStatusUpdate} className="status-update-form">
            <div className="form-group">
              <label>Next Status</label>
              <div className="status-options">
                {validNextStatuses.map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`status-option-btn${nextStatus === s ? ' selected' : ''}${s === 'rejected' ? ' danger' : ''}`}
                    onClick={() => setNextStatus(s)}
                  >
                    {NEXT_STATUS_LABELS[s] ?? STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
                  </button>
                ))}
              </div>
            </div>

            {isRejecting && (
              <div className="rejection-warning">
                ⚠ This reason will be visible to the citizen. Be clear and professional.
              </div>
            )}

            <div className="form-group">
              <label>{isRejecting ? 'Rejection Reason *' : 'Notes (optional)'}</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                placeholder={isRejecting
                  ? 'Explain why this FIR is being rejected…'
                  : 'Add internal notes about this case…'}
                required={isRejecting}
                className="officer-textarea"
              />
            </div>

            <div className="form-group">
              <label>IPC Sections (optional)</label>
              <input
                type="text"
                value={ipcSections}
                onChange={e => setIpcSections(e.target.value)}
                placeholder="e.g. 302, 420, 307"
                className="officer-input"
              />
            </div>

            <button
              type="submit"
              className={`btn-status-submit${isRejecting ? ' danger' : ''}`}
              disabled={submitting || !nextStatus}
            >
              {submitting ? 'Updating…' : isRejecting ? 'Reject FIR' : 'Update Status'}
            </button>
          </form>
        </div>
      )}

      {isTerminal && (
        <div className="dash-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>
            This FIR is in a terminal state — no further status changes are possible.
          </p>
        </div>
      )}
    </>
  );
}
