import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import About from '../components/About';
import FAQ from '../components/FAQ';
import Footer from '../components/Footer';

/*
  Page structure (faithful to original):
  1. nav    — fixed Indian-flag gradient + Satyamev Jayte emblem
  2. #page1 — full-width image slider + police logos ticker (inside Hero)
  3. #page2 — How It Works / About section
  4. #page5 — FIR Assistant / FAQ with green hover overlay
  5. footer  — three columns + dark bottom bar
*/
export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
