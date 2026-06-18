import { Fragment } from 'react';
import type React from 'react';
import { type FIR, type FIRStatus, STATUS_COLORS, INCIDENT_LABELS } from '../../api/fir';

const STATUS_MESSAGES: Partial<Record<FIRStatus, string>> = {
  submitted:           'Your complaint has been received and is awaiting officer assignment.',
  acknowledged:        'An officer has acknowledged your FIR and will begin the investigation shortly.',
  under_investigation: 'Your case is actively being investigated by the assigned officer.',
  resolved:            'This case has been resolved by the station.',
  rejected:            'This FIR was rejected. View details or contact the station for clarification.',
  closed:              'This FIR has been closed.',
  escalated:           'Your case has been escalated to the district authority for review.',
};

interface Props {
  firs: FIR[];
  loading: boolean;
  onViewFIR: (id: string) => void;
  onFileFIR: () => void;
}

const ACTIVE: FIRStatus[] = ['submitted', 'acknowledged', 'under_investigation'];
const TERMINAL: FIRStatus[] = ['rejected', 'closed', 'escalated'];

const BASE_STEPS: { status: FIRStatus; label: string }[] = [
  { status: 'submitted',           label: 'Filed' },
  { status: 'acknowledged',        label: 'Acknowledged' },
  { status: 'under_investigation', label: 'Investigating' },
  { status: 'resolved',            label: 'Resolved' },
];

const TERMINAL_LABELS: Partial<Record<FIRStatus, string>> = {
  rejected: 'Rejected',
  closed:   'Closed',
  escalated:'Escalated',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Overview({ firs, loading, onViewFIR, onFileFIR }: Props) {
  if (loading) return <div className="dash-loading">Fetching your cases…</div>;

  /* ── Empty state ── */
  if (firs.length === 0) {
    return (
      <div className="ov-empty">
        <div className="ov-empty-graphic" />
        <h2>No complaints on record</h2>
        <p>
          Experienced an incident? File an FIR online — it reaches the station instantly
          and you can track every update from this dashboard.
        </p>
        <button className="btn-primary" onClick={onFileFIR}>
          File a Complaint →
        </button>
        <div className="ov-empty-steps">
          <div className="ov-empty-step"><span>1</span>Describe the incident</div>
          <div className="ov-empty-step-arrow">→</div>
          <div className="ov-empty-step"><span>2</span>Select a station</div>
          <div className="ov-empty-step-arrow">→</div>
          <div className="ov-empty-step"><span>3</span>Track in real time</div>
        </div>
      </div>
    );
  }

  /* ── Pick hero FIR: prefer active, else most recent ── */
  const hero = firs.find(f => ACTIVE.includes(f.status)) ?? firs[0];
  const rest  = firs.filter(f => f.id !== hero.id);

  const isTerminal  = TERMINAL.includes(hero.status);
  const isActive    = ACTIVE.includes(hero.status);

  const steps = isTerminal
    ? [...BASE_STEPS.slice(0, 3), { status: hero.status, label: TERMINAL_LABELS[hero.status] ?? hero.status }]
    : BASE_STEPS;

  const currentIdx = steps.findIndex(s => s.status === hero.status);

  return (
    <>
      {/* ══ Active Case Hero ══ */}
      <div
        className="ov-hero"
        style={{ '--hero-status-color': STATUS_COLORS[hero.status] } as React.CSSProperties}
        onClick={() => onViewFIR(hero.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onViewFIR(hero.id)}
      >
        {/* Eyebrow */}
        <div className="ov-eyebrow">
          {isActive
            ? <><span className="ov-live-dot" />Active Case</>
            : <span>Most Recent Case</span>}
        </div>

        {/* Top row: FIR number + status */}
        <div className="ov-hero-top">
          <div className="ov-hero-left">
            <div className="ov-fir-number">{hero.fir_number}</div>
            <div className="ov-fir-meta">
              <span>{INCIDENT_LABELS[hero.incident_type]}</span>
              <span className="ov-dot">·</span>
              <span className="ov-location">{hero.incident_location}</span>
            </div>
          </div>
          <div className="ov-hero-right">
            <span className={`ov-status-pill status-badge--${hero.status}`}>
              {hero.status.replace(/_/g, ' ')}
            </span>
            <div className="ov-updated">Updated {timeAgo(hero.updated_at)}</div>
          </div>
        </div>

        {/* ── Horizontal Status Timeline ── */}
        <div className="ov-timeline">
          {steps.map((step, idx) => {
            const isDone    = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const isError   = isTerminal && isCurrent && step.status !== 'resolved';
            const isPending = idx > currentIdx;
            return (
              <Fragment key={step.status}>
                <div className="ov-tl-step">
                  <div className={[
                    'ov-tl-dot',
                    isDone    ? 'done'    : '',
                    isError   ? 'error'   : '',
                    isCurrent && !isError ? 'current' : '',
                    isPending ? 'pending' : '',
                  ].filter(Boolean).join(' ')}>
                    {isDone ? '✓' : ''}
                  </div>
                  <div className={`ov-tl-label${isPending ? ' muted' : ''}`}>{step.label}</div>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`ov-tl-line${idx < currentIdx ? ' done' : ' pending'}`} />
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Contextual status message */}
        {STATUS_MESSAGES[hero.status] && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 1.25rem', lineHeight: 1.55 }}>
            {STATUS_MESSAGES[hero.status]}
          </p>
        )}

        {/* Footer */}
        <div className="ov-hero-footer">
          <span>Filed {fmt(hero.created_at)}</span>
          <span className="ov-cta-link">View full details →</span>
        </div>
      </div>

      {/* ══ Other Cases (compact list) ══ */}
      {rest.length > 0 && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2>Other Cases <span style={{ fontWeight: 400, color: '#94a3b8' }}>({rest.length})</span></h2>
            <button className="btn-primary" onClick={e => { e.stopPropagation(); onFileFIR(); }}>
              + New Complaint
            </button>
          </div>
          <div className="ov-case-list">
            {rest.map(fir => (
              <div className="ov-case-row" key={fir.id} onClick={() => onViewFIR(fir.id)}>
                <div className="ov-case-info">
                  <span className="ov-case-num">{fir.fir_number}</span>
                  <span className="ov-case-type">{INCIDENT_LABELS[fir.incident_type]}</span>
                  <span className="ov-case-date">
                    {new Date(fir.incident_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <span className={`ov-status-pill status-badge--${fir.status}`}>
                  {fir.status.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* If only one FIR, show a gentle "file another" nudge */}
      {rest.length === 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <button className="btn-secondary" onClick={onFileFIR}>+ File Another Complaint</button>
        </div>
      )}
    </>
  );
}
