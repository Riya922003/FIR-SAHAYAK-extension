import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import DistrictPicker from '../components/authority/DistrictPicker';
import '../styles/dashboard.css';
import '../styles/authority.css';

type View = 'dashboard' | 'profile';

export default function AuthorityDashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  // First login — no district set yet
  if (!user?.district) return <DistrictPicker />;

  const initials = user.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
            className={`sidebar-item${view === 'dashboard' ? ' active authority-active' : ''}`}
            onClick={() => setView('dashboard')}
            title={collapsed ? 'Dashboard' : undefined}
          >
            <span className="item-icon">📊</span>
            <span className="item-label">Dashboard</span>
          </button>

          <button
            className="sidebar-item disabled"
            title={collapsed ? 'Escalations (coming soon)' : undefined}
          >
            <span className="item-icon">🚨</span>
            <span className="item-label">
              Escalations
              <span className="soon-badge">Soon</span>
            </span>
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

        {view === 'dashboard' && (
          <div>
            <div className="dash-header">
              <h1>District Overview</h1>
              <p>Oversight portal for {user.district} district</p>
            </div>

            <div className="authority-placeholder-card">
              <div className="authority-placeholder-icon">🏛️</div>
              <h2>Phase 2 — Coming Next</h2>
              <p>
                The district dashboard with station health, escalation counts,
                active FIR analytics, and overdue alerts is being built.
              </p>
              <div className="authority-district-badge">
                <span className="authority-district-label">Your District</span>
                <span className="authority-district-value">{user.district}</span>
              </div>
            </div>
          </div>
        )}

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
