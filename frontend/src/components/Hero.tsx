import { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/landing.css';

/* ──────────────────────────────────────────────────────────
   Hero slider images — sourced from uppolice.gov.in
   ────────────────────────────────────────────────────────── */
const SLIDES = [
  { src: '/hero1.jpg', alt: 'UP Police Headquarters — Lucknow' },
  { src: '/hero3.jpg', alt: 'UP Police — Tactical Field Operations' },
  { src: '/hero4.jpg', alt: 'UP Police — Urban Security Operations' },
];

/* ──────────────────────────────────────────────────────────
   Real state police badge logos (downloaded from official sites)
   Duplicated so the mobe animation loops at -50% without a blank gap
   ────────────────────────────────────────────────────────── */
const BASE_LOGOS = [
  { src: '/police/maharashtra.png', alt: 'Maharashtra Police' },
  { src: '/police/westbengal.png',  alt: 'West Bengal Police' },
  { src: '/police/telangana.webp',  alt: 'Telangana Police' },
  { src: '/police/mp.png',          alt: 'Madhya Pradesh Police' },
  { src: '/police/delhi.png',       alt: 'Delhi Police' },
  { src: '/police/up2.png',         alt: 'Uttar Pradesh Police' },
  { src: '/police/haryana.png',     alt: 'Haryana Police' },
];
const TICKER_LOGOS = [...BASE_LOGOS, ...BASE_LOGOS];

export default function Hero() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % SLIDES.length);
    }, 4500);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const goNext = () => { setCurrent(prev => (prev + 1) % SLIDES.length); resetTimer(); };
  const goPrev = () => { setCurrent(prev => (prev - 1 + SLIDES.length) % SLIDES.length); resetTimer(); };
  const goTo   = (idx: number) => { setCurrent(idx); resetTimer(); };

  return (
    <section id="page1">

      {/* ── Full-width image slider ── */}
      <div className="slide-container">
        <div className="slides">
          {SLIDES.map((slide, i) => (
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              className={i === current ? 'active' : ''}
            />
          ))}
        </div>

        <span className="slider-prev" onClick={goPrev}>&#10094;</span>
        <span className="slider-next" onClick={goNext}>&#10095;</span>

        <div className="dotsContainer">
          {SLIDES.map((_, i) => (
            <span key={i} className={`dot${i === current ? ' active' : ''}`} onClick={() => goTo(i)} />
          ))}
        </div>
      </div>

      {/* ── Police logo ticker — real badge images ── */}
      <div id="moving-div">
        <div className="move">
          {TICKER_LOGOS.map((logo, i) => (
            <img
              key={i}
              src={logo.src}
              alt={logo.alt}
              className="ticker-logo"
              title={logo.alt}
            />
          ))}
        </div>
      </div>

      <div id="blur-left" />
      <div id="blur-right" />
    </section>
  );
}
