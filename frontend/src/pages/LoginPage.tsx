import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

type LoginRole = 'citizen' | 'officer' | 'authority';

const ROLE_CONFIG: Record<LoginRole, { label: string; subtitle: string; showRegister: boolean; testCreds?: { email: string; password: string } }> = {
  citizen:   { label: 'Citizen',          subtitle: 'File and track your FIR complaints',                 showRegister: true,  testCreds: { email: 'riya@test.com',      password: 'Test@1234'  } },
  officer:   { label: 'Police Officer',   subtitle: 'Manage and resolve FIRs at your station',            showRegister: false, testCreds: { email: 'riya@work.com',      password: 'Riya@@2003' } },
  authority: { label: 'Higher Authority', subtitle: 'District-level oversight and escalation management',  showRegister: false, testCreds: { email: 'riya98012@work.com', password: 'Riya@@2003' } },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [selectedRole, setSelectedRole] = useState<LoginRole>('citizen');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const config = ROLE_CONFIG[selectedRole];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRoleChange = (role: LoginRole) => {
    setSelectedRole(role);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(form);
      const userRole = data.user.role;

      // Guard: warn if the selected portal doesn't match the account role
      if (selectedRole === 'citizen' && userRole !== 'citizen') {
        setError('This is not a citizen account. Please select the correct portal above.');
        return;
      }
      if (selectedRole === 'officer' && !['officer', 'station_admin'].includes(userRole)) {
        setError(userRole === 'higher_authority'
          ? 'This is a Higher Authority account. Please use the Higher Authority portal.'
          : 'This is a citizen account. Please use the Citizen portal.');
        return;
      }
      if (selectedRole === 'authority' && userRole !== 'higher_authority') {
        setError('This is not a Higher Authority account. Please select the correct portal above.');
        return;
      }

      login(data.access_token, data.refresh_token, data.user);
      if (userRole === 'higher_authority') {
        navigate('/authority');
      } else if (userRole === 'officer' || userRole === 'station_admin') {
        navigate('/officer');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-brand">
        <div className="auth-brand-bar" />
        <div className="auth-brand-text">
          <h1>FIR Sahayak</h1>
          <span>Online FIR Filing Portal — Government of India</span>
        </div>
      </Link>

      <div className="auth-card">
        {/* Role selector */}
        <div className="role-selector">
          {(Object.keys(ROLE_CONFIG) as LoginRole[]).map(role => (
            <button
              key={role}
              type="button"
              className={`role-tab${selectedRole === role ? ' active' : ''}`}
              onClick={() => handleRoleChange(role)}
            >
              {ROLE_CONFIG[role].label}
            </button>
          ))}
        </div>

        <h2>Welcome back</h2>
        <p className="auth-subtitle">{config.subtitle}</p>

        {config.testCreds && (
          <div className="test-creds-banner">
            <span>🧪 Testing?</span>
            <button
              type="button"
              className="test-creds-btn"
              onClick={() => { setForm(config.testCreds!); setError(''); }}
            >
              Fill test credentials
            </button>
          </div>
        )}

        {error && <div className="auth-error">⚠ {error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              minLength={8}
            />
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        {config.showRegister && (
          <div className="auth-footer">
            Don't have an account?&nbsp;<Link to="/register">Register here</Link>
          </div>
        )}
      </div>

      <Link to="/" className="auth-back">← Back to home</Link>
    </div>
  );
}
