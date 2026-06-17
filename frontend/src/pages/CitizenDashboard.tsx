import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyFIRs, type FIR } from '../api/fir';
import Overview from '../components/dashboard/Overview';
import MyFIRs from '../components/dashboard/MyFIRs';
import FIRDetail from '../components/dashboard/FIRDetail';
import FileFIR from '../components/dashboard/FileFIR';
import Profile from '../components/dashboard/Profile';
import '../styles/dashboard.css';

type View = 'overview' | 'my-firs' | 'detail' | 'file-fir' | 'profile';

const NAV_ITEMS: { view: View; label: string; icon: string; disabled?: boolean }[] = [
  { view: 'overview', label: 'Overview',       icon: '🏠' },
  { view: 'my-firs',  label: 'My FIRs',        icon: '📋' },
  { view: 'file-fir', label: 'File Complaint', icon: '✏️' },
];

export default function CitizenDashboard() {
  const { token, user, logout } = useAuth();
  const [view, setView] = useState<View>('overview');
  const [selectedFirId, setSelectedFirId] = useState<string | null>(null);
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const fetchFIRs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getMyFIRs(token);
      setFirs(data);
    } catch {
      // fail silently — error shown in sub-views
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchFIRs(); }, [fetchFIRs]);

  const goToDetail = (id: string) => {
    setSelectedFirId(id);
    setView('detail');
  };

  const handleFileFIRSuccess = (firNumber: string) => {
    setSuccessMsg(`FIR ${firNumber} filed successfully. Track it under My FIRs.`);
    fetchFIRs();
    setView('my-firs');
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  const navigate = (v: View) => {
    setView(v);
    if (v !== 'detail') setSelectedFirId(null);
  };

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ── */}
      <aside className={`dashboard-sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            {!collapsed && (
              <div className="sidebar-brand-text">
                <h2>FIR Sahayak</h2>
                <span>Citizen Portal</span>
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
          {NAV_ITEMS.map(item => (
            <button
              key={item.view}
              className={`sidebar-item${view === item.view || (item.view === 'my-firs' && view === 'detail') ? ' active' : ''}${item.disabled ? ' disabled' : ''}`}
              onClick={() => !item.disabled && navigate(item.view)}
              title={collapsed ? item.label : undefined}
            >
              <span className="item-icon">{item.icon}</span>
              <span className="item-label">{item.label}</span>
            </button>
          ))}

          <div className="sidebar-divider" />

          <button
            className="sidebar-item disabled"
            title={collapsed ? 'AI Help (Coming soon)' : undefined}
          >
            <span className="item-icon">🤖</span>
            <span className="item-label">
              AI Help
              <span className="soon-badge">Soon</span>
            </span>
          </button>

          <div className="sidebar-divider" style={{ marginTop: 'auto' }} />

          <button
            className={`sidebar-item${view === 'profile' ? ' active' : ''}`}
            onClick={() => navigate('profile')}
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

        {successMsg && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a',
            padding: '0.9rem 1.25rem', borderRadius: 8, marginBottom: '1.5rem',
            fontSize: '0.875rem', fontWeight: 600,
          }}>
            {successMsg}
          </div>
        )}

        {view === 'overview' && (
          <>
            <div className="dash-header">
              <h1>Welcome back, {user?.full_name.split(' ')[0]}</h1>
              <p>Here is a summary of your complaint activity</p>
            </div>
            <Overview
              firs={firs}
              loading={loading}
              onViewFIR={goToDetail}
              onFileFIR={() => navigate('file-fir')}
            />
          </>
        )}

        {view === 'my-firs' && (
          <>
            <div className="dash-header">
              <h1>My FIRs</h1>
              <p>View and manage all your filed complaints</p>
            </div>
            <MyFIRs
              firs={firs}
              loading={loading}
              onViewFIR={goToDetail}
              onFileFIR={() => navigate('file-fir')}
            />
          </>
        )}

        {view === 'detail' && selectedFirId && (
          <FIRDetail
            firId={selectedFirId}
            onBack={() => navigate('my-firs')}
            onRefresh={fetchFIRs}
          />
        )}

        {view === 'file-fir' && (
          <FileFIR
            onSuccess={handleFileFIRSuccess}
            onCancel={() => navigate('my-firs')}
          />
        )}

        {view === 'profile' && (
          <>
            <div className="dash-header">
              <h1>My Profile</h1>
              <p>Your account information</p>
            </div>
            <Profile />
          </>
        )}
      </main>
    </div>
  );
}
