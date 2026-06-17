import type { DistrictStats } from '../../api/authority';

interface Props {
  stats: DistrictStats;
  district: string;
}

export default function DistrictStatsRow({ stats, district }: Props) {
  return (
    <div className="authority-stats">
      <div className="authority-stat-card" style={{ borderTopColor: '#3b82f6' }}>
        <div className="authority-stat-num" style={{ color: '#3b82f6' }}>
          {stats.total_stations}
        </div>
        <div className="authority-stat-label">Stations in {district}</div>
      </div>

      <div className="authority-stat-card" style={{ borderTopColor: '#1d4ed8' }}>
        <div className="authority-stat-num" style={{ color: '#1d4ed8' }}>
          {stats.total_active_firs}
        </div>
        <div className="authority-stat-label">Active FIRs</div>
      </div>

      {/* Escalations — most prominent */}
      <div
        className="authority-stat-card"
        style={{
          borderTopColor: '#ef4444',
          background: stats.pending_escalations > 0 ? '#fef2f2' : undefined,
        }}
      >
        <div
          className="authority-stat-num"
          style={{
            color: '#ef4444',
            fontSize: stats.pending_escalations > 0 ? '2.25rem' : undefined,
          }}
        >
          {stats.pending_escalations}
        </div>
        <div className="authority-stat-label" style={{ color: stats.pending_escalations > 0 ? '#b91c1c' : undefined }}>
          {stats.pending_escalations > 0 ? '⚠ Escalations Pending' : 'Escalations Pending'}
        </div>
      </div>

      <div className="authority-stat-card" style={{ borderTopColor: '#22c55e' }}>
        <div className="authority-stat-num" style={{ color: '#22c55e' }}>
          {stats.resolved_this_month}
        </div>
        <div className="authority-stat-label">Resolved This Month</div>
      </div>
    </div>
  );
}
