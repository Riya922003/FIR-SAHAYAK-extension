import '../styles/landing.css';

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

      <div id="demo-video-wrap">
        <iframe
          src="https://www.veed.io/embed/f2858ec8-8d09-49b4-a09b-343756bb3be9"
          title="FIR Sahayak Demo"
          frameBorder="0"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    </section>
  );
}
