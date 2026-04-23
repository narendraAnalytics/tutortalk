'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, UserButton, useAuth, useUser } from '@clerk/nextjs';
import { PLAN_BADGE, getPlanFromHas, type PlanKey } from '@/lib/plans';
import VoiceOrb from '@/components/VoiceOrb';

const SUBJECTS = [
  { name: 'Math',      bg: '#FAECE7', color: '#D85A30' },
  { name: 'Physics',   bg: '#E0F5EE', color: '#1D9E75' },
  { name: 'Chemistry', bg: '#EEEDFE', color: '#7F77DD' },
  { name: 'Biology',   bg: '#FEF3E2', color: '#C47A14' },
  { name: 'English',   bg: '#FCE9EF', color: '#D4537E' },
  { name: 'History',   bg: '#F0EDF9', color: '#6B5DB0' },
];

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 36 36" width="30" height="30" fill="none">
        <circle cx="18" cy="18" r="18" fill="#FAECE7" />
        <rect x="14" y="10" width="8" height="12" rx="4" fill="#D85A30" />
        <path d="M10 19c0 4.418 3.582 8 8 8s8-3.582 8-8" stroke="#D85A30" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="18" y1="27" x2="18" y2="30" stroke="#D85A30" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Speak naturally',
    desc: 'Just talk like you would with a great teacher — no typing, no menus. Pure voice.',
    bg: '#FAECE7',
  },
  {
    icon: (
      <svg viewBox="0 0 36 36" width="30" height="30" fill="none">
        <circle cx="18" cy="18" r="18" fill="#EEEDFE" />
        <circle cx="18" cy="14" r="5" fill="#7F77DD" />
        <path d="M18 19v4" stroke="#7F77DD" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="18" cy="25" r="1.5" fill="#7F77DD" />
      </svg>
    ),
    title: 'Socratic method',
    desc: 'TutorTalk guides you to answers with questions — building real understanding, not shortcuts.',
    bg: '#EEEDFE',
  },
  {
    icon: (
      <svg viewBox="0 0 36 36" width="30" height="30" fill="none">
        <circle cx="18" cy="18" r="18" fill="#E0F5EE" />
        <rect x="11" y="9" width="14" height="18" rx="3" fill="#1D9E75" opacity="0.3" />
        <rect x="11" y="9" width="14" height="18" rx="3" stroke="#1D9E75" strokeWidth="1.8" />
        <line x1="14" y1="14" x2="22" y2="14" stroke="#1D9E75" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="14" y1="18" x2="22" y2="18" stroke="#1D9E75" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="14" y1="22" x2="18" y2="22" stroke="#1D9E75" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    title: 'PDF session reports',
    desc: 'Every session produces a full transcript and progress report — perfect for revision.',
    bg: '#E0F5EE',
  },
];

const TESTIMONIALS = [
  { text: 'I finally understood derivatives after 10 minutes with TutorTalk. My teacher was shocked at my next test!', name: 'Aanya R.', subject: 'Math', init: 'A', delay: '0s' },
  { text: "It doesn't just hand you the answer. It makes you actually think. Complete game-changer for exam prep.", name: 'Marcus K.', subject: 'Physics', init: 'M', delay: '1.4s' },
  { text: 'The PDF reports are perfect for last-minute revision before exams. I use them every single time.', name: 'Sofia L.', subject: 'Chemistry', init: 'S', delay: '2.8s' },
];

const VIDEOS = [
  'https://res.cloudinary.com/dkqbzwicr/video/upload/q_auto/f_auto/v1776919480/video1_qsblo9.webm',
  'https://res.cloudinary.com/dkqbzwicr/video/upload/q_auto/f_auto/v1776919472/video2_bqu7ob.webm',
  'https://res.cloudinary.com/dkqbzwicr/video/upload/q_auto/f_auto/v1776919466/video3_el5iw0.webm',
];

const ORB_CYCLE: Array<'idle' | 'listening' | 'speaking' | 'interrupted'> = [
  'idle', 'listening', 'speaking', 'speaking', 'idle', 'listening',
];

const STATE_LABEL: Record<string, string> = {
  idle: 'Tap to start a session',
  listening: 'Listening to you…',
  speaking: 'AI is explaining…',
  interrupted: 'Just a moment…',
};

const STATE_DOT: Record<string, string> = {
  idle: '#993C1D',
  listening: '#1D9E75',
  speaking: '#D85A30',
  interrupted: '#EF9F27',
};

export default function LandingPage() {
  const { isSignedIn, has } = useAuth();
  const { user } = useUser();
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'speaking' | 'interrupted'>('idle');

  const plan: PlanKey = isSignedIn && has ? getPlanFromHas(has as (p: { plan: string }) => boolean) : 'free';
  const badge = PLAN_BADGE[plan];

  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % ORB_CYCLE.length;
      setOrbState(ORB_CYCLE[i]);
    }, 2800);
    return () => clearInterval(t);
  }, []);

  // Sync signed-in Clerk user to Neon — fires once user data is available after sign-in
  useEffect(() => {
    if (isSignedIn && user) {
      fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.emailAddresses[0]?.emailAddress ?? '',
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        }),
      });
    }
  }, [isSignedIn, user]);

  // ── Video carousel ──
  const [activeVideo, setActiveVideo] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [videoPaused, setVideoPaused] = useState(false);
  const videoRef0 = useRef<HTMLVideoElement>(null);
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const isInViewRef = useRef(true);
  const activeVideoRef = useRef(0);

  const pauseVideos = () => {
    videoRef0.current?.pause(); videoRef1.current?.pause(); videoRef2.current?.pause();
    setVideoPaused(true);
  };

  // Sync muted (React muted attr is not reactive for <video>)
  useEffect(() => {
    [videoRef0, videoRef1, videoRef2].forEach(r => { if (r.current) r.current.muted = isMuted; });
  }, [isMuted]);

  // Play/pause the right video when activeVideo or videoPaused changes
  useEffect(() => {
    [videoRef0, videoRef1, videoRef2].forEach((r, i) => {
      if (i === activeVideo && !videoPaused) {
        r.current?.play().catch(() => {});
      } else {
        r.current?.pause();
        if (i !== activeVideo && r.current) r.current.currentTime = 0;
      }
    });
    activeVideoRef.current = activeVideo;
  }, [activeVideo, videoPaused]);

  // Auto-advance every 5 s when not paused
  useEffect(() => {
    if (videoPaused) return;
    const t = setInterval(() => setActiveVideo(v => (v + 1) % 3), 5000);
    return () => clearInterval(t);
  }, [videoPaused]);

  // Pause on scroll-out and tab switch
  useEffect(() => {
    const pause = () => setVideoPaused(true);
    const tryResume = () => { if (isInViewRef.current && !document.hidden) setVideoPaused(false); };
    const obs = new IntersectionObserver(([e]) => {
      isInViewRef.current = e.isIntersecting;
      if (!e.isIntersecting) pause(); else tryResume();
    }, { threshold: 0.15 });
    if (heroRef.current) obs.observe(heroRef.current);
    const onVis = () => { if (document.hidden) pause(); else tryResume(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { obs.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-in" style={{ minHeight: '100vh', background: '#FFFBF7', overflowX: 'hidden' }}>

      {/* ── Nav + Hero wrapper — shared video background ── */}
      <div ref={heroRef} style={{ position: 'relative', border: 'none' }}>

        {/* Video background — covers nav + hero as one block */}
        {VIDEOS.map((src, i) => (
          <video
            key={i}
            ref={i === 0 ? videoRef0 : i === 1 ? videoRef1 : videoRef2}
            src={src}
            loop
            playsInline
            muted
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              opacity: activeVideo === i ? 1 : 0,
              transition: 'opacity 0.75s cubic-bezier(0.4, 0, 0.2, 1)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        ))}

        {/* Warm cream overlay — keeps text readable */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,251,247,0.55)', zIndex: 1, pointerEvents: 'none' }} />

      {/* ── Nav ── */}
      <nav className="tt-nav tt-nav-sticky" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', boxShadow: 'none', position: 'relative', zIndex: 50, background: 'transparent' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1776668144/logotutortalk_ecmdbm.png" alt="TutorTalk" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#4A1B0C', letterSpacing: '-0.4px', fontFamily: 'var(--font-poppins)' }}>TutorTalk</span>
        </Link>

        {/* Center nav links */}
        <div className="tt-nav-links" style={{ display: 'flex', gap: 34, alignItems: 'center' }}>
          {isSignedIn ? (
            <a href="#features" className="tt-nav-link" onClick={pauseVideos}>Features</a>
          ) : (
            <SignInButton><button className="tt-nav-link" onClick={pauseVideos}>Features</button></SignInButton>
          )}
          <a href="#howitworks" className="tt-nav-link" onClick={pauseVideos}>How It Works</a>
          {isSignedIn ? (
            <a href="#pricing" className="tt-nav-link" onClick={pauseVideos}>Pricing</a>
          ) : (
            <SignInButton><button className="tt-nav-link" onClick={pauseVideos}>Pricing</button></SignInButton>
          )}
        </div>

        {/* Right: auth */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {isSignedIn ? (
            <>
              {/* Plan badge */}
              <span style={{
                padding: '5px 14px', borderRadius: 99,
                background: badge.bg, color: badge.color,
                fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-poppins)',
                letterSpacing: '0.3px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
              }}>
                {badge.label}
              </span>
              <Link href="/dashboard" style={{ color: '#993C1D', padding: '10px 24px', borderRadius: 99, textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)', border: '1.5px solid rgba(216,90,48,0.2)' }}>
                Dashboard
              </Link>
              <UserButton />
            </>
          ) : (
            <SignInButton>
              <button className="cta-btn" onClick={pauseVideos} style={{ color: '#FFFBF7', padding: '10px 24px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>
                Sign in
              </button>
            </SignInButton>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="tt-section" style={{ position: 'relative', paddingTop: 40, paddingBottom: 52, textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>

        <div className="tt-blob-hide" style={{ position: 'absolute', top: -80, right: -100, width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(216,90,48,0.09) 0%, transparent 65%)', animation: 'blob-drift 11s ease-in-out infinite', pointerEvents: 'none', zIndex: 2 }} />
        <div className="tt-blob-hide" style={{ position: 'absolute', bottom: -80, left: -120, width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(127,119,221,0.07) 0%, transparent 65%)', animation: 'blob-drift 15s ease-in-out reverse infinite', pointerEvents: 'none', zIndex: 2 }} />
        <div style={{ position: 'absolute', top: '35%', left: '3%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(29,158,117,0.06) 0%, transparent 65%)', animation: 'blob-drift 13s ease-in-out 2s infinite', pointerEvents: 'none', zIndex: 2 }} />

        <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
          {isSignedIn && user ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FAECE7', borderRadius: 99, padding: '10px 24px', marginBottom: 36, lineHeight: 1 }}>
              <span style={{ fontSize: 13 }}>👋</span>
              <span style={{ color: '#D85A30', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>Welcome back, {user.firstName ?? user.username ?? 'there'}!</span>
            </div>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FAECE7', borderRadius: 99, padding: '10px 24px', marginBottom: 36 }}>
              <div className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#D4537E', flexShrink: 0 }} />
              <span style={{ color: '#D85A30', fontWeight: 600, fontSize: 13, letterSpacing: '0.2px' }}>Socratic AI tutoring · Live voice</span>
            </div>
          )}

          <h1 style={{ fontSize: 'clamp(48px, 7vw, 82px)', fontWeight: 800, lineHeight: 1.08, maxWidth: 820, marginBottom: 28, letterSpacing: '-2px', fontFamily: 'var(--font-poppins)' }}>
            <span className="gradient-text">Ask anything.</span><br />
            <span style={{ color: '#4A1B0C' }}>Learn by talking.</span>
          </h1>

          <p style={{ fontSize: 19, color: '#993C1D', maxWidth: 520, lineHeight: 1.72, marginBottom: 28, opacity: 0.9 }}>
            TutorTalk uses Socratic voice AI to guide you to answers — not just give them.
          </p>

          <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            {isSignedIn ? (
              <Link href="/dashboard" className="cta-btn" style={{ color: '#FFFBF7', padding: 'clamp(14px,2vw,18px) clamp(24px,4vw,50px)', borderRadius: 99, textDecoration: 'none', fontWeight: 700, fontSize: 'clamp(15px,2vw,18px)', fontFamily: 'var(--font-poppins)', letterSpacing: '-0.3px', display: 'inline-block' }}>
                Start learning free
              </Link>
            ) : (
              <SignInButton>
                <button className="cta-btn" style={{ color: '#FFFBF7', padding: 'clamp(14px,2vw,18px) clamp(24px,4vw,50px)', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 'clamp(15px,2vw,18px)', fontFamily: 'var(--font-poppins)', letterSpacing: '-0.3px' }}>
                  Start learning free
                </button>
              </SignInButton>
            )}
          </div>

          {/* Video controls — clip selector + mute toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 0, background: 'rgba(255,251,247,0.90)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 99, padding: '8px 18px', boxShadow: '0 2px 16px rgba(216,90,48,0.10)', border: '1px solid rgba(216,90,48,0.12)', alignSelf: 'flex-end' }}>
            {VIDEOS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setActiveVideo(i); activeVideoRef.current = i; }}
                aria-label={`Play video ${i + 1}`}
                style={{
                  width: activeVideo === i ? 24 : 8,
                  height: 8,
                  borderRadius: 99,
                  background: activeVideo === i ? '#D85A30' : 'rgba(153,60,29,0.25)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'width 0.35s ease, background 0.35s ease',
                }}
              />
            ))}
            <div style={{ width: 1, height: 16, background: 'rgba(216,90,48,0.25)', flexShrink: 0 }} />
            <button
              onClick={() => setIsMuted(m => !m)}
              aria-label={isMuted ? 'Unmute video' : 'Mute video'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 6, color: '#993C1D', fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-poppins)' }}
            >
              <span style={{ fontSize: 16 }}>{isMuted ? '🔇' : '🔊'}</span>
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        </div>
      </section>
      </div>{/* end nav+hero video wrapper */}

      {/* ── VoiceOrb ── */}
      <section className="tt-section" style={{ paddingTop: 56, paddingBottom: 56, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <VoiceOrb state={orbState} size="lg" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF8F3', borderRadius: 99, padding: '9px 22px', boxShadow: '0 2px 16px rgba(216,90,48,0.08)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: STATE_DOT[orbState], opacity: 0.8 }} />
            <span style={{ color: '#4A1B0C', fontSize: 13, fontWeight: 500 }}>{STATE_LABEL[orbState]}</span>
          </div>
        </div>
      </section>

      {/* ── Subject chips ── */}
      <section className="tt-section" style={{ paddingTop: 20, paddingBottom: 72, textAlign: 'center' }}>
        <p style={{ color: '#993C1D', fontWeight: 600, marginBottom: 28, fontSize: 12, letterSpacing: '2.5px', textTransform: 'uppercase', opacity: 0.55 }}>covers every subject</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          {SUBJECTS.map((s, i) => (
            <div key={s.name} style={{ animation: `chip-float ${3.2 + i * 0.55}s ease-in-out ${i * 0.28}s infinite` }}>
              {isSignedIn ? (
                <Link href="/session" style={{ background: s.bg, color: s.color, padding: '13px 30px', borderRadius: 99, border: '2px solid transparent', textDecoration: 'none', fontWeight: 600, fontSize: 15, fontFamily: 'var(--font-poppins)', display: 'inline-block' }}>
                  {s.name}
                </Link>
              ) : (
                <SignUpButton>
                  <button style={{ background: s.bg, color: s.color, padding: '13px 30px', borderRadius: 99, border: '2px solid transparent', cursor: 'pointer', fontWeight: 600, fontSize: 15, fontFamily: 'var(--font-poppins)' }}>
                    {s.name}
                  </button>
                </SignUpButton>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="tt-section" style={{ paddingTop: 20, paddingBottom: 96 }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, color: '#4A1B0C', marginBottom: 52, letterSpacing: '-1px', fontFamily: 'var(--font-poppins)' }}>Why TutorTalk works</h2>
        <div className="tt-grid-3" style={{ maxWidth: 1020, margin: '0 auto' }}>
          {FEATURES.map((f, i) => (
            <div key={i}
              style={{ background: '#FFF8F3', borderRadius: 20, padding: '36px 30px', boxShadow: '0 2px 24px rgba(216,90,48,0.07)', transition: 'transform 0.22s, box-shadow 0.22s', cursor: 'default' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 48px rgba(216,90,48,0.13)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 24px rgba(216,90,48,0.07)'; }}
            >
              <div style={{ width: 58, height: 58, borderRadius: 16, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: '#4A1B0C', marginBottom: 12, letterSpacing: '-0.3px', fontFamily: 'var(--font-poppins)' }}>{f.title}</h3>
              <p style={{ color: '#993C1D', lineHeight: 1.72, fontSize: 14.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="howitworks" className="tt-section" style={{ paddingTop: 20, paddingBottom: 96, background: 'linear-gradient(180deg, #FFFBF7 0%, #FFF4EE 100%)' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, color: '#4A1B0C', marginBottom: 12, letterSpacing: '-1px', fontFamily: 'var(--font-poppins)' }}>How TutorTalk works</h2>
        <p style={{ textAlign: 'center', color: '#993C1D', fontSize: 15, marginBottom: 52, opacity: 0.75 }}>Three steps to real understanding</p>
        <div className="tt-grid-3" style={{ maxWidth: 1020, margin: '0 auto' }}>
          {[
            {
              step: '01',
              title: 'Pick a subject',
              desc: 'Choose any topic, subject, or exam level — from Class 10 basics to JEE, NEET, or UPSC advanced prep.',
              icon: (
                <svg viewBox="0 0 36 36" width="30" height="30" fill="none">
                  <circle cx="18" cy="18" r="18" fill="#FAECE7" />
                  <rect x="10" y="11" width="16" height="14" rx="3" fill="#D85A30" opacity="0.25" />
                  <rect x="10" y="11" width="16" height="14" rx="3" stroke="#D85A30" strokeWidth="1.8" />
                  <line x1="14" y1="16" x2="22" y2="16" stroke="#D85A30" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="14" y1="20" x2="19" y2="20" stroke="#D85A30" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              step: '02',
              title: 'Speak freely',
              desc: 'Talk like you would with a great teacher. TutorTalk listens, asks guiding questions, and never just hands you the answer.',
              icon: (
                <svg viewBox="0 0 36 36" width="30" height="30" fill="none">
                  <circle cx="18" cy="18" r="18" fill="#EEEDFE" />
                  <rect x="14" y="10" width="8" height="11" rx="4" fill="#7F77DD" />
                  <path d="M11 20c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round" />
                  <line x1="18" y1="27" x2="18" y2="30" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              step: '03',
              title: 'Get your report',
              desc: 'Every session ends with a downloadable PDF — full transcript, key concepts, and progress notes for revision.',
              icon: (
                <svg viewBox="0 0 36 36" width="30" height="30" fill="none">
                  <circle cx="18" cy="18" r="18" fill="#E0F5EE" />
                  <rect x="11" y="9" width="14" height="18" rx="3" fill="#1D9E75" opacity="0.25" />
                  <rect x="11" y="9" width="14" height="18" rx="3" stroke="#1D9E75" strokeWidth="1.8" />
                  <line x1="14" y1="14" x2="22" y2="14" stroke="#1D9E75" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="14" y1="18" x2="22" y2="18" stroke="#1D9E75" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="14" y1="22" x2="18" y2="22" stroke="#1D9E75" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              ),
            },
          ].map((s, i) => (
            <div key={i} style={{ background: '#FFF8F3', borderRadius: 20, padding: '36px 30px', boxShadow: '0 2px 24px rgba(216,90,48,0.07)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 22, right: 22, fontSize: 48, fontWeight: 900, color: '#D85A30', opacity: 0.06, fontFamily: 'var(--font-poppins)', lineHeight: 1 }}>{s.step}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#D85A30,#EF9F27)', color: '#FFFBF7', fontWeight: 800, fontSize: 13, marginBottom: 18, fontFamily: 'var(--font-poppins)' }}>{s.step}</div>
              <div style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>{s.icon}</div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: '#4A1B0C', marginBottom: 12, letterSpacing: '-0.3px', fontFamily: 'var(--font-poppins)' }}>{s.title}</h3>
              <p style={{ color: '#993C1D', lineHeight: 1.72, fontSize: 14.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="tt-section" style={{ paddingTop: 20, paddingBottom: 100, background: 'linear-gradient(180deg, #FFFBF7 0%, #FFF4EE 100%)' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, color: '#4A1B0C', marginBottom: 52, letterSpacing: '-0.8px', fontFamily: 'var(--font-poppins)' }}>Students love it</h2>
        <div className="tt-grid-3" style={{ maxWidth: 1020, margin: '0 auto' }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} style={{ background: '#FFF8F3', borderRadius: 22, padding: '30px', boxShadow: '0 4px 28px rgba(216,90,48,0.08)', animation: `float-y ${4 + i * 1.2}s ease-in-out ${t.delay} infinite` }}>
              <div style={{ fontSize: 28, color: '#D85A30', marginBottom: 14, opacity: 0.4, fontFamily: 'Georgia, serif', lineHeight: 1 }}>"</div>
              <p style={{ color: '#993C1D', lineHeight: 1.72, marginBottom: 22, fontSize: 14.5 }}>{t.text}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#D85A30,#EF9F27)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFBF7', fontWeight: 700, fontSize: 16, flexShrink: 0, fontFamily: 'var(--font-poppins)' }}>{t.init}</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#4A1B0C', fontSize: 14, fontFamily: 'var(--font-poppins)' }}>{t.name}</div>
                  <div style={{ color: '#993C1D', fontSize: 12, opacity: 0.65 }}>{t.subject} student</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="tt-section" style={{ paddingTop: 20, paddingBottom: 100, textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, color: '#4A1B0C', marginBottom: 12, letterSpacing: '-1px', fontFamily: 'var(--font-poppins)' }}>Simple, honest pricing</h2>
        <p style={{ color: '#993C1D', fontSize: 15, marginBottom: 56, opacity: 0.75 }}>Start free. Upgrade when you need more.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, maxWidth: 920, margin: '0 auto', textAlign: 'left' }}>
          {/* Free */}
          {(() => {
            const CheckIcon = () => <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke="#FFFBF7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
            const XIcon    = () => <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 1.5L7.5 7.5M7.5 1.5L1.5 7.5" stroke="#993C1D" strokeWidth="1.7" strokeLinecap="round" /></svg>;

            const plans = [
              {
                key: 'free' as PlanKey,
                name: 'Free',
                price: '$0',
                sub: 'Always free',
                badge: { bg: '#F0EDF9', color: '#6B5DB0' },
                cardBg: '#FFFBF7',
                border: 'rgba(107,93,176,0.18)',
                accent: '#6B5DB0',
                features: [
                  { text: '2 tutor sessions / month', ok: true },
                  { text: '3 subjects: Math, English, History', ok: true },
                  { text: '10-minute session limit', ok: true },
                  { text: '1 session in dashboard', ok: true },
                  { text: 'Exam mode: Math & Chemistry, 5 Qs', ok: true },
                  { text: 'PDF transcript downloads', ok: false },
                  { text: 'All subjects & exam levels', ok: false },
                ],
                cta: isSignedIn
                  ? <Link href="/session" style={{ display: 'block', textAlign: 'center', background: '#F0EDF9', color: '#6B5DB0', padding: '14px 0', borderRadius: 99, textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>Go to session</Link>
                  : <SignUpButton><button style={{ display: 'block', width: '100%', background: '#F0EDF9', color: '#6B5DB0', padding: '14px 0', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>Get started free</button></SignUpButton>,
              },
              {
                key: 'plus' as PlanKey,
                name: 'Plus',
                price: '$8',
                sub: '/month · billed monthly',
                badge: { bg: '#E0F5EE', color: '#1D9E75' },
                cardBg: '#FFFBF7',
                border: 'rgba(29,158,117,0.25)',
                accent: '#1D9E75',
                features: [
                  { text: '30 tutor sessions / month', ok: true },
                  { text: 'All 6 subjects', ok: true },
                  { text: '30-minute session limit', ok: true },
                  { text: 'Full dashboard history', ok: true },
                  { text: 'Exam mode: Class 10 & Intermediate', ok: true },
                  { text: 'PDF transcript downloads', ok: true },
                  { text: 'JEE / NEET / UPSC exam levels', ok: false },
                ],
                cta: isSignedIn
                  ? <Link href="/session" className="cta-btn" style={{ display: 'block', textAlign: 'center', color: '#FFFBF7', padding: '14px 0', borderRadius: 99, textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>Upgrade to Plus</Link>
                  : <SignUpButton><button className="cta-btn" style={{ display: 'block', width: '100%', color: '#FFFBF7', padding: '14px 0', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>Start with Plus</button></SignUpButton>,
                popular: true,
              },
              {
                key: 'pro' as PlanKey,
                name: 'Pro',
                price: '$18',
                sub: '/month · billed monthly',
                badge: { bg: 'linear-gradient(135deg,#D85A30,#EF9F27)', color: '#FFFBF7' },
                cardBg: '#FFFBF7',
                border: 'rgba(216,90,48,0.3)',
                accent: '#D85A30',
                features: [
                  { text: 'Unlimited tutor sessions', ok: true },
                  { text: 'All 6 subjects', ok: true },
                  { text: 'Unlimited session duration', ok: true },
                  { text: 'Full dashboard history', ok: true },
                  { text: 'All 5 exam levels incl. JEE / NEET / UPSC', ok: true },
                  { text: 'Unlimited PDF downloads', ok: true },
                  { text: 'Priority support', ok: true },
                ],
                cta: isSignedIn
                  ? <Link href="/session" className="cta-btn" style={{ display: 'block', textAlign: 'center', color: '#FFFBF7', padding: '14px 0', borderRadius: 99, textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>Upgrade to Pro</Link>
                  : <SignUpButton><button className="cta-btn" style={{ display: 'block', width: '100%', color: '#FFFBF7', padding: '14px 0', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>Start with Pro</button></SignUpButton>,
              },
            ];

            return plans.map((p) => (
              <div key={p.key} style={{
                background: p.cardBg, borderRadius: 24,
                padding: '32px 28px',
                border: `2px solid ${p.border}`,
                boxShadow: p.popular ? `0 8px 40px rgba(29,158,117,0.14)` : `0 4px 24px rgba(216,90,48,0.06)`,
                position: 'relative', overflow: 'hidden',
                transform: p.popular ? 'scale(1.03)' : 'scale(1)',
              }}>
                {p.popular && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: 'linear-gradient(135deg,#1D9E75,#1D9E75cc)', color: '#FFFBF7', fontSize: 10, fontWeight: 800, padding: '3px 11px', borderRadius: 99, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: 'var(--font-poppins)' }}>
                    Popular
                  </div>
                )}
                {/* Plan name badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: p.badge.bg, color: p.badge.color, padding: '5px 14px', borderRadius: 99, marginBottom: 20, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-poppins)', letterSpacing: '0.3px' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 48, fontWeight: 900, color: '#4A1B0C', fontFamily: 'var(--font-poppins)', lineHeight: 1, marginBottom: 4 }}>{p.price}</div>
                <p style={{ color: '#993C1D', fontSize: 12.5, marginBottom: 28, opacity: 0.7 }}>{p.sub}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {p.features.map((f, fi) => (
                    <li key={fi} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: f.ok ? `linear-gradient(135deg,${p.accent},${p.accent}bb)` : '#F0EDF9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {f.ok ? <CheckIcon /> : <XIcon />}
                      </div>
                      <span style={{ color: f.ok ? '#4A1B0C' : '#993C1D', fontSize: 13.5, opacity: f.ok ? 1 : 0.5 }}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                {p.cta}
              </div>
            ));
          })()}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="tt-section" style={{ textAlign: 'center', paddingTop: 84, paddingBottom: 84, background: 'linear-gradient(130deg, #D85A30 0%, #EF9F27 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 25% 50%, rgba(255,255,255,0.12) 0%, transparent 55%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 60%, rgba(255,255,255,0.07) 0%, transparent 45%)', pointerEvents: 'none' }} />
        <h2 style={{ fontSize: 'clamp(28px, 5vw, 50px)', fontWeight: 800, color: '#FFFBF7', marginBottom: 18, position: 'relative', letterSpacing: '-1.5px', fontFamily: 'var(--font-poppins)' }}>Ready to understand more?</h2>
        <p style={{ color: 'rgba(255,251,247,0.88)', fontSize: 'clamp(15px, 2.5vw, 18px)', marginBottom: 44, position: 'relative' }}>Join 10,000+ students learning smarter every day.</p>
        {isSignedIn ? (
          <Link href="/session" style={{ background: '#FFFBF7', color: '#D85A30', padding: 'clamp(14px,2.5vw,20px) clamp(28px,5vw,56px)', borderRadius: 99, textDecoration: 'none', fontWeight: 800, fontSize: 'clamp(15px,2vw,18px)', fontFamily: 'var(--font-poppins)', display: 'inline-block', position: 'relative', letterSpacing: '-0.3px', transition: 'transform 0.2s, box-shadow 0.2s' }}>
            Start for free →
          </Link>
        ) : (
          <SignUpButton>
            <button style={{ background: '#FFFBF7', color: '#D85A30', padding: 'clamp(14px,2.5vw,20px) clamp(28px,5vw,56px)', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 'clamp(15px,2vw,18px)', fontFamily: 'var(--font-poppins)', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', letterSpacing: '-0.3px' }}>
              Start for free →
            </button>
          </SignUpButton>
        )}
      </section>
    </div>
  );
}
