import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getFIRDetail, type FIRDetail, STATUS_LABELS, STATUS_COLORS, INCIDENT_LABELS } from '../../api/fir';
import { postFIRNote } from '../../api/authority';

interface Props {
  firId: string;
  onBack: () => void;
}

export default function FIRDetailAuthority({ firId, onBack }: Props) {
  const { token } = useAuth();
  const [fir, setFir] = useState<FIRDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getFIRDetail(token, firId)
      .then(setFir)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load FIR'))
      .finally(() => setLoading(false));
  }, [token, firId]);

  const handleNote = async () => {
    if (!token || !fir) return;
    if (note.trim().length < 5) { setNoteError('Note must be at least 5 characters.'); return; }
    setSaving(true); setNoteError(''); setNoteSaved(false);
    try {
      await postFIRNote(token, fir.id, note.trim());
      setNote('');
      setNoteSaved(true);
      // Refresh FIR to pick up new history entry
      const updated = await getFIRDetail(token, firId);
      setFir(updated);
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="dash-loading">Loading FIR…</div>;
  if (error)   return <div className="dash-error">⚠ {error}</div>;
  if (!fir)    return null;

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
        </div>
        <p>Filed {new Date(fir.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Incident Details */}
      <div className="dash-card">
        <h2 className="section-label">
          Incident Details
        </h2>
        <div className="fir-detail-grid">
          <div className="detail-row"><label>Incident Type</label><span>{INCIDENT_LABELS[fir.incident_type]}</span></div>
          <div className="detail-row">
            <label>Incident Date</label>
            <span>{new Date(fir.incident_date).toLocaleDateString('en-IN')}{fir.incident_time ? ` at ${fir.incident_time}` : ''}</span>
          </div>
          <div className="detail-row"><label>Location</label><span>{fir.incident_location}</span></div>
          {fir.ipc_sections && <div className="detail-row"><label>IPC Sections</label><span>{fir.ipc_sections}</span></div>}
          <div className="detail-row detail-description">
            <label>Description</label>
            <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{fir.description}</span>
          </div>
          {fir.witness_info && (
            <div className="detail-row detail-description"><label>Witness Info</label><span>{fir.witness_info}</span></div>
          )}
        </div>
      </div>

      {/* Complainant */}
      <div className="dash-card">
        <h2 className="section-label">
          Complainant
        </h2>
        <div className="fir-detail-grid">
          <div className="detail-row"><label>Name</label><span>{fir.complainant_name}</span></div>
          <div className="detail-row"><label>Phone</label><span>{fir.complainant_phone}</span></div>
          <div className="detail-row"><label>Address</label><span>{fir.complainant_address}</span></div>
        </div>
      </div>

      {/* Status History */}
      <div className="dash-card">
        <h2 className="section-label">
          Status History
        </h2>
        {fir.status_history.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No history recorded.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[...fir.status_history].reverse().map((h, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: '1rem', padding: '0.75rem',
                  background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)',
                  borderLeft: `3px solid ${STATUS_COLORS[h.new_status]}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: STATUS_COLORS[h.new_status], fontSize: 'var(--text-sm)' }}>
                    {STATUS_LABELS[h.new_status]}
                  </div>
                  {h.notes && (
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-mid)', marginTop: '0.25rem' }}>
                      {h.notes}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                  {new Date(h.changed_at).toLocaleDateString('en-IN')}
                  <br />
                  {new Date(h.changed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Authority Note */}
      <div className="dash-card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Add Authority Note
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
          Notes are recorded in the FIR history and visible to the assigned officer.
        </p>
        <textarea
          value={note}
          onChange={e => { setNote(e.target.value); setNoteError(''); setNoteSaved(false); }}
          placeholder="Enter your note or observation…"
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '0.65rem 0.75rem', fontSize: '0.875rem', fontFamily: 'inherit',
            marginBottom: '0.6rem',
          }}
        />
        {noteError && <div style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: '0.5rem' }}>⚠ {noteError}</div>}
        {noteSaved && <div style={{ fontSize: '0.8rem', color: '#22c55e', marginBottom: '0.5rem' }}>✓ Note saved.</div>}
        <button
          className="btn-primary"
          style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}
          onClick={handleNote}
          disabled={saving || note.trim().length < 5}
        >
          {saving ? 'Saving…' : 'Save Note'}
        </button>
      </div>
    </>
  );
}
