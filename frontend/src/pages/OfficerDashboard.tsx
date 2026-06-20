import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import UnassignedQueue from '../components/officer/UnassignedQueue';
import OfficerMyCases from '../components/officer/OfficerMyCases';
import OfficerFIRDetail from '../components/officer/OfficerFIRDetail';
import AllCases from '../components/officer/AllCases';
import OfficerProfile from '../components/officer/OfficerProfile';
import StationPicker from '../components/officer/StationPicker';
import '../styles/officer.css';

type View = 'queue' | 'my-cases' | 'detail' | 'all-cases' | 'profile';

export default function OfficerDashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('queue');
  const [selectedFirId, setSelectedFirId] = useState<string | null>(null);
  const [detailSource, setDetailSource] = useState<View>('queue');
  const [refreshKey, setRefreshKey] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === 'station_admin' || user?.role === 'higher_authority';

  // First login — no station assigned yet
  if (!user?.station_id) return <StationPicker />;

  const goToDetail = (id: string, from: View = view) => {
    setSelectedFirId(id);
    setDetailSource(from as View);
    setView('detail');
  };

  const handleBack = () => {
    setView(detailSource === 'all-cases' ? 'all-cases' : detailSource === 'queue' ? 'queue' : 'my-cases');
    setSelectedFirId(null);
  };

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const isActive = (v: View) => view === v || (view === 'detail' && detailSource === v);

  const navTo = (v: View) => { setView(v); setMobileOpen(false); };

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`dashboard-sidebar officer-sidebar${collapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' sidebar-mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            {!collapsed && (
              <div className="sidebar-brand-text">
                <h2>FIR Sahayak</h2>
                <span>{isAdmin ? 'Admin Portal' : 'Officer Portal'}</span>
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
            className={`sidebar-item${isActive('queue') ? ' active officer-active' : ''}`}
            onClick={() => navTo('queue')}
            title={collapsed ? 'Unassigned Queue' : undefined}
          >
            <span className="item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
              </svg>
            </span>
            <span className="item-label">Unassigned Queue</span>
          </button>
          <button
            className={`sidebar-item${isActive('my-cases') ? ' active officer-active' : ''}`}
            onClick={() => navTo('my-cases')}
            title={collapsed ? 'My Cases' : undefined}
          >
            <span className="item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </span>
            <span className="item-label">My Cases</span>
          </button>
          {isAdmin && (
            <button
              className={`sidebar-item${isActive('all-cases') ? ' active officer-active' : ''}`}
              onClick={() => navTo('all-cases')}
              title={collapsed ? 'All Station Cases' : undefined}
            >
              <span className="item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="17" width="20" height="4" rx="1"/>
                </svg>
              </span>
              <span className="item-label">All Station Cases</span>
            </button>
          )}

          <div className="sidebar-divider" style={{ marginTop: 'auto' }} />

          <button
            className={`sidebar-item${view === 'profile' ? ' active officer-active' : ''}`}
            onClick={() => navTo('profile')}
            title={collapsed ? 'My Profile' : undefined}
          >
            <span className="item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <span className="item-label">My Profile</span>
          </button>

          <button
            className="sidebar-item sidebar-logout"
            onClick={logout}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <span className="item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </span>
            <span className="item-label">Sign Out</span>
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className={`dashboard-main${collapsed ? ' sidebar-collapsed' : ''}`}>
        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(o => !o)} aria-label="Open menu">
            ☰
          </button>
          <span className="mobile-topbar-brand">FIR Sahayak</span>
          <span style={{ width: 36 }} />
        </div>
        {view === 'queue' && (
          <UnassignedQueue key={refreshKey} onViewFIR={id => goToDetail(id, 'queue')} />
        )}
        {view === 'my-cases' && (
          <OfficerMyCases key={refreshKey} onViewFIR={id => goToDetail(id, 'my-cases')} />
        )}
        {view === 'all-cases' && (
          <AllCases key={refreshKey} onViewFIR={id => goToDetail(id, 'all-cases')} />
        )}
        {view === 'detail' && selectedFirId && (
          <OfficerFIRDetail
            key={selectedFirId}
            firId={selectedFirId}
            onBack={handleBack}
            onRefresh={handleRefresh}
          />
        )}
        {view === 'profile' && <OfficerProfile />}
      </main>
    </div>
  );
}
