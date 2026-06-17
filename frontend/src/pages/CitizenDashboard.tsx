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

const NAV_ITEMS: { view: View; label: string; disabled?: boolean }[] = [
  { view: 'overview',  label: 'Overview' },
  { view: 'my-firs',   label: 'My FIRs' },
  { view: 'file-fir',  label: 'File Complaint' },
];

const NAV_BOTTOM = [
  { view: 'profile' as View, label: 'My Profile' },
];

export default function CitizenDashboard() {
  const { token, user } = useAuth();
  const [view, setView] = useState<View>('overview');
  const [selectedFirId, setSelectedFirId] = useState<string | null>(null);
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

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
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <h2>FIR Sahayak</h2>
          <span>Citizen Portal</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.view}
              className={`sidebar-item${view === item.view || (item.view === 'my-firs' && view === 'detail') ? ' active' : ''}${item.disabled ? ' disabled' : ''}`}
              onClick={() => !item.disabled && navigate(item.view)}
            >
              {item.label}
            </button>
          ))}

          <div className="sidebar-divider" />

          <button className="sidebar-item disabled" title="Coming soon">
            AI Help
            <span style={{ marginLeft: 'auto', fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>Soon</span>
          </button>

          <div className="sidebar-divider" style={{ marginTop: 'auto' }} />

          {NAV_BOTTOM.map(item => (
            <button
              key={item.view}
              className={`sidebar-item${view === item.view ? ' active' : ''}`}
              onClick={() => navigate(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="dashboard-main">

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
