'use client';

import { useState } from 'react';
import Link from 'next/link';

const SESSIONS = [
  { subject: 'Math',      sc: '#D85A30', sb: '#FAECE7', topic: 'Derivatives — Power Rule',        date: 'Apr 18, 2026', dur: '22 min', msgs: 9  },
  { subject: 'Physics',   sc: '#1D9E75', sb: '#E0F5EE', topic: "Newton's Second Law",              date: 'Apr 16, 2026', dur: '34 min', msgs: 14 },
  { subject: 'Chemistry', sc: '#7F77DD', sb: '#EEEDFE', topic: 'Ionic Bonds & Electron Sharing',   date: 'Apr 14, 2026', dur: '18 min', msgs: 7  },
  { subject: 'English',   sc: '#D4537E', sb: '#FCE9EF', topic: 'Metaphor vs Simile in Poetry',     date: 'Apr 11, 2026', dur: '28 min', msgs: 11 },
  { subject: 'Biology',   sc: '#C47A14', sb: '#FEF3E2', topic: 'Mitosis vs Meiosis',               date: 'Apr 9,  2026', dur: '41 min', msgs: 17 },
];

const METRICS = [
  {
    label: 'Total sessions', value: '12', bg: '#FAECE7', color: '#D85A30',
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" fill="#D85A30"/><path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="#D85A30" strokeWidth="2.2" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="21" stroke="#D85A30" strokeWidth="2.2" strokeLinecap="round"/></svg>,
  },
  {
    label: 'Topics covered', value: '34', bg: '#EEEDFE', color: '#7F77DD',
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="3" stroke="#7F77DD" strokeWidth="2"/><line x1="8" y1="8" x2="16" y2="8" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round"/><line x1="8" y1="16" x2="12" y2="16" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    label: 'Minutes learned', value: '287', bg: '#E0F5EE', color: '#1D9E75',
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#1D9E75" strokeWidth="2"/><polyline points="12 7 12 12 15 15" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
];

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#D85A30" strokeWidth="2" strokeLinecap="round"/>
    <polyline points="7 10 12 15 17 10" stroke="#D85A30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="15" x2="12" y2="3" stroke="#D85A30" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function DashboardClient({ firstName }: { firstName: string }) {
  const [downloadedIdx, setDownloadedIdx] = useState<number | null>(null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page-in" style={{ minHeight: '100vh', background: '#FFFBF7' }}>

      {/* ── Nav ── */}
      <div style={{ padding: '0 36px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(216,90,48,0.08)', background: '#FFF8F3', flexShrink: 0 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#D85A30,#EF9F27)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 12px rgba(216,90,48,0.28)' }}>
            <span style={{ color: '#FFFBF7', fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-poppins)' }}>T</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#4A1B0C', letterSpacing: '-0.4px', fontFamily: 'var(--font-poppins)' }}>TutorTalk</span>
        </Link>
        <Link href="/session" className="cta-btn" style={{ color: '#FFFBF7', padding: '10px 26px', borderRadius: 99, textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)' }}>
          + New session
        </Link>
      </div>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '52px 36px' }}>

        {/* ── Greeting ── */}
        <div style={{ marginBottom: 44 }}>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: '#4A1B0C', letterSpacing: '-1px', marginBottom: 8, fontFamily: 'var(--font-poppins)' }}>
            {greeting}, {firstName}! ☀️
          </h1>
          <p style={{ color: '#993C1D', fontSize: 16, opacity: 0.8 }}>You&apos;ve been on a great streak — 5 sessions this week!</p>
        </div>

        {/* ── Metric cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 52 }}>
          {METRICS.map((m, i) => (
            <div key={i}
              style={{ background: m.bg, borderRadius: 18, padding: '28px 26px', display: 'flex', alignItems: 'center', gap: 20, transition: 'transform .2s, box-shadow .2s', cursor: 'default' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 10px 32px ${m.color}22`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 12px ${m.color}18`, flexShrink: 0 }}>
                {m.icon}
              </div>
              <div>
                <div style={{ fontSize: 38, fontWeight: 800, color: m.color, lineHeight: 1, letterSpacing: '-1px', fontFamily: 'var(--font-poppins)' }}>{m.value}</div>
                <div style={{ fontSize: 12.5, color: '#993C1D', fontWeight: 600, marginTop: 4, opacity: 0.75 }}>{m.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Sessions list ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#4A1B0C', letterSpacing: '-0.4px', fontFamily: 'var(--font-poppins)' }}>Past sessions</h2>
            <span style={{ fontSize: 13, color: '#993C1D', opacity: 0.5 }}>{SESSIONS.length} sessions</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SESSIONS.map((s, i) => (
              <div key={i}
                style={{ background: '#FFF8F3', borderRadius: 16, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 18, boxShadow: '0 2px 16px rgba(216,90,48,0.06)', transition: 'transform .2s, box-shadow .2s', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(5px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 32px rgba(216,90,48,0.10)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 16px rgba(216,90,48,0.06)'; }}
              >
                <div style={{ background: s.sb, color: s.sc, padding: '6px 18px', borderRadius: 99, fontWeight: 700, fontSize: 13, flexShrink: 0, letterSpacing: '0.1px', fontFamily: 'var(--font-poppins)' }}>
                  {s.subject}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#4A1B0C', fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.topic}</div>
                  <div style={{ fontSize: 12, color: '#993C1D', opacity: 0.6, marginTop: 3 }}>{s.date} · {s.dur} · {s.msgs} exchanges</div>
                </div>
                <button
                  onClick={() => setDownloadedIdx(i)}
                  style={{
                    background: downloadedIdx === i ? '#E0F5EE' : '#FAECE7',
                    color:      downloadedIdx === i ? '#1D9E75' : '#D85A30',
                    padding: '8px 20px', borderRadius: 99, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font-poppins)', flexShrink: 0,
                    transition: 'all .25s', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {downloadedIdx === i ? <><CheckIcon /> Saved!</> : <><DownloadIcon /> Download PDF</>}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div style={{ marginTop: 48, background: 'linear-gradient(130deg, #D85A30 0%, #EF9F27 100%)', borderRadius: 20, padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFBF7', marginBottom: 6, letterSpacing: '-0.4px', fontFamily: 'var(--font-poppins)' }}>Ready for today&apos;s session?</div>
            <div style={{ color: 'rgba(255,251,247,0.82)', fontSize: 14 }}>Pick a subject and start learning right now.</div>
          </div>
          <Link href="/session"
            style={{ background: '#FFFBF7', color: '#D85A30', padding: '14px 36px', borderRadius: 99, textDecoration: 'none', fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-poppins)', flexShrink: 0, transition: 'transform .2s, box-shadow .2s', display: 'inline-block' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.05)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.14)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = ''; (e.currentTarget as HTMLAnchorElement).style.boxShadow = ''; }}
          >
            Start session →
          </Link>
        </div>
      </div>
    </div>
  );
}
