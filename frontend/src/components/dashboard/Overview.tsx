import { Fragment } from 'react';
import { FIR, FIRStatus, STATUS_COLORS, INCIDENT_LABELS } from '../../api/fir';

interface Props {
  firs: FIR[];
  loading: boolean;
  onViewFIR: (id: string) => void;
  onFileFIR: () => void;
}

const ACTIVE: FIRStatus[] = ['SUBMITTED', 'ACKNOWLEDGED', 'UNDER_INVESTIGATION'];
const TERMINAL: FIRStatus[] = ['REJECTED', 'CLOSED', 'ESCALATED'];

const BASE_STEPS: { status: FIRStatus; label: string }[] = [
  { status: 'SUBMITTED',          label: 'Filed' },
  { status: 'ACKNOWLEDGED',       label: 'Acknowledged' },
  { status: 'UNDER_INVESTIGATION',label: 'Investigating' },
  { status: 'RESOLVED',           label: 'Resolved' },
];

const TERMINAL_LABELS: Partial<Record<FIRStatus, string>> = {
  REJECTED: 'Rejected',
  CLOSED:   'Closed',
  ESCALATED:'Escalated',
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
        <div className="ov-empty-graphic">
          <div className="ov-empty-shield">🛡️</div>
        </div>
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
        style={{ borderTop: `4px solid ${STATUS_COLORS[hero.status]}` }}
        onClick={() => onViewFIR(hero.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onViewFIR(hero.id)}
      >
        {/* Eyebrow */}
        <div className="ov-eyebrow">
          {isActive
            ? <><span className="ov-live-dot" />Active Case</>
            : <span>📁 Most Recent Case</span>}
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
            <span
              className="ov-status-pill"
              style={{
                background: STATUS_COLORS[hero.status] + '18',
                color: STATUS_COLORS[hero.status],
                border: `1px solid ${STATUS_COLORS[hero.status]}40`,
              }}
            >
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
            const isError   = isTerminal && isCurrent && step.status !== 'RESOLVED';
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
                  <div className={`ov-tl-line${isDone ? ' done' : ''}`} />
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Footer */}
        <div className="ov-hero-footer">
          <span>📅 Filed {fmt(hero.created_at)}</span>
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
                <span
                  className="ov-status-pill"
                  style={{
                    background: STATUS_COLORS[fir.status] + '18',
                    color: STATUS_COLORS[fir.status],
                    border: `1px solid ${STATUS_COLORS[fir.status]}40`,
                  }}
                >
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
