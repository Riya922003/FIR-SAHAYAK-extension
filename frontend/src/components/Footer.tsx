import '../styles/landing.css';

/* Matching original footer structure:
   Three .footer-content columns (Quick Links, About, Follow Us)
   Inside .footer-inner (.container equivalent)
   Dark .bottom-bar below */

export default function Footer() {
  return (
    <footer className="fir-footer" id="footer">

      <div className="footer-inner">

        {/* Column 1 — Quick Links */}
        <div className="footer-content">
          <h3>Quick Links</h3>
          <ul className="list">
            <li><a href="#page1">Home</a></li>
            <li><a href="#page2">About</a></li>
            <li><a href="#page5">Register FIR</a></li>
            <li><a href="#page5">View FIR Status</a></li>
            <li><a href="#page5">Help</a></li>
            <li><a href="#footer">Contact</a></li>
          </ul>
        </div>

        {/* Column 2 — About */}
        <div className="footer-content">
          <h3>About</h3>
          <p className="footer-about">
            FIR Sahayak is an AI-powered online FIR filing platform that
            empowers Indian citizens to report crimes securely, track
            status, and get justice — without visiting a police station.
            Available 24/7 in Hindi and English.
          </p>
        </div>

        {/* Column 3 — Follow Us */}
        <div className="footer-content">
          <h3>Follow Us</h3>
          <ul className="social-icons">
            <li>
              <a href="#" aria-label="Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </li>
            <li>
              <a href="#" aria-label="YouTube">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </li>
            <li>
              <a href="#" aria-label="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </li>
            <li>
              <a href="#" aria-label="Facebook">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            </li>
          </ul>
        </div>

      </div>

      {/* Dark bottom bar */}
      <div className="bottom-bar">
        <p>
          &copy; 2025 FIR Sahayak &mdash; Content Owned by Ministry of Home Affairs, Government of India.
          All Rights Reserved.
        </p>
      </div>

    </footer>
  );
}
