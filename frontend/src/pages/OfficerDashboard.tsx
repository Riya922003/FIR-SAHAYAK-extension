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

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar officer-sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
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
            onClick={() => setView('queue')}
            title={collapsed ? 'Unassigned Queue' : undefined}
          >
            <span className="item-icon">📥</span>
            <span className="item-label">Unassigned Queue</span>
          </button>
          <button
            className={`sidebar-item${isActive('my-cases') ? ' active officer-active' : ''}`}
            onClick={() => setView('my-cases')}
            title={collapsed ? 'My Cases' : undefined}
          >
            <span className="item-icon">📁</span>
            <span className="item-label">My Cases</span>
          </button>
          {isAdmin && (
            <button
              className={`sidebar-item${isActive('all-cases') ? ' active officer-active' : ''}`}
              onClick={() => setView('all-cases')}
              title={collapsed ? 'All Station Cases' : undefined}
            >
              <span className="item-icon">🗂️</span>
              <span className="item-label">All Station Cases</span>
            </button>
          )}

          <div className="sidebar-divider" style={{ marginTop: 'auto' }} />

          <button
            className={`sidebar-item${view === 'profile' ? ' active officer-active' : ''}`}
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

      {/* Main content */}
      <main className={`dashboard-main${collapsed ? ' sidebar-collapsed' : ''}`}>
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
