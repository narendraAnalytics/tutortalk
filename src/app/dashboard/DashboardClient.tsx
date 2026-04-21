'use client';

import Link from 'next/link';
import type { SessionRow } from './page';

const SUBJECT_STYLE: Record<string, { bg: string; color: string; glow: string }> = {
  Math:           { bg: '#FAECE7', color: '#D85A30', glow: '#D85A3030' },
  Physics:        { bg: '#E0F5EE', color: '#1D9E75', glow: '#1D9E7530' },
  Chemistry:      { bg: '#EEEDFE', color: '#7F77DD', glow: '#7F77DD30' },
  Biology:        { bg: '#FEF3E2', color: '#C47A14', glow: '#C47A1430' },
  English:        { bg: '#FCE9EF', color: '#D4537E', glow: '#D4537E30' },
  History:        { bg: '#F0EDF9', color: '#6B5DB0', glow: '#6B5DB030' },
  Geography:      { bg: '#E0F5EE', color: '#1D9E75', glow: '#1D9E7530' },
  Polity:         { bg: '#FAECE7', color: '#D85A30', glow: '#D85A3030' },
  Economics:      { bg: '#FEF3E2', color: '#C47A14', glow: '#C47A1430' },
  'Science & Technology': { bg: '#EEEDFE', color: '#7F77DD', glow: '#7F77DD30' },
  Hindi:          { bg: '#FEF3E2', color: '#C47A14', glow: '#C47A1430' },
  Science:        { bg: '#E0F5EE', color: '#1D9E75', glow: '#1D9E7530' },
  'Social Studies': { bg: '#F0EDF9', color: '#6B5DB0', glow: '#6B5DB030' },
};

function subjectStyle(subject: string) {
  const base = subject.split(' — ')[0].trim();
  return SUBJECT_STYLE[base] ?? { bg: '#F2E4DB', color: '#993C1D', glow: '#993C1D30' };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDur(secs: number) {
  const m = Math.floor(secs / 60);
  return m < 1 ? '< 1 min' : `${m} min`;
}

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

type Props = {
  firstName: string;
  sessions: SessionRow[];
  totalSessions: number;
  totalMinutes: number;
  topicsCovered: number;
};

export default function DashboardClient({ firstName, sessions, totalSessions, totalMinutes, topicsCovered }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const METRICS = [
    {
      label: 'Sessions completed', value: String(totalSessions),
      from: '#FAECE7', to: '#FDE8DE', color: '#D85A30', glow: '#D85A3025',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="12" rx="3" fill="#D85A30" opacity=".9"/>
          <path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="#D85A30" strokeWidth="2.2" strokeLinecap="round"/>
          <line x1="12" y1="17" x2="12" y2="21" stroke="#D85A30" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: 'Subjects explored', value: String(topicsCovered),
      from: '#EEEDFE', to: '#E5E3FD', color: '#7F77DD', glow: '#7F77DD25',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="3" width="16" height="18" rx="3" stroke="#7F77DD" strokeWidth="2"/>
          <line x1="8" y1="8" x2="16" y2="8" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="8" y1="12" x2="16" y2="12" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="8" y1="16" x2="12" y2="16" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: 'Minutes learned', value: String(totalMinutes),
      from: '#E0F5EE', to: '#D4F0E4', color: '#1D9E75', glow: '#1D9E7525',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#1D9E75" strokeWidth="2"/>
          <polyline points="12 7 12 12 15 15" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-120%) skewX(-15deg); }
          100% { transform: translateX(320%)  skewX(-15deg); }
        }
        @keyframes floatA {
          0%,100% { transform: translate(0,0) scale(1); }
          40%     { transform: translate(30px,-40px) scale(1.08); }
          70%     { transform: translate(-20px,20px) scale(0.95); }
        }
        @keyframes floatB {
          0%,100% { transform: translate(0,0) scale(1); }
          35%     { transform: translate(-25px,35px) scale(1.06); }
          65%     { transform: translate(20px,-18px) scale(0.96); }
        }
        @keyframes lineScroll {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes orbPulse {
          0%,100% { opacity: .55; }
          50%     { opacity: .75; }
        }
        @keyframes gradFlow {
          0%,100% { background-position: 0% 50%; }
          50%     { background-position: 100% 50%; }
        }
        @keyframes sparkle {
          0%,100% { opacity: 0; transform: scale(0.5); }
          50%     { opacity: 1; transform: scale(1); }
        }

        .dash-metric-card {
          position: relative; overflow: hidden;
          border-radius: 22px; padding: 26px 24px;
          display: flex; align-items: center; gap: 18;
          cursor: default;
          transition: transform .25s ease, box-shadow .25s ease;
          animation: fadeUp .6s ease backwards;
        }
        .dash-metric-card::after {
          content: '';
          position: absolute; top: 0; left: 0;
          width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
          animation: shimmer 3.2s ease-in-out infinite;
          pointer-events: none;
        }
        .dash-metric-card:hover {
          transform: translateY(-5px) scale(1.02);
        }

        .dash-session-card {
          position: relative; overflow: hidden;
          border-radius: 18px; padding: 18px 22px;
          display: flex; align-items: center; gap: 18;
          transition: transform .22s ease, box-shadow .22s ease;
          animation: fadeUp .5s ease backwards;
          background: rgba(255,248,243,0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1.5px solid rgba(242,228,219,0.7);
        }
        .dash-session-card::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,.3) 0%, transparent 60%);
          pointer-events: none; border-radius: inherit;
        }
        .dash-session-card:hover {
          transform: translateX(6px);
        }

        .dl-btn {
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
        }
        .dl-btn:hover {
          transform: scale(1.06);
        }

        .cta-banner {
          background: linear-gradient(120deg, #D85A30, #EF9F27, #D85A30, #E8732A);
          background-size: 300% 300%;
          animation: gradFlow 5s ease infinite;
        }

        .line-accent {
          height: 2px; border-radius: 99px;
          background: linear-gradient(90deg, #D85A30, #EF9F27, #7F77DD, #D85A30);
          background-size: 200% 100%;
          animation: lineScroll 4s linear infinite;
        }

        .greeting-name {
          background: linear-gradient(120deg, #D85A30, #EF9F27, #D4537E);
          background-size: 200% 200%;
          animation: gradFlow 4s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .sparkle-dot {
          position: absolute;
          width: 5px; height: 5px;
          border-radius: 50%;
          animation: sparkle 2.4s ease-in-out infinite;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#FFFBF7', position: 'relative', overflow: 'hidden' }}>

        {/* ── Floating background orbs ── */}
        <div className="tt-blob-hide" style={{
          position: 'fixed', top: -120, right: -80, width: 520, height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #EF9F2740 0%, #D85A3018 50%, transparent 70%)',
          animation: 'floatA 12s ease-in-out infinite', pointerEvents: 'none', zIndex: 0,
        }} />
        <div className="tt-blob-hide" style={{
          position: 'fixed', bottom: -100, left: -60, width: 440, height: 440,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #7F77DD30 0%, #D4537E15 50%, transparent 70%)',
          animation: 'floatB 15s ease-in-out infinite', pointerEvents: 'none', zIndex: 0,
        }} />
        <div style={{
          position: 'fixed', top: '40%', left: '55%', width: 280, height: 280,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #1D9E7518 0%, transparent 70%)',
          animation: 'floatA 18s ease-in-out infinite reverse', pointerEvents: 'none', zIndex: 0,
        }} />

        {/* ── Nav ── */}
        <div className="tt-section" style={{
          position: 'relative', zIndex: 10,
          paddingTop: 0, paddingBottom: 0, height: 68,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,248,243,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1.5px solid rgba(216,90,48,0.09)',
          animation: 'fadeIn .5s ease',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1776668144/logotutortalk_ecmdbm.png"
              alt="TutorTalk" style={{ width: 34, height: 34, objectFit: 'contain' }} />
            <span style={{ fontSize: 18, fontWeight: 800, color: '#4A1B0C', letterSpacing: '-0.4px', fontFamily: 'var(--font-poppins)' }}>TutorTalk</span>
          </Link>
          <Link href="/session" className="cta-btn" style={{ color: '#FFFBF7', padding: '10px 26px', borderRadius: 99, textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>
            + New session
          </Link>
        </div>

        {/* ── Animated line accent ── */}
        <div className="line-accent" style={{ position: 'relative', zIndex: 10 }} />

        <div className="tt-section" style={{ position: 'relative', zIndex: 10, maxWidth: 940, margin: '0 auto', paddingTop: 52, paddingBottom: 80 }}>

          {/* ── Greeting ── */}
          <div style={{ marginBottom: 48, animation: 'fadeUp .6s ease backwards' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D85A30', boxShadow: '0 0 10px #D85A30' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#993C1D', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7 }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(26px, 5vw, 42px)', fontWeight: 800, letterSpacing: '-1.2px', marginBottom: 10, fontFamily: 'var(--font-poppins)', lineHeight: 1.1 }}>
              <span style={{ color: '#4A1B0C' }}>{greeting}, </span>
              <span className="greeting-name">{firstName}!</span>
            </h1>
            <p style={{ color: '#993C1D', fontSize: 16, opacity: 0.75, maxWidth: 460 }}>
              {totalSessions === 0
                ? 'Start your first session and begin learning today.'
                : `You've completed ${totalSessions} session${totalSessions !== 1 ? 's' : ''} — keep the momentum going!`}
            </p>
          </div>

          {/* ── Metric cards ── */}
          <div className="tt-grid-3-metric" style={{ marginBottom: 52 }}>
            {METRICS.map((m, i) => (
              <div
                key={i}
                className="dash-metric-card"
                style={{
                  background: `linear-gradient(135deg, ${m.from} 0%, ${m.to} 100%)`,
                  boxShadow: `0 4px 24px ${m.glow}`,
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                {/* Icon circle */}
                <div style={{
                  width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                  background: 'rgba(255,255,255,0.65)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 2px 16px ${m.glow}`,
                }}>
                  {m.icon}
                </div>
                <div>
                  <div style={{
                    fontSize: 40, fontWeight: 800, color: m.color,
                    lineHeight: 1, letterSpacing: '-1.5px',
                    fontFamily: 'var(--font-poppins)',
                    textShadow: `0 0 28px ${m.color}40`,
                  }}>
                    {m.value}
                  </div>
                  <div style={{ fontSize: 12, color: m.color, fontWeight: 600, marginTop: 5, opacity: 0.7, letterSpacing: '0.02em' }}>
                    {m.label}
                  </div>
                </div>

                {/* Decorative corner dots */}
                <div className="sparkle-dot" style={{ top: 12, right: 14, background: m.color, opacity: 0.4, animationDelay: '0s' }} />
                <div className="sparkle-dot" style={{ top: 22, right: 24, background: m.color, opacity: 0.25, animationDelay: '0.8s', width: 3, height: 3 }} />
                <div className="sparkle-dot" style={{ bottom: 14, right: 18, background: m.color, opacity: 0.3, animationDelay: '1.6s', width: 4, height: 4 }} />
              </div>
            ))}
          </div>

          {/* ── Mode cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, marginBottom: 48 }}>
            {/* Train card */}
            <Link href="/session" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  borderRadius: 22, padding: '28px 26px',
                  background: 'linear-gradient(135deg, #FAECE7 0%, #FDE8DE 100%)',
                  border: '1.5px solid rgba(216,90,48,0.14)',
                  boxShadow: '0 4px 24px rgba(216,90,48,0.10)',
                  cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  transition: 'transform .22s ease, box-shadow .22s ease',
                  animation: 'fadeUp .6s .25s ease backwards',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 36px rgba(216,90,48,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(216,90,48,0.10)'; }}
              >
                <div style={{ fontSize: 34, marginBottom: 10 }}>🎓</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#4A1B0C', fontFamily: 'var(--font-poppins)', marginBottom: 6 }}>Train</div>
                <div style={{ fontSize: 13.5, color: '#993C1D', opacity: 0.75, marginBottom: 20 }}>Practice with your AI tutor</div>
                <div style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #D85A30, #EF9F27)',
                  color: '#FFFBF7', padding: '8px 22px', borderRadius: 99,
                  fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-poppins)',
                }}>
                  Start training →
                </div>
              </div>
            </Link>

            {/* Exam card */}
            <Link href="/exam" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  borderRadius: 22, padding: '28px 26px',
                  background: 'linear-gradient(135deg, #EDF2FF 0%, #E0E7FF 100%)',
                  border: '1.5px solid rgba(59,91,219,0.14)',
                  boxShadow: '0 4px 24px rgba(59,91,219,0.10)',
                  cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  transition: 'transform .22s ease, box-shadow .22s ease',
                  animation: 'fadeUp .6s .35s ease backwards',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 36px rgba(59,91,219,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(59,91,219,0.10)'; }}
              >
                <div style={{ fontSize: 34, marginBottom: 10 }}>📝</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1E3A8A', fontFamily: 'var(--font-poppins)', marginBottom: 6 }}>Exam</div>
                <div style={{ fontSize: 13.5, color: '#3B5BDB', opacity: 0.8, marginBottom: 20 }}>Test yourself with MCQ exams</div>
                <div style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #3B5BDB, #4C6EF5)',
                  color: '#FFFBF7', padding: '8px 22px', borderRadius: 99,
                  fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-poppins)',
                }}>
                  Take exam →
                </div>
              </div>
            </Link>
          </div>

          {/* ── Sessions list ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#4A1B0C', letterSpacing: '-0.5px', fontFamily: 'var(--font-poppins)', animation: 'fadeUp .6s .3s ease backwards' }}>
                Past sessions
              </h2>
              <span style={{ fontSize: 13, color: '#993C1D', opacity: 0.45, fontWeight: 600 }}>
                {totalSessions} session{totalSessions !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Subtle line below heading */}
            <div style={{ height: 1.5, background: 'linear-gradient(90deg, #F2E4DB, transparent)', marginBottom: 20, borderRadius: 99, animation: 'fadeIn .8s .4s ease backwards' }} />

            {sessions.length === 0 ? (
              <div style={{
                background: 'rgba(255,248,243,0.7)',
                backdropFilter: 'blur(12px)',
                borderRadius: 20, padding: '52px 24px', textAlign: 'center',
                border: '1.5px dashed rgba(242,228,219,0.9)',
                animation: 'fadeUp .6s .35s ease backwards',
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
                <p style={{ color: '#993C1D', fontSize: 16, fontWeight: 700, marginBottom: 8, fontFamily: 'var(--font-poppins)' }}>No sessions yet</p>
                <p style={{ color: '#C4A99A', fontSize: 14, marginBottom: 24 }}>Start your first session to see it here.</p>
                <Link href="/session" className="cta-btn" style={{ textDecoration: 'none', padding: '13px 36px', borderRadius: 99, color: '#FFFBF7', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)', display: 'inline-block' }}>
                  Start a session
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sessions.map((s, idx) => {
                  const st = subjectStyle(s.subject);
                  return (
                    <div
                      key={s.id}
                      className="dash-session-card"
                      style={{
                        boxShadow: `0 2px 20px rgba(216,90,48,0.06)`,
                        animationDelay: `${0.35 + idx * 0.07}s`,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 36px ${st.glow}, 0 2px 20px rgba(216,90,48,0.08)`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 20px rgba(216,90,48,0.06)'; }}
                    >
                      {/* Colored left glow bar */}
                      <div style={{
                        position: 'absolute', left: 0, top: '20%', bottom: '20%',
                        width: 3, borderRadius: '0 99px 99px 0',
                        background: st.color, opacity: 0.6,
                      }} />

                      {/* Subject badge */}
                      <div style={{
                        background: st.bg, color: st.color,
                        padding: '6px 16px', borderRadius: 99,
                        fontWeight: 700, fontSize: 12.5, flexShrink: 0,
                        fontFamily: 'var(--font-poppins)',
                        boxShadow: `0 2px 12px ${st.glow}`,
                        border: `1px solid ${st.color}20`,
                      }}>
                        {s.subject.split(' — ')[0]}
                      </div>

                      {/* Exam type badge */}
                      {s.type === 'exam' && (
                        <div style={{
                          background: '#EDF2FF', color: '#3B5BDB',
                          padding: '4px 10px', borderRadius: 99,
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                          border: '1px solid rgba(59,91,219,0.2)',
                          letterSpacing: '0.04em',
                        }}>
                          EXAM
                        </div>
                      )}

                      {/* Score badge */}
                      {s.type === 'exam' && s.score && (
                        <div style={{
                          background: '#E0E7FF', color: '#3B5BDB',
                          padding: '4px 10px', borderRadius: 99,
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>
                          {s.score.answered}/{s.score.total} answered
                        </div>
                      )}

                      {/* Session info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#4A1B0C', fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-poppins)' }}>
                          {s.preview}
                        </div>
                        <div style={{ fontSize: 12, color: '#993C1D', opacity: 0.55, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span>{fmtDate(s.startedAt)}</span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#993C1D', opacity: 0.4, flexShrink: 0, display: 'inline-block' }} />
                          <span>{fmtDur(s.durationSecs)}</span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#993C1D', opacity: 0.4, flexShrink: 0, display: 'inline-block' }} />
                          <span>{s.exchangeCount} exchanges</span>
                        </div>
                      </div>

                      {/* Transcript download */}
                      <a
                        href={`/api/session/transcript?sessionId=${s.id}`}
                        className="dl-btn"
                        style={{
                          background: st.bg, color: st.color,
                          padding: '8px 18px', borderRadius: 99,
                          fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-poppins)',
                          flexShrink: 0, textDecoration: 'none',
                          display: 'flex', alignItems: 'center', gap: 6,
                          border: `1px solid ${st.color}25`,
                          boxShadow: `0 2px 10px ${st.glow}`,
                        }}
                      >
                        <DownloadIcon /> PDF
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Bottom CTA ── */}
          <div
            className="cta-banner tt-cta-banner"
            style={{
              marginTop: 52, borderRadius: 24, padding: 'clamp(22px,4vw,38px) clamp(22px,4vw,44px)',
              position: 'relative', overflow: 'hidden',
              animation: 'fadeUp .6s .5s ease backwards',
            }}
          >
            {/* Sparkle dots in banner */}
            {[[12, 18, '#FFFBF7', '0s'], [60, 70, '#EF9F27', '1.2s'], [80, 30, '#FFFBF7', '0.6s'], [25, 65, '#FFFBF7', '1.8s']].map(([t, r, c, d], i) => (
              <div key={i} className="sparkle-dot" style={{ top: `${t}%`, right: `${r}px`, background: String(c), opacity: 0.5, animationDelay: String(d) }} />
            ))}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 23, fontWeight: 800, color: '#FFFBF7', marginBottom: 6, letterSpacing: '-0.4px', fontFamily: 'var(--font-poppins)' }}>
                Ready for today&apos;s session?
              </div>
              <div style={{ color: 'rgba(255,251,247,0.78)', fontSize: 14 }}>
                Pick a subject and let TutorTalk guide you.
              </div>
            </div>
            <Link
              href="/session"
              style={{
                background: 'rgba(255,251,247,0.92)',
                color: '#D85A30', padding: '14px 38px', borderRadius: 99,
                textDecoration: 'none', fontWeight: 800, fontSize: 15,
                fontFamily: 'var(--font-poppins)', flexShrink: 0,
                display: 'inline-block', position: 'relative', zIndex: 1,
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                transition: 'transform .2s ease, box-shadow .2s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.06)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = ''; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)'; }}
            >
              Start session →
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
