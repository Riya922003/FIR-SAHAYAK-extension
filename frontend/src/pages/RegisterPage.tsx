import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser, loginUser } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

interface FormState {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  aadhar_number: string;
  password: string;
  confirm_password: string;
}

const INITIAL: FormState = {
  full_name: '',
  username: '',
  email: '',
  phone: '',
  aadhar_number: '',
  password: '',
  confirm_password: '',
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = (): string => {
    if (form.password !== form.confirm_password) return 'Passwords do not match';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (!/^\d{10}$/.test(form.phone)) return 'Phone number must be exactly 10 digits';
    if (!/^\d{12}$/.test(form.aadhar_number)) return 'Aadhar number must be exactly 12 digits';
    if (form.username.length < 3) return 'Username must be at least 3 characters';
    return '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      await registerUser({
        email: form.email,
        username: form.username,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone,
        aadhar_number: form.aadhar_number,
      });
      // Auto-login after successful registration
      const tokenData = await loginUser({ email: form.email, password: form.password });
      login(tokenData.access_token, tokenData.refresh_token, tokenData.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
        <h2>Create your account</h2>
        <p className="auth-subtitle">Register to file and track FIRs online</p>

        {error && <div className="auth-error">⚠ {error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>

          <div className="form-row">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Riya Gupta"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="riya_gupta"
                required
                minLength={3}
                maxLength={30}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="9876543210"
                required
                maxLength={10}
                pattern="\d{10}"
              />
            </div>
            <div className="form-group">
              <label>Aadhar Number</label>
              <input
                type="text"
                name="aadhar_number"
                value={form.aadhar_number}
                onChange={handleChange}
                placeholder="123456789012"
                required
                maxLength={12}
                pattern="\d{12}"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Min 8 characters"
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                placeholder="Repeat password"
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account →'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?&nbsp;<Link to="/login">Sign in</Link>
        </div>
      </div>

      <Link to="/" className="auth-back">← Back to home</Link>
    </div>
  );
}
