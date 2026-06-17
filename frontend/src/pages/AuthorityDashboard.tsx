import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import DistrictPicker from '../components/authority/DistrictPicker';
import DistrictStatsRow from '../components/authority/DistrictStats';
import StationHealthList from '../components/authority/StationHealthList';
import StationFIRList from '../components/authority/StationFIRList';
import EscalationQueue from '../components/authority/EscalationQueue';
import ActiveCases from '../components/authority/ActiveCases';
import FIRDetailAuthority from '../components/authority/FIRDetailAuthority';
import DirectivesLog from '../components/authority/DirectivesLog';
import OfficerManagement from '../components/authority/OfficerManagement';
import { getDistrictStats, getDistrictStations, type DistrictStats, type StationHealth } from '../api/authority';
import '../styles/dashboard.css';
import '../styles/authority.css';

type View =
  | 'dashboard' | 'station-detail'
  | 'escalations' | 'active-cases' | 'fir-detail'
  | 'stations' | 'directives' | 'officers' | 'profile';

export default function AuthorityDashboard() {
  const { user, token, logout } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  // District dashboard data
  const [stats, setStats] = useState<DistrictStats | null>(null);
  const [stations, setStations] = useState<StationHealth[]>([]);
  const [loadingDash, setLoadingDash] = useState(false);
  const [dashError, setDashError] = useState('');

  // Drill-in targets
  const [selectedStation, setSelectedStation] = useState<StationHealth | null>(null);
  const [selectedFirId, setSelectedFirId] = useState<string | null>(null);
  // Track where FIR detail was opened from so back navigates correctly
  const [firDetailOrigin, setFirDetailOrigin] = useState<View>('active-cases');

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

  // Load stations for 'stations' view (reuse if already loaded from dashboard)
  const loadStationsOnly = useCallback(async () => {
    if (!token || stations.length > 0) return;
    getDistrictStations(token).then(setStations).catch(() => {});
  }, [token, stations.length]);

  useEffect(() => {
    if (!user?.district) return;
    if (view === 'dashboard') loadDashboard();
    if (view === 'stations') loadStationsOnly();
  }, [view, user?.district]);

  if (!user?.district) return <DistrictPicker />;

  const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleStationDrillIn = (station: StationHealth) => {
    setSelectedStation(station);
    setView('station-detail');
  };

  const handleFIRSelect = (firId: string, origin: View) => {
    setSelectedFirId(firId);
    setFirDetailOrigin(origin);
    setView('fir-detail');
  };

  const handleBack = () => {
    setSelectedStation(null);
    setSelectedFirId(null);
    setView(view === 'station-detail'
      ? (selectedStation ? (firDetailOrigin === 'stations' ? 'stations' : 'dashboard') : 'dashboard')
      : firDetailOrigin,
    );
  };

  const navTo = (v: View) => {
    setSelectedStation(null);
    setSelectedFirId(null);
    setView(v);
  };

  const isActive = (...views: View[]) => views.includes(view);

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
            className={`sidebar-item${isActive('dashboard', 'station-detail') ? ' active authority-active' : ''}`}
            onClick={() => navTo('dashboard')}
            title={collapsed ? 'Dashboard' : undefined}
          >
            <span className="item-icon">📊</span>
            <span className="item-label">Dashboard</span>
          </button>

          <button
            className={`sidebar-item${isActive('escalations') ? ' active authority-active' : ''}`}
            onClick={() => navTo('escalations')}
            title={collapsed ? 'Escalations' : undefined}
          >
            <span className="item-icon">🚨</span>
            <span className="item-label">Escalations</span>
          </button>

          <button
            className={`sidebar-item${isActive('active-cases', 'fir-detail') ? ' active authority-active' : ''}`}
            onClick={() => navTo('active-cases')}
            title={collapsed ? 'Active Cases' : undefined}
          >
            <span className="item-icon">📁</span>
            <span className="item-label">Active Cases</span>
          </button>

          <button
            className={`sidebar-item${isActive('stations') ? ' active authority-active' : ''}`}
            onClick={() => navTo('stations')}
            title={collapsed ? 'Stations' : undefined}
          >
            <span className="item-icon">🏛️</span>
            <span className="item-label">Stations</span>
          </button>

          <button
            className={`sidebar-item${isActive('officers') ? ' active authority-active' : ''}`}
            onClick={() => navTo('officers')}
            title={collapsed ? 'Officers' : undefined}
          >
            <span className="item-icon">👮</span>
            <span className="item-label">Officers</span>
          </button>

          <button
            className={`sidebar-item${isActive('directives') ? ' active authority-active' : ''}`}
            onClick={() => navTo('directives')}
            title={collapsed ? 'Directives' : undefined}
          >
            <span className="item-icon">📋</span>
            <span className="item-label">Directives</span>
          </button>

          <div className="sidebar-divider" style={{ marginTop: 'auto' }} />

          <button
            className={`sidebar-item${isActive('profile') ? ' active authority-active' : ''}`}
            onClick={() => navTo('profile')}
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

        {/* Dashboard */}
        {view === 'dashboard' && (
          <div>
            <div className="dash-header">
              <div>
                <h1>District Overview</h1>
                <p>Oversight portal for <strong>{user.district}</strong> district</p>
              </div>
              <button className="btn-refresh" onClick={loadDashboard} disabled={loadingDash}>
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
                  <StationHealthList stations={stations} onDrillIn={handleStationDrillIn} />
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Station FIR drill-in (from dashboard or stations view) */}
        {view === 'station-detail' && selectedStation && (
          <StationFIRList station={selectedStation} onBack={() => navTo(firDetailOrigin === 'stations' ? 'stations' : 'dashboard')} />
        )}

        {/* Escalations */}
        {view === 'escalations' && (
          <EscalationQueue onSelectFIR={id => handleFIRSelect(id, 'escalations')} />
        )}

        {/* Active Cases */}
        {view === 'active-cases' && (
          <ActiveCases onSelect={id => handleFIRSelect(id, 'active-cases')} />
        )}

        {/* FIR Detail (authority perspective) */}
        {view === 'fir-detail' && selectedFirId && (
          <FIRDetailAuthority
            firId={selectedFirId}
            onBack={() => navTo(firDetailOrigin)}
          />
        )}

        {/* Stations */}
        {view === 'stations' && (
          <div>
            <div className="dash-header">
              <div>
                <h1>Stations</h1>
                <p>All police stations in <strong>{user.district}</strong> district</p>
              </div>
              <button className="btn-refresh" onClick={loadStationsOnly} disabled={loadingDash}>
                ↻ Refresh
              </button>
            </div>
            <StationHealthList
              stations={stations}
              onDrillIn={st => {
                setFirDetailOrigin('stations');
                handleStationDrillIn(st);
              }}
            />
          </div>
        )}

        {/* Officers */}
        {view === 'officers' && <OfficerManagement />}

        {/* Directives */}
        {view === 'directives' && <DirectivesLog />}

        {/* Profile */}
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
                <div className="profile-field"><label>Email Address</label><span>{user.email}</span></div>
                <div className="profile-field"><label>Username</label><span>@{user.username}</span></div>
                <div className="profile-field"><label>Phone</label><span>{user.phone}</span></div>
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
