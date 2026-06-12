import '../styles/landing.css';

/* Matching original #page5 structure:
   Left  → sticky "REGISTER FIR" button (original .button)
   Right → heading paragraph + #page5-content with .page5-elem rows
            Each row has: title | description text | arrow →
            Green .over overlay slides up on hover */

const FAQ_ITEMS = [
  {
    title: 'Safety',
    desc: 'Is it safe to file an FIR online? FIR Sahayak uses JWT authentication, bcrypt password hashing, and HTTPS encryption. Your Aadhaar and personal data are stored securely and never shared with unauthorised parties.',
  },
  {
    title: 'Legal Compliance & Privacy',
    desc: 'The platform follows the Indian Penal Code (IPC), CrPC guidelines, the IT Act 2000, and PDPB data privacy standards. Our AI suggests relevant IPC sections based on your complaint, but does not provide legal counsel.',
  },
  {
    title: 'How Can You Trust FIR Sahayak?',
    desc: 'Every FIR goes through a verified lifecycle: Submitted → Acknowledged → Under Investigation → Resolved. You get status updates at every stage. If not acknowledged within 48 hours, the system flags it for automatic escalation.',
  },
  {
    title: 'Terms and Conditions',
    desc: 'By using FIR Sahayak you agree to provide truthful information. Filing a false FIR is punishable under IPC Section 182. FIR data may be shared with law enforcement. All data is governed by our Privacy Policy under Indian law.',
  },
];

export default function FAQ() {
  return (
    <section id="page5">

      {/* Left — sticky Register FIR button */}
      <div>
        <button className="register-btn">REGISTER FIR</button>
      </div>

      {/* Right — FIR Assistant description + FAQ rows */}
      <div id="page5-right">
        <p className="fir-heading">
          FIR Sahayak is your AI-powered companion for filing First Information
          Reports online — available 24/7 in Hindi and English, guided
          step-by-step so no citizen is left behind.
        </p>

        <div id="page5-content">
          <h1>Have Questions?</h1>

          {FAQ_ITEMS.map(({ title, desc }) => (
            <div className="page5-elem" key={title}>
              {/* Green slide-up overlay — appears on hover */}
              <div className="over" />

              <h3 className="elem-title">{title}</h3>
              <p className="elem-body">{desc}</p>
              <span className="elem-arrow">&#10230;</span>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
