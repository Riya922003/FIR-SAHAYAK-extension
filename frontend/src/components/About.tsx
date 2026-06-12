import '../styles/landing.css';

/* Matching original #page2 structure:
   left column (label + big heading + description) |
   right column (right-elem items, each with heading and short desc) */

const RIGHT_ELEMS = [
  {
    title: 'What is FIR Sahayak?',
    desc: 'An AI-powered online portal that lets citizens file First Information Reports from any device — without visiting a police station. Available 24/7 in Hindi and English.',
  },
  {
    title: 'How does the process work?',
    desc: 'Describe your incident to the AI assistant. It suggests IPC sections, fills the FIR form, and submits it to the concerned police station. You get a tracking number instantly.',
  },
  {
    title: 'Who can use this platform?',
    desc: 'Any Indian citizen with a valid Aadhaar-linked account. Officers and station admins have separate dashboards to review, update, and escalate FIRs.',
  },
  {
    title: 'Is my data secure?',
    desc: 'Yes. All data is encrypted, stored on a secure cloud database, and protected with JWT authentication and role-based access control. No unauthorised access is possible.',
  },
];

export default function About() {
  return (
    <section id="page2">

      {/* Left column */}
      <div id="page2-left">
        <p className="section-label">ABOUT THE PLATFORM</p>

        <h2>A Smarter Way<br />to File FIRs</h2>

        <h5>
          FIR Sahayak combines AI guidance with a secure government-grade
          backend so that every citizen can report a crime with confidence —
          quickly, accurately, and from anywhere in India.
        </h5>
      </div>

      {/* Right column — stacked items */}
      <div id="page2-right">
        {RIGHT_ELEMS.map(({ title, desc }) => (
          <div className="right-elem" key={title}>
            <h2>{title}</h2>
            <p className="elem-desc">{desc}</p>
          </div>
        ))}
      </div>

    </section>
  );
}
