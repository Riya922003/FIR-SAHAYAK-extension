import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import DistrictPicker from '../components/authority/DistrictPicker';
import DistrictStatsRow from '../components/authority/DistrictStats';
import StationHealthList from '../components/authority/StationHealthList';
import StationFIRList from '../components/authority/StationFIRList';
import EscalationQueue from '../components/authority/EscalationQueue';
import { getDistrictStats, getDistrictStations, type DistrictStats, type StationHealth } from '../api/authority';
import '../styles/dashboard.css';
import '../styles/authority.css';

type View = 'dashboard' | 'station-detail' | 'escalations' | 'profile';

export default function AuthorityDashboard() {
  const { user, token, logout } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  // District dashboard data
  const [stats, setStats] = useState<DistrictStats | null>(null);
  const [stations, setStations] = useState<StationHealth[]>([]);
  const [loadingDash, setLoadingDash] = useState(false);
  const [dashError, setDashError] = useState('');

  // Station drill-in
  const [selectedStation, setSelectedStation] = useState<StationHealth | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoadingDash(true);
    setDashError('');
    try {
      const [s, st] = await Promise.all([getDistrictStats(token), getDistrictStations(token)]);
      setStats(s);
      setStations(st);
    } catch (e) {
      setDashError(e instanceof Error ? e.message : 'Failed to load district data');
    } finally {
      setLoadingDash(false);
    }
  }, [token]);

  useEffect(() => {
    if (user?.district && view === 'dashboard') {
      loadDashboard();
    }
  }, [user?.district, view, loadDashboard]);

  // First login — no district set yet
  if (!user?.district) return <DistrictPicker />;

  const initials = user.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleDrillIn = (station: StationHealth) => {
    setSelectedStation(station);
    setView('station-detail');
  };

  const handleBack = () => {
    setSelectedStation(null);
    setView('dashboard');
  };

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ── */}
      <aside className={`dashboard-sidebar authority-sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            {!collapsed && (
              <div className="sidebar-brand-text">
                <h2>FIR Sahayak</h2>
                <span>Authority Portal</span>
              </div>
            )}
            <button
              className="sidebar-toggle"
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-item${view === 'dashboard' || view === 'station-detail' ? ' active authority-active' : ''}`}
            onClick={() => { setView('dashboard'); setSelectedStation(null); }}
            title={collapsed ? 'Dashboard' : undefined}
          >
            <span className="item-icon">📊</span>
            <span className="item-label">Dashboard</span>
          </button>

          <button
            className={`sidebar-item${view === 'escalations' ? ' active authority-active' : ''}`}
            onClick={() => setView('escalations')}
            title={collapsed ? 'Escalations' : undefined}
          >
            <span className="item-icon">🚨</span>
            <span className="item-label">Escalations</span>
          </button>

          <button
            className="sidebar-item disabled"
            title={collapsed ? 'Active Cases (coming soon)' : undefined}
          >
            <span className="item-icon">📁</span>
            <span className="item-label">
              Active Cases
              <span className="soon-badge">Soon</span>
            </span>
          </button>

          <button
            className="sidebar-item disabled"
            title={collapsed ? 'Stations (coming soon)' : undefined}
          >
            <span className="item-icon">🏛️</span>
            <span className="item-label">
              Stations
              <span className="soon-badge">Soon</span>
            </span>
          </button>

          <div className="sidebar-divider" style={{ marginTop: 'auto' }} />

          <button
            className={`sidebar-item${view === 'profile' ? ' active authority-active' : ''}`}
            onClick={() => setView('profile')}
            title={collapsed ? 'My Profile' : undefined}
          >
            <span className="item-icon">👤</span>
            <span className="item-label">My Profile</span>
          </button>

          <button
            className="sidebar-item sidebar-logout"
            onClick={logout}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <span className="item-icon">🚪</span>
            <span className="item-label">Sign Out</span>
          </button>
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className={`dashboard-main${collapsed ? ' sidebar-collapsed' : ''}`}>

        {/* ── District Dashboard ── */}
        {(view === 'dashboard') && (
          <div>
            <div className="dash-header">
              <div>
                <h1>District Overview</h1>
                <p>Oversight portal for <strong>{user.district}</strong> district</p>
              </div>
              <button
                className="btn-refresh"
                onClick={loadDashboard}
                disabled={loadingDash}
                title="Refresh"
              >
                {loadingDash ? '…' : '↻'} Refresh
              </button>
            </div>

            {dashError && <div className="dash-error">⚠ {dashError}</div>}

            {loadingDash && !stats ? (
              <div className="dash-loading">Loading district data…</div>
            ) : stats ? (
              <>
                <DistrictStatsRow stats={stats} district={user.district} />
                <div style={{ marginTop: '1.5rem' }}>
                  <StationHealthList stations={stations} onDrillIn={handleDrillIn} />
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── Escalation Queue ── */}
        {view === 'escalations' && <EscalationQueue />}

        {/* ── Station FIR drill-in ── */}
        {view === 'station-detail' && selectedStation && (
          <StationFIRList station={selectedStation} onBack={handleBack} />
        )}

        {/* ── Profile ── */}
        {view === 'profile' && (
          <div>
            <div className="dash-header">
              <h1>My Profile</h1>
              <p>Your account and jurisdiction information</p>
            </div>

            <div className="dash-card profile-card">
              <div className="profile-avatar authority-avatar">{initials}</div>
              <div className="profile-name">{user.full_name}</div>
              <div className="profile-role-badge authority-role-badge">Higher Authority</div>

              <div className="profile-fields">
                <div className="profile-field">
                  <label>Email Address</label>
                  <span>{user.email}</span>
                </div>
                <div className="profile-field">
                  <label>Username</label>
                  <span>@{user.username}</span>
                </div>
                <div className="profile-field">
                  <label>Phone</label>
                  <span>{user.phone}</span>
                </div>
                <div className="profile-field">
                  <label>Assigned District</label>
                  <span style={{ fontWeight: 600 }}>{user.district}</span>
                </div>
                <div className="profile-field">
                  <label>Account Status</label>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Active</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
