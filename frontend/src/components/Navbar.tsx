import '../styles/landing.css';

const NAV_LINKS = [
  { label: 'Home',    href: '#page1' },
  { label: 'About',   href: '#page2' },
  { label: 'Help',    href: '#page5' },
  { label: 'Contact', href: '#footer' },
];

export default function Navbar() {
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

      {/* Login / Sign-Up button */}
      <button className="nav-login-btn">
        Login / Sign-Up
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/*
        Satyamev Jayte — Ashoka Emblem of India
        Positioned absolutely at top-right of the fixed navbar
        exactly as in the original .logo-container
      */}
      {/* Satyamev Jayte emblem served from /public/emblem.svg */}
      <div className="logo-container">
        <img
          src="/emblem.svg"
          alt="Satyamev Jayte"
        />
      </div>
    </nav>
  );
}
