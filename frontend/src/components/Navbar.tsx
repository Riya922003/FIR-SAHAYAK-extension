import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/landing.css';

const NAV_LINKS = [
  { label: 'Home',    href: '#page1' },
  { label: 'About',   href: '#page2' },
  { label: 'Help',    href: '#page5' },
  { label: 'Contact', href: '#footer' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <nav className="fir-nav">
      <h1>FIR Sahayak</h1>

      {/* Desktop nav links */}
      <div className="nav-part2">
        {NAV_LINKS.map(({ label, href }) => (
          <a key={label} href={href}>{label}</a>
        ))}
      </div>

      {/* Desktop CTA */}
      <button className="nav-login-btn" onClick={() => navigate('/login')}>
        Login / Sign-Up
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Mobile hamburger */}
      <button
        className="nav-hamburger"
        onClick={() => setMenuOpen(o => !o)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        <span /><span /><span />
      </button>

      <div className="logo-container">
        <img src="/emblem.svg" alt="Satyamev Jayte" />
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href} onClick={close}>{label}</a>
          ))}
          <button className="nav-mobile-cta" onClick={() => { navigate('/login'); close(); }}>
            Login / Sign-Up
          </button>
        </div>
      )}
    </nav>
  );
}
