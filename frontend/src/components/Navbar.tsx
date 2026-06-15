import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/landing.css';

const NAV_LINKS = [
  { label: 'Home',    href: '#page1' },
  { label: 'About',   href: '#page2' },
  { label: 'Help',    href: '#page5' },
  { label: 'Contact', href: '#footer' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const handleAuthClick = () => {
    if (isAuthenticated) {
      logout();
      navigate('/');
    } else {
      navigate('/login');
    }
  };

  // If already logged in, clicking brand name goes to dashboard
  const handleBrandClick = () => {
    if (isAuthenticated) navigate('/dashboard');
  };

  return (
    <nav className="fir-nav">
      {/* Brand name */}
      <h1>FIR Sahayak</h1>

      {/* Navigation links */}
      <div className="nav-part2">
        {NAV_LINKS.map(({ label, href }) => (
          <a key={label} href={href}>{label}</a>
        ))}
      </div>

      {/* Auth button — shows name + logout when logged in */}
      <button className="nav-login-btn" onClick={handleAuthClick}>
        {isAuthenticated
          ? `Hi, ${user?.full_name.split(' ')[0]} · Logout`
          : 'Login / Sign-Up'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Satyamev Jayte emblem */}
      <div className="logo-container">
        <img src="/emblem.svg" alt="Satyamev Jayte" />
      </div>
    </nav>
  );
}
