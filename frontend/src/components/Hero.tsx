import { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/landing.css';

/* ──────────────────────────────────────────────────────────
   Slider images sourced from real Indian police portals
   (uppolice.gov.in + digitalpolice.gov.in)
   ────────────────────────────────────────────────────────── */
const SLIDES = [
  { src: '/hero1.jpg', alt: 'UP Police Headquarters — Lucknow' },
  { src: '/hero2.jpg', alt: 'Digital India — A SMART Policing Initiative by Ministry of Home Affairs' },
  { src: '/hero3.jpg', alt: 'UP Police — Tactical Operations' },
  { src: '/hero4.jpg', alt: 'UP Police — Urban Security Operations' },
];

/* ──────────────────────────────────────────────────────────
   Police logos ticker
   Items are DUPLICATED so the -50% keyframe loops seamlessly
   (original bug: single set animated to -100% → blank flash on wrap)
   ────────────────────────────────────────────────────────── */
const BASE_LOGOS = [
  { abbr: 'DP',   name: 'Delhi Police' },
  { abbr: 'MP',   name: 'Maharashtra Police' },
  { abbr: 'RP',   name: 'Rajasthan Police' },
  { abbr: 'TN',   name: 'Tamil Nadu Police' },
  { abbr: 'KP',   name: 'Karnataka Police' },
  { abbr: 'PP',   name: 'Punjab Police' },
  { abbr: 'GP',   name: 'Gujarat Police' },
  { abbr: 'UP',   name: 'Uttar Pradesh Police' },
  { abbr: 'AP',   name: 'Andhra Pradesh Police' },
  { abbr: 'HP',   name: 'Haryana Police' },
];
// Duplicate for infinite seamless scroll
const TICKER_LOGOS = [...BASE_LOGOS, ...BASE_LOGOS];

export default function Hero() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % SLIDES.length);
    }, 4000);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const goNext = () => {
    setCurrent(prev => (prev + 1) % SLIDES.length);
    resetTimer();
  };

  const goPrev = () => {
    setCurrent(prev => (prev - 1 + SLIDES.length) % SLIDES.length);
    resetTimer();
  };

  const goTo = (idx: number) => {
    setCurrent(idx);
    resetTimer();
  };

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
              data-loaded="true"
            />
          ))}
        </div>

        {/* Arrows */}
        <span className="slider-prev" onClick={goPrev}>&#10094;</span>
        <span className="slider-next" onClick={goNext}>&#10095;</span>

        {/* Dots */}
        <div className="dotsContainer">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`dot${i === current ? ' active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>

      {/* ── Police logos ticker ── */}
      <div id="moving-div">
        <div className="move">
          {TICKER_LOGOS.map((logo, i) => (
            <span key={i} className="ticker-logo" title={logo.name}>
              {logo.abbr}
            </span>
          ))}
        </div>
      </div>

      {/* Fade overlays (left / right of page) */}
      <div id="blur-left" />
      <div id="blur-right" />
    </section>
  );
}
