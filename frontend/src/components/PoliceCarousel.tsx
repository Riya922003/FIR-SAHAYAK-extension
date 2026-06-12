import '../styles/landing.css';

// Indian state/city police forces
const POLICE_FORCES = [
  { name: 'Maharashtra Police',    abbr: 'MH' },
  { name: 'Delhi Police',          abbr: 'DL' },
  { name: 'Tamil Nadu Police',     abbr: 'TN' },
  { name: 'Karnataka Police',      abbr: 'KA' },
  { name: 'UP Police',             abbr: 'UP' },
  { name: 'Gujarat Police',        abbr: 'GJ' },
  { name: 'Rajasthan Police',      abbr: 'RJ' },
  { name: 'West Bengal Police',    abbr: 'WB' },
  { name: 'Telangana Police',      abbr: 'TS' },
  { name: 'Punjab Police',         abbr: 'PB' },
  { name: 'Bihar Police',          abbr: 'BR' },
  { name: 'MP Police',             abbr: 'MP' },
];

// Duplicate items so the CSS scroll animation loops seamlessly — no blank gap
const DISPLAY_ITEMS = [...POLICE_FORCES, ...POLICE_FORCES];

// Rotating background colors for variety
const COLORS = [
  '#e8f5e9', '#fff3e0', '#e3f2fd', '#fce4ec',
  '#f3e5f5', '#e0f2f1', '#fff8e1', '#ede7f6',
];

export default function PoliceCarousel() {
  return (
    <section className="carousel-section">
      <p className="carousel-label">Trusted by Police Departments Across India</p>

      <div className="carousel-track-wrapper">
        <div className="carousel-track">
          {DISPLAY_ITEMS.map((force, i) => (
            <div className="carousel-item" key={`${force.abbr}-${i}`}>
              <div
                className="carousel-logo"
                style={{ background: COLORS[i % COLORS.length] }}
              >
                <span style={{ fontWeight: 800, fontSize: 13, color: '#1b5e20' }}>
                  {force.abbr}
                </span>
              </div>
              <span>{force.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
