'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VoiceOrb from '@/components/VoiceOrb';
import { AudioQueue } from '@/lib/audioQueue';
import { GoogleGenAI, Modality } from '@google/genai';

type Phase = 'picking' | 'connecting' | 'active' | 'saving';
type OrbState = 'idle' | 'listening' | 'speaking' | 'interrupted';
type Entry = { role: 'user' | 'ai'; text: string };
type Difficulty = 'Easy' | 'Medium' | 'Hard';

// ─── Exam levels ──────────────────────────────────────────────────────────────
const LEVELS = [
  { id: 'class10',      label: 'Class 10',    emoji: '📘', color: '#D85A30', bg: '#FAECE7' },
  { id: 'intermediate', label: 'Intermediate', emoji: '📗', color: '#1D9E75', bg: '#E0F5EE' },
  { id: 'jee',          label: 'JEE',          emoji: '⚙️', color: '#7F77DD', bg: '#EEEDFE' },
  { id: 'neet',         label: 'NEET',         emoji: '🔬', color: '#C47A14', bg: '#FEF3E2' },
  { id: 'upsc',         label: 'UPSC',         emoji: '🏛️', color: '#6B5DB0', bg: '#F0EDF9' },
];

// ─── Subjects per level ───────────────────────────────────────────────────────
const LEVEL_SUBJECTS: Record<string, { name: string; bg: string; color: string }[]> = {
  class10: [
    { name: 'Math',           bg: '#FAECE7', color: '#D85A30' },
    { name: 'Science',        bg: '#E0F5EE', color: '#1D9E75' },
    { name: 'English',        bg: '#FCE9EF', color: '#D4537E' },
    { name: 'Social Studies', bg: '#F0EDF9', color: '#6B5DB0' },
    { name: 'Hindi',          bg: '#FEF3E2', color: '#C47A14' },
  ],
  intermediate: [
    { name: 'Math',      bg: '#FAECE7', color: '#D85A30' },
    { name: 'Physics',   bg: '#E0F5EE', color: '#1D9E75' },
    { name: 'Chemistry', bg: '#EEEDFE', color: '#7F77DD' },
    { name: 'Biology',   bg: '#FEF3E2', color: '#C47A14' },
    { name: 'English',   bg: '#FCE9EF', color: '#D4537E' },
  ],
  jee: [
    { name: 'Math',      bg: '#FAECE7', color: '#D85A30' },
    { name: 'Physics',   bg: '#E0F5EE', color: '#1D9E75' },
    { name: 'Chemistry', bg: '#EEEDFE', color: '#7F77DD' },
  ],
  neet: [
    { name: 'Physics',   bg: '#E0F5EE', color: '#1D9E75' },
    { name: 'Chemistry', bg: '#EEEDFE', color: '#7F77DD' },
    { name: 'Biology',   bg: '#FEF3E2', color: '#C47A14' },
  ],
  upsc: [
    { name: 'History',              bg: '#F0EDF9', color: '#6B5DB0' },
    { name: 'Geography',            bg: '#E0F5EE', color: '#1D9E75' },
    { name: 'Polity',               bg: '#FAECE7', color: '#D85A30' },
    { name: 'Economics',            bg: '#FEF3E2', color: '#C47A14' },
    { name: 'Science & Technology', bg: '#EEEDFE', color: '#7F77DD' },
  ],
};

const DIFFICULTIES: { label: Difficulty; color: string; bg: string; desc: string }[] = [
  { label: 'Easy',   color: '#1D9E75', bg: '#E0F5EE', desc: 'Basics & intuition' },
  { label: 'Medium', color: '#C47A14', bg: '#FEF3E2', desc: 'Concept + application' },
  { label: 'Hard',   color: '#D4537E', bg: '#FCE9EF', desc: 'Deep reasoning & edge cases' },
];

const STATUS_LABEL: Record<OrbState, string> = {
  idle: 'Starting…',
  listening: 'Listening to you…',
  speaking: 'TutorTalk is speaking…',
  interrupted: 'Just a moment…',
};

// ArrayBuffer (Int16) → base64 string
function ab2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// base64 PCM16 at 24kHz → AudioBuffer
function b64ToAudioBuffer(b64: string, ctx: AudioContext): AudioBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
  const buf = ctx.createBuffer(1, f32.length, 24000);
  buf.copyToChannel(f32, 0);
  return buf;
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function buildSystemInstruction(level: string, subject: string, topic: string, difficulty: Difficulty): string {
  const levelMeta = LEVELS.find(l => l.id === level);
  const levelLabel = levelMeta?.label ?? level;

  return `You are TutorTalk, a warm, expert academic tutor helping a ${levelLabel} student with ${subject}.
${topic ? `The student has chosen to study: "${topic}".` : ''}
Difficulty level: ${difficulty}.

${topic ? `OPENING GREETING — do this immediately when the session starts:
1. Greet the student warmly by name if known, otherwise just warmly.
2. Confirm the topic they picked: "${topic}".
3. Share a friendly roadmap — identify the key topics and subtopics of "${topic}" at ${levelLabel} level, and mention them naturally: "Here's what we'll explore together: ..."
4. End with: "Where would you like to start — or is there something specific on your mind?"

` : ''}EXPLANATION STYLE — when a student asks you to explain any topic or subtopic:
1. Give a clear, friendly summary first (2–4 sentences max). Do NOT dump everything at once.
2. Then ask: "Want me to go deeper into this? Or shall we move on to the next key topic? Or do you have something specific in mind?"
3. If they want more depth — go deeper with examples, analogies, and step-by-step breakdowns.
4. After covering a subtopic fully, bridge naturally to the next: "Great! Ready to move on to [next subtopic]?"

TEACHING APPROACH:

1. LEVEL ADAPTATION — ${levelLabel}
${level === 'class10' ? `   - Use simple, everyday language. Avoid heavy formulas unless needed. Use real-life examples.` :
  level === 'intermediate' ? `   - Focus on concept clarity. Introduce formulas and derivations step by step. Encourage structured thinking.` :
  level === 'jee' ? `   - Go deep on concepts. Include problem-solving strategies, shortcuts, and JEE-style application. Ask multi-step reasoning questions.` :
  level === 'neet' ? `   - Emphasize biology, chemistry, and physics at NEET level. Use diagrams described in words. Focus on accuracy and MCQ-style reasoning.` :
  `   - Cover UPSC-relevant depth. Connect facts to analysis. Link topics to current affairs and exam relevance.`}

2. PROBLEM SOLVING (Math / Physics / Chemistry)
   - Break problems into steps. Ask the student to attempt each step.
   - Give hints before full solutions. After solving, explain WHY the method works.
   - For ${difficulty === 'Hard' ? 'Hard difficulty: push multi-step problems, edge cases, and exam-level traps.' :
           difficulty === 'Medium' ? 'Medium difficulty: mix concept with application problems.' :
           'Easy difficulty: focus on basics, build intuition before formulas.'}

3. STUDENT QUESTIONS
   - When the student asks a question, answer it fully and clearly.
   - Never cut an answer short. A complete explanation beats a brief one every time.
   - If the student seems stuck or confused, rephrase using an analogy or a simpler breakdown.

4. REINFORCEMENT
   - Occasionally summarize key points after a topic is covered.
   - Offer a short practice question when appropriate.
   - Connect new concepts to ones the student has already learned.
   - Be warm, encouraging, and celebrate correct reasoning.

Speak naturally and conversationally — you are a knowledgeable friend helping the student truly understand, not just memorize. Keep responses concise; invite the student to steer the depth rather than lecturing all at once.

IMPORTANT: Begin the session IMMEDIATELY by greeting the student warmly as described above. Do not wait for the student to speak first — start talking right away.`;
}

export default function SessionPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('picking');
  const [level, setLevel] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcript, setTranscript] = useState<Entry[]>([]);
  const [liveCaption, setLiveCaption] = useState<{ role: 'user' | 'ai'; text: string } | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Reset subject when level changes
  useEffect(() => { setSubject(null); }, [level]);

  const sessionRef = useRef<any>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const queueRef = useRef<AudioQueue | null>(null);
  const startedAtRef = useRef<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<Entry[]>([]);
  const intentionalCloseRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const aiBufferRef = useRef('');

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);
  useEffect(() => {
    if (phase === 'active') {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      return () => clearInterval(timerRef.current!);
    }
  }, [phase]);
  useEffect(() => () => cleanup(), []);

  function cleanup() {
    intentionalCloseRef.current = true;
    sessionRef.current?.close?.();
    sessionRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    inputCtxRef.current?.close().catch(() => {});
    outputCtxRef.current?.close().catch(() => {});
    queueRef.current?.flush();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function handleStartSession() {
    if (!subject || !level) return;
    setPhase('connecting');
    setError(null);
    intentionalCloseRef.current = false;

    try {
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      queueRef.current = new AudioQueue(outputCtx);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      await inputCtx.audioWorklet.addModule('/worklets/capture-processor.js');

      const tokenRes = await fetch('/api/token', { method: 'POST' });
      if (!tokenRes.ok) throw new Error('Could not get session token — are you signed in?');
      const { token } = await tokenRes.json();

      const ai = new GoogleGenAI({ apiKey: token });
      const systemText = buildSystemInstruction(level, subject, topic.trim(), difficulty);

      const session = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        callbacks: {
          onopen: () => {
            startedAtRef.current = new Date();
            setPhase('active');
            setOrbState('listening');
            wireMic(inputCtx, stream);
          },
          onmessage: (msg: any) => {
            const sc = msg.serverContent;

            if (sc?.interrupted) {
              queueRef.current?.flush();
              aiBufferRef.current = '';
              setLiveCaption(null);
              setOrbState('interrupted');
              setTimeout(() => setOrbState('listening'), 600);
              return;
            }

            // User speech — add to transcript
            if (sc?.inputTranscription?.text?.trim()) {
              const t = sc.inputTranscription.text.trim();
              setTranscript(prev => [...prev, { role: 'user', text: t }]);
              setLiveCaption({ role: 'user', text: t });
            }

            // AI speech — accumulate BEFORE turnComplete so final chunk isn't lost
            if (sc?.outputTranscription?.text?.trim()) {
              const chunk = sc.outputTranscription.text.trim();
              aiBufferRef.current += (aiBufferRef.current ? ' ' : '') + chunk;
              setLiveCaption({ role: 'ai', text: aiBufferRef.current });
            }

            // Audio parts
            const parts: any[] = sc?.modelTurn?.parts ?? [];
            let hasAudio = false;
            for (const part of parts) {
              if (part.inlineData?.data && outputCtxRef.current) {
                queueRef.current?.push(b64ToAudioBuffer(part.inlineData.data, outputCtxRef.current));
                hasAudio = true;
              }
              const partText = part.text?.trim();
              if (partText && !sc?.outputTranscription?.text) {
                aiBufferRef.current += (aiBufferRef.current ? ' ' : '') + partText;
                setLiveCaption({ role: 'ai', text: aiBufferRef.current });
              }
            }
            if (hasAudio) setOrbState('speaking');

            // Commit AFTER all content in this message has been processed
            if (sc?.turnComplete) {
              setOrbState('listening');
              const aiText = aiBufferRef.current.trim();
              if (aiText) {
                setTranscript(prev => [...prev, { role: 'ai', text: aiText }]);
                aiBufferRef.current = '';
              }
              setLiveCaption(null);
            }
          },
          onclose: () => {
            if (!intentionalCloseRef.current) {
              setError('Session disconnected. Please try again.');
              setPhase('picking');
            }
          },
          onerror: () => setError('Connection error — check your connection and try again.'),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          tools: [{ googleSearch: {} }],
          systemInstruction: { parts: [{ text: systemText }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      } as any);

      sessionRef.current = session;

      const levelLabel = LEVELS.find(l => l.id === level)?.label ?? level;
      const topicLine = topic.trim() ? ` on the topic "${topic.trim()}"` : '';
      session.sendRealtimeInput({
        text: topic.trim()
          ? `Greet the student warmly. Tell them you're their ${levelLabel} ${subject} tutor. Confirm their chosen topic: "${topic.trim()}". Then identify the key topics and subtopics of "${topic.trim()}" at ${levelLabel} level and share them as a friendly roadmap — say something like "Here's what we'll explore together:" and list them naturally. End by asking where they'd like to start or if they have something specific in mind. Difficulty is set to ${difficulty}.`
          : `Greet the student warmly. Let them know you're their ${levelLabel} ${subject} tutor. Tell them the difficulty is set to ${difficulty}. Ask them what topic or concept they'd like to explore today.`,
      });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setPhase('picking');
      cleanup();
    }
  }

  function wireMic(ctx: AudioContext, stream: MediaStream) {
    const worklet = new AudioWorkletNode(ctx, 'capture-processor');
    const source = ctx.createMediaStreamSource(stream);
    source.connect(worklet);
    const silent = ctx.createGain();
    silent.gain.value = 0;
    worklet.connect(silent);
    silent.connect(ctx.destination);
    worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (!sessionRef.current) return;
      sessionRef.current.sendRealtimeInput({
        audio: { data: ab2b64(e.data), mimeType: 'audio/pcm;rate=16000' },
      });
    };
  }

  async function handleEndSession() {
    setPhase('saving');
    cleanup();
    try {
      const saveRes = await fetch('/api/session/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `${subject}${topic.trim() ? ` — ${topic.trim()}` : ''}`,
          transcript: transcriptRef.current,
          durationSecs: duration,
          startedAt: startedAtRef.current.toISOString(),
        }),
      });
      if (!saveRes.ok) console.error('Session save failed');
    } catch { /* navigate anyway */ }
    router.push('/dashboard');
  }

  const currentSubjects = level ? LEVEL_SUBJECTS[level] : [];
  const subjectMeta = currentSubjects.find(s => s.name === subject);
  const levelMeta = LEVELS.find(l => l.id === level);
  const canStart = !!level && !!subject;

  // ─── Picker ────────────────────────────────────────────────────────────────
  if (phase === 'picking') {
    return (
      <div className="page-in" style={{ minHeight: '100vh', background: '#FFFBF7', overflowY: 'auto' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 64px' }}>
          <Link href="/dashboard" style={{ color: '#993C1D', textDecoration: 'none', fontSize: 14, fontWeight: 600, display: 'inline-block', marginBottom: 32 }}>
            ← Dashboard
          </Link>

          <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, color: '#4A1B0C', fontFamily: 'var(--font-poppins)', marginBottom: 6 }}>
            Set up your session
          </h1>
          <p style={{ color: '#993C1D', fontSize: 15, marginBottom: 36, opacity: 0.8 }}>
            Choose your study level, subject, and difficulty to get a personalised tutor.
          </p>

          {/* ── Step 1: Exam Level ── */}
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#993C1D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              1 · Study Level
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {LEVELS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  style={{
                    padding: '10px 20px', borderRadius: 999, cursor: 'pointer',
                    border: `2px solid ${level === l.id ? l.color : 'transparent'}`,
                    background: level === l.id ? l.bg : '#FFF3EC',
                    color: l.color, fontWeight: 700, fontSize: 14,
                    transition: 'all 0.15s', transform: level === l.id ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: level === l.id ? `0 4px 16px ${l.color}30` : 'none',
                  }}
                >
                  {l.emoji} {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Step 2: Subject ── */}
          {level && (
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#993C1D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                2 · Subject
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {currentSubjects.map(s => (
                  <button
                    key={s.name}
                    onClick={() => setSubject(s.name)}
                    style={{
                      padding: '10px 22px', borderRadius: 999, cursor: 'pointer',
                      border: `2px solid ${subject === s.name ? s.color : 'transparent'}`,
                      background: subject === s.name ? s.bg : '#FFF3EC',
                      color: s.color, fontWeight: 700, fontSize: 14,
                      transition: 'all 0.15s', transform: subject === s.name ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: subject === s.name ? `0 4px 16px ${s.color}30` : 'none',
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Topic (optional) ── */}
          {subject && (
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#993C1D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                3 · Topic <span style={{ fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>(optional)</span>
              </p>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={`e.g. ${level === 'jee' ? 'Rotational Motion, Organic Chemistry' : level === 'neet' ? 'Cell Division, Thermodynamics' : level === 'upsc' ? 'Federalism, Water Bodies' : 'Quadratic Equations, Newton\'s Laws'}`}
                style={{
                  width: '100%', padding: '14px 18px', borderRadius: 14, fontSize: 15,
                  border: '2px solid #F2E4DB', background: '#FFF8F3', color: '#4A1B0C',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#D85A30')}
                onBlur={e => (e.target.style.borderColor = '#F2E4DB')}
              />
            </div>
          )}

          {/* ── Step 4: Difficulty ── */}
          {subject && (
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#993C1D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                4 · Difficulty
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.label}
                    onClick={() => setDifficulty(d.label)}
                    style={{
                      padding: '10px 22px', borderRadius: 999, cursor: 'pointer',
                      border: `2px solid ${difficulty === d.label ? d.color : 'transparent'}`,
                      background: difficulty === d.label ? d.bg : '#FFF3EC',
                      color: d.color, fontWeight: 700, fontSize: 14,
                      transition: 'all 0.15s', transform: difficulty === d.label ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: difficulty === d.label ? `0 4px 16px ${d.color}30` : 'none',
                    }}
                  >
                    {d.label}
                    <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 6, opacity: 0.75 }}>· {d.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p style={{ color: '#D4537E', marginBottom: 16, fontSize: 14 }}>{error}</p>
          )}

          <button
            onClick={handleStartSession}
            disabled={!canStart}
            className="cta-btn"
            style={{ fontSize: 16, padding: '14px 48px', opacity: canStart ? 1 : 0.4, cursor: canStart ? 'pointer' : 'not-allowed' }}
          >
            Start Session →
          </button>
        </div>
      </div>
    );
  }

  // ─── Connecting ────────────────────────────────────────────────────────────
  if (phase === 'connecting') {
    return (
      <div style={{ minHeight: '100vh', background: '#FFFBF7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <VoiceOrb state="idle" size="lg" />
        <p style={{ color: '#993C1D', fontSize: 16, fontWeight: 600 }}>Connecting to your tutor…</p>
      </div>
    );
  }

  // ─── Saving ────────────────────────────────────────────────────────────────
  if (phase === 'saving') {
    return (
      <div style={{ minHeight: '100vh', background: '#FFFBF7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ color: '#993C1D', fontSize: 16, fontWeight: 600 }}>Saving your session…</p>
      </div>
    );
  }

  // ─── Active session ────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', background: '#FFFBF7', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top bar */}
      <div className="tt-session-topbar" style={{ borderBottom: '1px solid #F2E4DB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1776668144/logotutortalk_ecmdbm.png"
            alt="TutorTalk" style={{ width: 34, height: 34, objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {levelMeta && (
              <span style={{ fontSize: 11, fontWeight: 700, color: levelMeta.color, lineHeight: 1 }}>
                {levelMeta.emoji} {levelMeta.label}
              </span>
            )}
            {subjectMeta && (
              <span style={{ padding: '2px 12px', borderRadius: 999, background: subjectMeta.bg, color: subjectMeta.color, fontSize: 12, fontWeight: 700, display: 'inline-block' }}>
                {subject}{topic.trim() ? ` · ${topic.trim()}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="tt-session-topbar-right">
          <span style={{ fontSize: 11, fontWeight: 700, color: '#993C1D', opacity: 0.5 }}>{difficulty}</span>
          <span style={{ fontSize: 'clamp(15px, 2.5vw, 20px)', fontWeight: 800, color: '#4A1B0C', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px' }}>
            {fmtTime(duration)}
          </span>
          <button
            onClick={handleEndSession}
            style={{ padding: '8px 20px', borderRadius: 999, background: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}
          >
            End Session
          </button>
        </div>
      </div>

      {/* ── Orb + Transcript (vertical) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>

        {/* Orb section */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, width: '100%' }}>
          <VoiceOrb state={orbState} size="md" />

          <p style={{
            marginTop: -60, position: 'relative', zIndex: 1,
            fontWeight: 600, fontSize: 14,
            color: orbState === 'listening' ? '#1D9E75' : orbState === 'speaking' ? '#D85A30' : orbState === 'interrupted' ? '#EF9F27' : '#993C1D',
            transition: 'color 0.3s ease',
          }}>
            {STATUS_LABEL[orbState]}
          </p>

        </div>

        <style>{`
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes transcriptGlow {
            0%,100% { box-shadow: 0 0 0px 0px #D85A3000, inset 0 0 0px 0px #D85A3000; border-color: #F2E4DB; }
            50%      { box-shadow: 0 0 20px 5px #D85A3035, inset 0 0 10px 0px #EF9F2712; border-color: #D85A3070; }
          }
        `}</style>

        {/* Transcript — glowing box */}
        <div style={{
          flex: 1, minHeight: 0, width: '100%', maxWidth: 680,
          display: 'flex', flexDirection: 'column',
          margin: '8px 0 16px',
          padding: '0 16px',
          boxSizing: 'border-box',
        }}>
          <div style={{
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
            border: '1.5px solid #F2E4DB',
            borderRadius: 20,
            background: '#FFF8F3',
            overflow: 'hidden',
            animation: 'transcriptGlow 2.5s ease-in-out infinite',
          }}>

            {/* Divider shown once messages arrive */}
            {(transcript.length > 0 || liveCaption) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px 6px', flexShrink: 0 }}>
                <div style={{ flex: 1, height: 1, background: '#F2E4DB' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#C4A99A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Conversation
                </span>
                <div style={{ flex: 1, height: 1, background: '#F2E4DB' }} />
              </div>
            )}

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {transcript.length === 0 && (
                <p style={{ textAlign: 'center', color: '#C4A99A', fontSize: 14, marginTop: 20 }}>
                  Your conversation will appear here…
                </p>
              )}
              {transcript.map((entry, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: entry.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 15px', borderRadius: 18,
                    background: entry.role === 'user' ? '#EEEDFE' : '#FFF3EC',
                    color: entry.role === 'user' ? '#26215C' : '#4A1B0C',
                    fontSize: 14, lineHeight: 1.6, fontWeight: 500,
                    borderBottomRightRadius: entry.role === 'user' ? 4 : 18,
                    borderBottomLeftRadius: entry.role === 'ai' ? 4 : 18,
                  }}>
                    {entry.role === 'ai' && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#D85A30', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        TutorTalk
                      </span>
                    )}
                    {entry.text}
                  </div>
                </div>
              ))}
              {/* Live caption — streaming bubble inside the box */}
              {liveCaption && (
                <div style={{ display: 'flex', justifyContent: liveCaption.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 15px', borderRadius: 18,
                    background: liveCaption.role === 'ai' ? '#FFF3EC' : '#EEEDFE',
                    color: liveCaption.role === 'ai' ? '#4A1B0C' : '#26215C',
                    fontSize: 14, lineHeight: 1.6, fontWeight: 500,
                    borderBottomRightRadius: liveCaption.role === 'user' ? 4 : 18,
                    borderBottomLeftRadius: liveCaption.role === 'ai' ? 4 : 18,
                    opacity: 0.85,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', color: liveCaption.role === 'ai' ? '#D85A30' : '#7F77DD' }}>
                      {liveCaption.role === 'ai' ? 'TutorTalk' : 'You'}
                    </span>
                    {liveCaption.text}
                    <span style={{
                      display: 'inline-block', width: 2, height: '1em',
                      background: liveCaption.role === 'ai' ? '#D85A30' : '#7F77DD',
                      marginLeft: 2, verticalAlign: 'text-bottom',
                      animation: 'blink 1s step-end infinite',
                    }} />
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
