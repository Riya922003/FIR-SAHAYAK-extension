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
  const [mobileOpen, setMobileOpen] = useState(false);

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
    setMobileOpen(false);
  };

  const isActive = (...views: View[]) => views.includes(view);

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={`dashboard-sidebar authority-sidebar${collapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' sidebar-mobile-open' : ''}`}>
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
            <span className="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
            <span className="item-label">Dashboard</span>
          </button>

          <button
            className={`sidebar-item${isActive('escalations') ? ' active authority-active' : ''}`}
            onClick={() => navTo('escalations')}
            title={collapsed ? 'Escalations' : undefined}
          >
            <span className="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
            <span className="item-label">Escalations</span>
          </button>

          <button
            className={`sidebar-item${isActive('active-cases', 'fir-detail') ? ' active authority-active' : ''}`}
            onClick={() => navTo('active-cases')}
            title={collapsed ? 'Active Cases' : undefined}
          >
            <span className="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
            <span className="item-label">Active Cases</span>
          </button>

          <button
            className={`sidebar-item${isActive('stations') ? ' active authority-active' : ''}`}
            onClick={() => navTo('stations')}
            title={collapsed ? 'Stations' : undefined}
          >
            <span className="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg></span>
            <span className="item-label">Stations</span>
          </button>

          <button
            className={`sidebar-item${isActive('officers') ? ' active authority-active' : ''}`}
            onClick={() => navTo('officers')}
            title={collapsed ? 'Officers' : undefined}
          >
            <span className="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
            <span className="item-label">Officers</span>
          </button>

          <button
            className={`sidebar-item${isActive('directives') ? ' active authority-active' : ''}`}
            onClick={() => navTo('directives')}
            title={collapsed ? 'Directives' : undefined}
          >
            <span className="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
            <span className="item-label">Directives</span>
          </button>

          <div className="sidebar-divider" style={{ marginTop: 'auto' }} />

          <button
            className={`sidebar-item${isActive('profile') ? ' active authority-active' : ''}`}
            onClick={() => navTo('profile')}
            title={collapsed ? 'My Profile' : undefined}
          >
            <span className="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
            <span className="item-label">My Profile</span>
          </button>

          <button
            className="sidebar-item sidebar-logout"
            onClick={logout}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <span className="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
            <span className="item-label">Sign Out</span>
          </button>
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className={`dashboard-main${collapsed ? ' sidebar-collapsed' : ''}`}>

        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(o => !o)} aria-label="Open menu">
            ☰
          </button>
          <span className="mobile-topbar-brand">FIR Sahayak</span>
          <span style={{ width: 36 }} />
        </div>

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
