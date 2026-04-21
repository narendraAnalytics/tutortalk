'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, UserButton, useAuth, useUser } from '@clerk/nextjs';
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
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'speaking' | 'interrupted'>('idle');

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

  return (
    <div className="page-in" style={{ minHeight: '100vh', background: '#FFFBF7', overflowX: 'hidden' }}>

      {/* ── Nav ── */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 52px', position: 'relative', zIndex: 20 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1776668144/logotutortalk_ecmdbm.png" alt="TutorTalk" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <span style={{ fontSize: 21, fontWeight: 800, color: '#4A1B0C', letterSpacing: '-0.4px', fontFamily: 'var(--font-poppins)' }}>TutorTalk</span>
        </Link>

        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {isSignedIn ? (
            <>
              <Link href="/session" className="cta-btn" style={{ color: '#FFFBF7', padding: '11px 28px', borderRadius: 99, textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>
                New session
              </Link>
              <UserButton />
            </>
          ) : (
            <SignInButton>
              <button className="cta-btn" style={{ color: '#FFFBF7', padding: '11px 28px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>
                Sign in
              </button>
            </SignInButton>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', padding: '40px 52px 80px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: -80, right: -100, width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(216,90,48,0.09) 0%, transparent 65%)', animation: 'blob-drift 11s ease-in-out infinite', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: -80, left: -120, width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(127,119,221,0.07) 0%, transparent 65%)', animation: 'blob-drift 15s ease-in-out reverse infinite', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '35%', left: '3%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(29,158,117,0.06) 0%, transparent 65%)', animation: 'blob-drift 13s ease-in-out 2s infinite', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {isSignedIn && user ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#FAECE7', borderRadius: 99, padding: '10px 24px', marginBottom: 36 }}>
              <span style={{ fontSize: 18 }}>👋</span>
              <span style={{ color: '#D85A30', fontWeight: 700, fontSize: 14 }}>Welcome back, {user.firstName ?? user.username ?? 'there'}!</span>
            </div>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FAECE7', borderRadius: 99, padding: '8px 22px', marginBottom: 36 }}>
              <div className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#D4537E', flexShrink: 0 }} />
              <span style={{ color: '#D85A30', fontWeight: 600, fontSize: 13, letterSpacing: '0.2px' }}>Socratic AI tutoring · Live voice</span>
            </div>
          )}

          <h1 style={{ fontSize: 'clamp(48px, 7vw, 82px)', fontWeight: 800, lineHeight: 1.08, maxWidth: 820, marginBottom: 28, letterSpacing: '-2px', fontFamily: 'var(--font-poppins)' }}>
            <span className="gradient-text">Ask anything.</span><br />
            <span style={{ color: '#4A1B0C' }}>Learn by talking.</span>
          </h1>

          <p style={{ fontSize: 19, color: '#993C1D', maxWidth: 520, lineHeight: 1.72, marginBottom: 44, opacity: 0.9 }}>
            TutorTalk uses Socratic voice AI to guide you to answers — not just give them.
          </p>

          <div style={{ display: 'flex', gap: 14, marginBottom: 72, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            {isSignedIn ? (
              <Link href="/dashboard" className="cta-btn" style={{ color: '#FFFBF7', padding: '18px 50px', borderRadius: 99, textDecoration: 'none', fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-poppins)', letterSpacing: '-0.3px', display: 'inline-block' }}>
                Start learning free
              </Link>
            ) : (
              <SignInButton>
                <button className="cta-btn" style={{ color: '#FFFBF7', padding: '18px 50px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-poppins)', letterSpacing: '-0.3px' }}>
                  Start learning free
                </button>
              </SignInButton>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <VoiceOrb state={orbState} size="lg" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF8F3', borderRadius: 99, padding: '9px 22px', boxShadow: '0 2px 16px rgba(216,90,48,0.08)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: STATE_DOT[orbState], opacity: 0.8 }} />
              <span style={{ color: '#4A1B0C', fontSize: 13, fontWeight: 500 }}>{STATE_LABEL[orbState]}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Subject chips ── */}
      <section style={{ padding: '20px 52px 72px', textAlign: 'center' }}>
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
      <section style={{ padding: '20px 52px 96px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 40, fontWeight: 700, color: '#4A1B0C', marginBottom: 52, letterSpacing: '-1px', fontFamily: 'var(--font-poppins)' }}>Why TutorTalk works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, maxWidth: 1020, margin: '0 auto' }}>
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

      {/* ── Testimonials ── */}
      <section style={{ padding: '20px 52px 100px', background: 'linear-gradient(180deg, #FFFBF7 0%, #FFF4EE 100%)' }}>
        <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 700, color: '#4A1B0C', marginBottom: 52, letterSpacing: '-0.8px', fontFamily: 'var(--font-poppins)' }}>Students love it</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, maxWidth: 1020, margin: '0 auto' }}>
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

      {/* ── Footer CTA ── */}
      <section style={{ textAlign: 'center', padding: '84px 52px', background: 'linear-gradient(130deg, #D85A30 0%, #EF9F27 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 25% 50%, rgba(255,255,255,0.12) 0%, transparent 55%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 60%, rgba(255,255,255,0.07) 0%, transparent 45%)', pointerEvents: 'none' }} />
        <h2 style={{ fontSize: 50, fontWeight: 800, color: '#FFFBF7', marginBottom: 18, position: 'relative', letterSpacing: '-1.5px', fontFamily: 'var(--font-poppins)' }}>Ready to understand more?</h2>
        <p style={{ color: 'rgba(255,251,247,0.88)', fontSize: 18, marginBottom: 44, position: 'relative' }}>Join 10,000+ students learning smarter every day.</p>
        {isSignedIn ? (
          <Link href="/session" style={{ background: '#FFFBF7', color: '#D85A30', padding: '20px 56px', borderRadius: 99, textDecoration: 'none', fontWeight: 800, fontSize: 18, fontFamily: 'var(--font-poppins)', display: 'inline-block', position: 'relative', letterSpacing: '-0.3px', transition: 'transform 0.2s, box-shadow 0.2s' }}>
            Start for free →
          </Link>
        ) : (
          <SignUpButton>
            <button style={{ background: '#FFFBF7', color: '#D85A30', padding: '20px 56px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 18, fontFamily: 'var(--font-poppins)', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', letterSpacing: '-0.3px' }}>
              Start for free →
            </button>
          </SignUpButton>
        )}
      </section>
    </div>
  );
}
