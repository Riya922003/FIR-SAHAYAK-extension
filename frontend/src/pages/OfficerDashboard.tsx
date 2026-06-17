import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import UnassignedQueue from '../components/officer/UnassignedQueue';
import OfficerMyCases from '../components/officer/OfficerMyCases';
import OfficerFIRDetail from '../components/officer/OfficerFIRDetail';
import AllCases from '../components/officer/AllCases';
import '../styles/officer.css';

type View = 'queue' | 'my-cases' | 'detail' | 'all-cases';

export default function OfficerDashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('queue');
  const [selectedFirId, setSelectedFirId] = useState<string | null>(null);
  const [detailSource, setDetailSource] = useState<View>('queue');
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = user?.role === 'station_admin' || user?.role === 'higher_authority';

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
      <aside className="dashboard-sidebar officer-sidebar">
        <div className="sidebar-brand">
          <h2>FIR Sahayak</h2>
          <span>{isAdmin ? 'Admin Portal' : 'Officer Portal'}</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-item${isActive('queue') ? ' active officer-active' : ''}`}
            onClick={() => setView('queue')}
          >
            Unassigned Queue
          </button>
          <button
            className={`sidebar-item${isActive('my-cases') ? ' active officer-active' : ''}`}
            onClick={() => setView('my-cases')}
          >
            My Cases
          </button>
          {isAdmin && (
            <button
              className={`sidebar-item${isActive('all-cases') ? ' active officer-active' : ''}`}
              onClick={() => setView('all-cases')}
            >
              All Station Cases
            </button>
          )}

          <div className="sidebar-divider" style={{ marginTop: 'auto' }} />

          <div className="sidebar-user">
            <div className="sidebar-user-name">{user?.full_name}</div>
            <div className="sidebar-user-role">{user?.role?.replace(/_/g, ' ')}</div>
          </div>

          <button className="sidebar-item sidebar-logout" onClick={logout}>
            Sign Out
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="dashboard-main">
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
      </main>
    </div>
  );
}
