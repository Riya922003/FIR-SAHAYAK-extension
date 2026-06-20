import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyFIRs, type FIR } from '../api/fir';
import Overview from '../components/dashboard/Overview';
import MyFIRs from '../components/dashboard/MyFIRs';
import FIRDetail from '../components/dashboard/FIRDetail';
import FileFIR from '../components/dashboard/FileFIR';
import Profile from '../components/dashboard/Profile';
import AiChat from '../components/dashboard/AiChat';
import '../styles/dashboard.css';

type View = 'overview' | 'my-firs' | 'detail' | 'file-fir' | 'profile';

const NAV_ITEMS: { view: View; label: string; icon: ReactNode; disabled?: boolean }[] = [
  { view: 'overview', label: 'Overview', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )},
  { view: 'my-firs', label: 'My FIRs', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )},
  { view: 'file-fir', label: 'File Complaint', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )},
];

export default function CitizenDashboard() {
  const { token, user, logout } = useAuth();
  const [view, setView] = useState<View>('overview');
  const [selectedFirId, setSelectedFirId] = useState<string | null>(null);
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    setMobileOpen(false);
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={`dashboard-sidebar${collapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' sidebar-mobile-open' : ''}`}>
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

          <div className="sidebar-divider" style={{ marginTop: 'auto' }} />

          <button
            className={`sidebar-item${view === 'profile' ? ' active' : ''}`}
            onClick={() => navigate('profile')}
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

        {/* AI Help banner — shown on all views except detail/file-fir */}
        {view !== 'detail' && view !== 'file-fir' && (
          <div className="ai-help-banner" style={{ cursor: 'default' }}>
            <div className="ai-help-banner-body">
              <div className="ai-help-banner-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <div className="ai-help-banner-title">AI Legal Assistant is Live</div>
                <div className="ai-help-banner-sub">Click the chat button in the bottom-right corner to get instant guidance on FIR filing and your legal rights</div>
              </div>
            </div>
            <span className="ai-help-banner-badge" style={{ background: 'var(--color-success)', color: '#fff', borderColor: 'var(--color-success)' }}>Live</span>
          </div>
        )}

        {/* Floating AI chat widget */}
        <AiChat />
      </main>
    </div>
  );
}
