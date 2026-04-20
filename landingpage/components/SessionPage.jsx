
const { useState, useEffect, useRef } = React;

const CONVO = [
  { role: 'tutor',   text: "Hi! I'm here to help you explore calculus. What would you like to work on today?",                                                                      delay: 800  },
  { role: 'student', text: "I don't really understand how to find the derivative of x squared.",                                                                                    delay: 3200 },
  { role: 'tutor',   text: "Great starting point! Before I explain, tell me — what do you think a derivative actually measures?",                                                    delay: 6000 },
  { role: 'student', text: "Umm… the slope? Like how steep the graph is at a point?",                                                                                               delay: 9800 },
  { role: 'tutor',   text: "Exactly right — the slope at each specific point. Now, does y = x² have the same slope everywhere, or does it change?",                                delay: 13200 },
  { role: 'student', text: "It changes… it's steeper on the sides and flat at the bottom?",                                                                                         delay: 17000 },
  { role: 'tutor',   text: "Perfect observation! So the derivative tells us the slope at every x. Using the power rule — if f(x) = xⁿ, then f'(x) = n·xⁿ⁻¹ — can you apply that to x²?", delay: 21000 },
  { role: 'student', text: "So… f'(x) = 2x?",                                                                                                                                       delay: 25000 },
  { role: 'tutor',   text: "Yes! f'(x) = 2x — which means at x = 3 the slope is 6, and at x = 0 the slope is 0. That's why the bottom is flat. You worked that out yourself! 🎉",  delay: 28200 },
];

const ORB_SEQ = ['idle', 'listening', 'speaking', 'listening', 'speaking', 'listening', 'speaking', 'listening', 'speaking'];

const SessionPage = ({ onNavigate }) => {
  const [messages, setMessages]   = useState([]);
  const [orbState, setOrbState]   = useState('idle');
  const [secs, setSecs]           = useState(0);
  const [muted, setMuted]         = useState(false);
  const [ended, setEnded]         = useState(false);
  const [topic, setTopic]         = useState('Power Rule');
  const scrollRef                 = useRef(null);

  /* timer */
  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* simulated conversation */
  useEffect(() => {
    const timers = CONVO.map((msg, i) =>
      setTimeout(() => {
        setMessages(prev => [...prev, { ...msg, id: Date.now() + i }]);
        setOrbState(ORB_SEQ[i + 1] || 'idle');
      }, msg.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  /* auto-scroll */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /* ── Ended screen ── */
  if (ended) return (
    <div className="page-in" style={{ minHeight: '100vh', background: '#FFFBF7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#E0F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 34, fontWeight: 800, color: '#4A1B0C', marginBottom: 10, letterSpacing: '-0.8px' }}>Session complete!</h2>
        <p style={{ color: '#993C1D', fontSize: 16 }}>Your PDF report is ready to download.</p>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <button style={{ background: '#E0F5EE', color: '#1D9E75', padding: '13px 28px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 15, fontFamily: 'Poppins' }}>
          Download PDF
        </button>
        <button onClick={() => onNavigate('dashboard')} className="cta-btn" style={{ color: 'white', padding: '13px 32px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, fontFamily: 'Poppins' }}>
          View dashboard →
        </button>
      </div>
    </div>
  );

  /* ── Orb state color map ── */
  const orbStateColor = { idle: '#993C1D', listening: '#1D9E75', speaking: '#D85A30', interrupted: '#EF9F27' };
  const orbStateLabel = { idle: 'Ready', listening: 'Listening…', speaking: 'Explaining…', interrupted: 'Pausing…' };

  return (
    <div className="page-in" style={{ minHeight: '100vh', background: '#FFFBF7', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ── */}
      <div style={{ padding: '0 32px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(216,90,48,0.08)', background: 'white', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button onClick={() => onNavigate('landing')} style={{ color: '#993C1D', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, opacity: 0.7, transition: 'opacity .2s' }}
            onMouseEnter={e => e.target.style.opacity = '1'}
            onMouseLeave={e => e.target.style.opacity = '0.7'}>←</button>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#4A1B0C' }}>Calculus · Derivatives</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#FCE9EF', borderRadius: 99, padding: '5px 16px' }}>
            <div className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#D4537E', flexShrink: 0 }} />
            <span style={{ color: '#D4537E', fontWeight: 700, fontSize: 12 }}>Session active</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {/* topic card */}
          <div style={{ background: '#FAECE7', borderRadius: 14, padding: '8px 20px', textAlign: 'center', minWidth: 110 }}>
            <div style={{ fontSize: 11, color: '#D85A30', fontWeight: 600, marginBottom: 1, letterSpacing: '0.5px' }}>TOPIC</div>
            <div style={{ fontSize: 14, color: '#4A1B0C', fontWeight: 700 }}>{topic}</div>
          </div>
          {/* timer card */}
          <div style={{ background: '#E0F5EE', borderRadius: 14, padding: '8px 20px', textAlign: 'center', minWidth: 90 }}>
            <div style={{ fontSize: 11, color: '#1D9E75', fontWeight: 600, marginBottom: 1, letterSpacing: '0.5px' }}>TIME</div>
            <div style={{ fontSize: 14, color: '#4A1B0C', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(secs)}</div>
          </div>
        </div>
      </div>

      {/* ── Main split ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

        {/* Left: Orb panel */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 48px', gap: 28 }}>
          <VoiceOrb state={orbState} size="lg" />

          {/* state label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 99, padding: '9px 22px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: orbStateColor[orbState], transition: 'background .5s', flexShrink: 0 }} />
            <span style={{ color: '#4A1B0C', fontSize: 13, fontWeight: 600, transition: 'all .3s' }}>{orbStateLabel[orbState]}</span>
          </div>

          {/* interactive state picker (demo tool) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#993C1D', opacity: 0.45, fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Demo orb states</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['idle', 'listening', 'speaking', 'interrupted'].map(s => (
                <button key={s} onClick={() => setOrbState(s)} style={{
                  padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, fontFamily: 'Poppins', transition: 'all .2s',
                  background: orbState === s ? '#D85A30' : '#FAECE7',
                  color: orbState === s ? 'white' : '#D85A30',
                  transform: orbState === s ? 'scale(1.06)' : 'scale(1)',
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Transcript */}
        <div style={{ borderLeft: '1.5px solid rgba(216,90,48,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(216,90,48,0.07)', background: 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#4A1B0C' }}>Live Transcript</span>
            <span style={{ fontSize: 12, color: '#993C1D', opacity: 0.5 }}>{messages.length} messages</span>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#993C1D', opacity: 0.35 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#993C1D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Your conversation will appear here…</div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={msg.id || i} className="slide-up" style={{ display: 'flex', justifyContent: msg.role === 'student' ? 'flex-start' : 'flex-end', animationDelay: '0s' }}>
                <div style={{
                  maxWidth: '78%',
                  padding: '11px 16px',
                  borderRadius: msg.role === 'student' ? '5px 18px 18px 18px' : '18px 5px 18px 18px',
                  background: msg.role === 'student' ? '#EEEDFE' : '#FAECE7',
                  fontSize: 13.5, lineHeight: 1.65,
                  color: msg.role === 'student' ? '#26215C' : '#4A1B0C',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, opacity: 0.55, letterSpacing: '1.2px', textTransform: 'uppercase', color: msg.role === 'student' ? '#7F77DD' : '#D85A30' }}>
                    {msg.role === 'student' ? 'You' : 'TutorTalk AI'}
                  </div>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{ padding: '14px 32px', borderTop: '1.5px solid rgba(216,90,48,0.08)', background: 'white', display: 'flex', justifyContent: 'center', gap: 14, flexShrink: 0 }}>
        <button onClick={() => setEnded(true)} className="cta-btn" style={{ color: 'white', padding: '12px 34px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'Poppins', display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="white" strokeWidth="2"/><line x1="9" y1="8" x2="15" y2="8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="9" y1="12" x2="15" y2="12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="9" y1="16" x2="12" y2="16" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
          End &amp; Save PDF
        </button>
        <button onClick={() => setMuted(m => !m)} style={{
          background: muted ? '#7F77DD' : '#EEEDFE',
          color: muted ? 'white' : '#7F77DD',
          padding: '12px 28px', borderRadius: 99, border: 'none', cursor: 'pointer',
          fontWeight: 700, fontSize: 14, fontFamily: 'Poppins',
          display: 'flex', alignItems: 'center', gap: 9,
          transition: 'all .2s',
        }}>
          {muted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V6a3 3 0 00-5.94-.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M17 16.95A7 7 0 015 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/><path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          )}
          {muted ? 'Unmute mic' : 'Mute mic'}
        </button>
      </div>
    </div>
  );
};

Object.assign(window, { SessionPage });
