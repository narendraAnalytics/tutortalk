
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "page": "landing",
  "orbDemo": "speaking",
  "animationsOn": true
}/*EDITMODE-END*/;

const App = () => {
  const [page, setPage] = useState(() => localStorage.getItem('tt-page') || 'landing');
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [showTweaks, setShowTweaks] = useState(false);

  /* persist page */
  useEffect(() => { localStorage.setItem('tt-page', page); }, [page]);

  /* tweaks host protocol */
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode')   setShowTweaks(true);
      if (e.data?.type === '__deactivate_edit_mode') setShowTweaks(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const updateTweak = (key, value) => {
    const next = { ...tweaks, [key]: value };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*');
    if (key === 'page') setPage(value);
  };

  /* disable animations globally */
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--anim-play', tweaks.animationsOn ? 'running' : 'paused'
    );
  }, [tweaks.animationsOn]);

  return (
    <div style={{ fontFamily: 'Poppins, sans-serif' }}>
      {page === 'landing'    && <LandingPage    onNavigate={setPage} />}
      {page === 'session'    && <SessionPage    onNavigate={setPage} />}
      {page === 'dashboard'  && <DashboardPage  onNavigate={setPage} />}

      {/* ── Tweaks panel ── */}
      {showTweaks && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'white', borderRadius: 20, padding: '24px',
          boxShadow: '0 12px 60px rgba(74,27,12,0.14)',
          zIndex: 9999, minWidth: 248,
          border: '1.5px solid rgba(216,90,48,0.1)',
        }}>
          <div style={{ fontWeight: 800, color: '#4A1B0C', marginBottom: 20, fontSize: 15, letterSpacing: '-0.3px' }}>Tweaks</div>

          {/* page nav */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: '#993C1D', fontWeight: 700, marginBottom: 10, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Page</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['landing','Landing page'],['session','Session (live)'],['dashboard','Dashboard']].map(([p, label]) => (
                <button key={p} onClick={() => updateTweak('page', p)} style={{
                  padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontSize: 13, fontWeight: 600, fontFamily: 'Poppins',
                  background: page === p ? 'linear-gradient(90deg,#D85A30,#EF9F27)' : '#FAECE7',
                  color: page === p ? 'white' : '#D85A30',
                  transition: 'all .2s',
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* orb state demo (only on session page) */}
          {page === 'session' && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: '#993C1D', fontWeight: 700, marginBottom: 10, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Orb state</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['idle','listening','speaking','interrupted'].map(s => (
                  <button key={s} onClick={() => updateTweak('orbDemo', s)} style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, fontFamily: 'Poppins', transition: 'all .2s',
                    background: tweaks.orbDemo === s ? '#D85A30' : '#FAECE7',
                    color: tweaks.orbDemo === s ? 'white' : '#D85A30',
                  }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* animations toggle */}
          <div>
            <div style={{ fontSize: 11, color: '#993C1D', fontWeight: 700, marginBottom: 10, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Animations</div>
            <button onClick={() => updateTweak('animationsOn', !tweaks.animationsOn)} style={{
              padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'Poppins',
              background: tweaks.animationsOn ? '#E0F5EE' : '#FAECE7',
              color: tweaks.animationsOn ? '#1D9E75' : '#D85A30',
              transition: 'all .2s', width: '100%', textAlign: 'left',
            }}>
              {tweaks.animationsOn ? '✓ Animations on' : '✗ Animations off'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
