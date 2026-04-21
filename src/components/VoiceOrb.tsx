'use client';

type OrbState = 'idle' | 'listening' | 'speaking' | 'interrupted';

const MicSVG = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="8.5" y="2" width="7" height="12" rx="3.5" fill="white" />
    <path d="M5 11c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const EarSVG = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" fill="white" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="white" strokeWidth="2" opacity="0.6" />
    <circle cx="12" cy="12" r="9" fill="none" stroke="white" strokeWidth="1.5" opacity="0.3" />
  </svg>
);

const CFG: Record<OrbState, {
  ring: string; ring2: string; grad: string; shadow: string;
  ringAnim: string; ring2Anim: string; orbAnim: string;
}> = {
  idle: {
    ring: 'rgba(216,90,48,0.15)',
    ring2: 'rgba(216,90,48,0.08)',
    grad: 'linear-gradient(140deg, #D85A30 0%, #EF9F27 100%)',
    shadow: '0 12px 60px rgba(216,90,48,0.30)',
    ringAnim: 'pulse-ring 3.2s ease-out infinite',
    ring2Anim: 'pulse-ring 3.2s ease-out 0.6s infinite',
    orbAnim: 'orb-breathe 3.5s ease-in-out infinite',
  },
  listening: {
    ring: 'rgba(29,158,117,0.25)',
    ring2: 'rgba(29,158,117,0.12)',
    grad: 'linear-gradient(140deg, #1D9E75 0%, #7F77DD 100%)',
    shadow: '0 12px 60px rgba(29,158,117,0.35)',
    ringAnim: 'teal-ring 1.5s ease-out infinite',
    ring2Anim: 'teal-ring 1.5s ease-out 0.5s infinite',
    orbAnim: 'orb-breathe 1.6s ease-in-out infinite',
  },
  speaking: {
    ring: 'rgba(216,90,48,0.22)',
    ring2: 'rgba(239,159,39,0.12)',
    grad: 'linear-gradient(140deg, #D85A30 0%, #EF9F27 100%)',
    shadow: '0 12px 60px rgba(216,90,48,0.40)',
    ringAnim: 'pulse-ring 1.8s ease-out infinite',
    ring2Anim: 'pulse-ring 1.8s ease-out 0.4s infinite',
    orbAnim: 'orb-speak 1.5s ease-in-out infinite',
  },
  interrupted: {
    ring: 'rgba(239,159,39,0.28)',
    ring2: 'rgba(212,83,126,0.14)',
    grad: 'linear-gradient(140deg, #EF9F27 0%, #D4537E 100%)',
    shadow: '0 12px 60px rgba(239,159,39,0.38)',
    ringAnim: 'amber-flash 0.55s ease-in-out infinite',
    ring2Anim: 'amber-flash 0.55s ease-in-out 0.15s infinite',
    orbAnim: 'amber-flash 0.55s ease-in-out infinite',
  },
};

export default function VoiceOrb({ state = 'idle', size = 'lg' }: { state?: OrbState; size?: 'lg' | 'md' | 'sm' }) {
  const isLg = size !== 'sm';
  const orbPx = size === 'lg' ? 176 : size === 'md' ? 120 : 72;
  const c = CFG[state];
  const wrap = orbPx * 2.9;

  return (
    <div style={{ position: 'relative', width: wrap, height: wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{
        position: 'absolute',
        width: orbPx * 1.82, height: orbPx * 1.82,
        borderRadius: '50%',
        background: c.ring2,
        animation: c.ring2Anim,
        transition: 'background 0.7s ease',
      }} />
      <div style={{
        position: 'absolute',
        width: orbPx * 1.36, height: orbPx * 1.36,
        borderRadius: '50%',
        background: c.ring,
        animation: c.ringAnim,
        transition: 'background 0.7s ease',
      }} />
      <div style={{
        position: 'absolute',
        width: orbPx, height: orbPx,
        borderRadius: '50%',
        background: c.grad,
        boxShadow: c.shadow,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: c.orbAnim,
        transition: 'background 0.6s ease, box-shadow 0.6s ease',
      }}>
        {state === 'speaking' && isLg ? (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', height: 44 }}>
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="eq-bar" />)}
          </div>
        ) : state === 'listening' ? (
          <EarSVG size={isLg ? 38 : 18} />
        ) : (
          <MicSVG size={isLg ? 38 : 18} />
        )}
      </div>
    </div>
  );
}
