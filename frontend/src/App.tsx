import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CitizenDashboard from './pages/CitizenDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import AuthorityDashboard from './pages/AuthorityDashboard';
import { Component, ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/react';

/* ── Error Boundary — catches render errors and shows them instead of blank ── */
interface EBState { hasError: boolean; message: string }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: '' };
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh',
          fontFamily: 'monospace', background: '#fff5f5', color: '#c00',
          padding: '2rem', gap: '1rem',
        }}>
          <h2>⚠ Dashboard crashed</h2>
          <p style={{ background: '#fee', padding: '1rem', borderRadius: 8, maxWidth: 600, wordBreak: 'break-word' }}>
            {this.state.message}
          </p>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
            style={{ padding: '0.6rem 1.4rem', background: '#c00', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Clear session & go to Login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function getHomeRoute(role: string): string {
  if (role === 'higher_authority') return '/authority';
  if (role === 'officer' || role === 'station_admin') return '/officer';
  return '/dashboard';
}

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles: string[] }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to={getHomeRoute(user.role)} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['citizen']}>
            <ErrorBoundary>
              <CitizenDashboard />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/officer"
        element={
          <ProtectedRoute allowedRoles={['officer', 'station_admin']}>
            <ErrorBoundary>
              <OfficerDashboard />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/authority"
        element={
          <ProtectedRoute allowedRoles={['higher_authority']}>
            <ErrorBoundary>
              <AuthorityDashboard />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
      <Analytics />
    </BrowserRouter>
  );
}
