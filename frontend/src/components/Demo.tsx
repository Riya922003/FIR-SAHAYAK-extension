import '../styles/landing.css';

const DEMO_URL = 'https://www.veed.io/view/f2858ec8-8d09-49b4-a09b-343756bb3be9';

export default function Demo() {
  return (
    <section id="demo">
      <div id="demo-header">
        <p className="section-label">SEE IT IN ACTION</p>
        <h2>Watch the Demo</h2>
        <p id="demo-sub">
          See how a citizen files an FIR in minutes — from AI interview to tracking number.
        </p>
      </div>

      <a
        id="demo-video-wrap"
        href={DEMO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Watch the FIR Sahayak demo video"
      >
        {/* Dark gradient background with play button */}
        <div id="demo-play-bg">
          <div id="demo-play-btn">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
          <div id="demo-play-label">
            <span id="demo-play-title">FIR Sahayak — Full Demo</span>
            <span id="demo-play-hint">Click to watch on VEED ↗</span>
          </div>
        </div>
      </a>
    </section>
  );
}
