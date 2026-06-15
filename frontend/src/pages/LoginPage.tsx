import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const fillTestCreds = () => {
    setForm({ email: 'riya@test.com', password: 'Test@1234' });
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(form);
      login(data.access_token, data.refresh_token, data.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Brand */}
      <Link to="/" className="auth-brand">
        <div className="auth-brand-bar" />
        <div className="auth-brand-text">
          <h1>FIR Sahayak</h1>
          <span>Online FIR Filing Portal — Government of India</span>
        </div>
      </Link>

      <div className="auth-card">
        <h2>Welcome back</h2>
        <p className="auth-subtitle">Sign in to your account to file or track FIRs</p>

        {/* Test credentials banner */}
        <div className="test-creds-banner">
          <span>🧪 Testing?</span>
          <button type="button" className="test-creds-btn" onClick={fillTestCreds}>
            Fill test credentials
          </button>
        </div>

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

        <div className="auth-footer">
          Don't have an account?&nbsp;<Link to="/register">Register here</Link>
        </div>
      </div>

      <Link to="/" className="auth-back">← Back to home</Link>
    </div>
  );
}
