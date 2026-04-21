'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VoiceOrb from '@/components/VoiceOrb';
import { AudioQueue } from '@/lib/audioQueue';
import { GoogleGenAI, Modality } from '@google/genai';

type Phase = 'picking' | 'connecting' | 'active' | 'saving' | 'results';
type OrbState = 'idle' | 'listening' | 'speaking' | 'interrupted';
type Entry = { role: 'user' | 'ai'; text: string };

const EXAM_LEVELS = [
  { id: 'class10',      label: 'Class 10',    emoji: '📘', color: '#3B5BDB', bg: '#EDF2FF' },
  { id: 'intermediate', label: 'Intermediate', emoji: '📗', color: '#4C6EF5', bg: '#E0E7FF' },
];

const EXAM_SUBJECTS: Record<string, { name: string; bg: string; color: string }[]> = {
  class10: [
    { name: 'Mathematics',    bg: '#EDF2FF', color: '#3B5BDB' },
    { name: 'Science',        bg: '#E0E7FF', color: '#4C6EF5' },
    { name: 'English',        bg: '#EEF2FF', color: '#6366F1' },
    { name: 'Social Studies', bg: '#E0E7FF', color: '#4C6EF5' },
  ],
  intermediate: [
    { name: 'Mathematics', bg: '#EDF2FF', color: '#3B5BDB' },
    { name: 'Physics',     bg: '#E0E7FF', color: '#4C6EF5' },
    { name: 'Chemistry',   bg: '#EEF2FF', color: '#6366F1' },
    { name: 'Biology',     bg: '#EDF2FF', color: '#3B5BDB' },
  ],
};

const QUESTION_COUNTS = [5, 10, 15];

const STATUS_LABEL: Record<OrbState, string> = {
  idle: 'Starting exam…',
  listening: 'Listening for your answer…',
  speaking: 'Exam AI is speaking…',
  interrupted: 'Just a moment…',
};

function ab2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

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

function parseConfirmedAnswer(text: string): number | null {
  const patterns = [
    /You selected Option\s+(\d)/i,
    /You have selected Option\s+(\d)/i,
    /You chose Option\s+(\d)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function buildExamSystemInstruction(level: string, subject: string, n: number): string {
  const levelLabel = EXAM_LEVELS.find(l => l.id === level)?.label ?? level;
  return `You are an AI Exam Conductor for ${levelLabel} students.
Your role: conduct a structured multiple-choice ${subject} exam with exactly ${n} questions, one at a time.

Rules:
1. Number each question: "Question 1 of ${n}", "Question 2 of ${n}", and so on.
2. Present exactly 4 options clearly labeled: Option 1, Option 2, Option 3, Option 4.
3. After each question ask: "Please say your answer — Option 1, 2, 3, or 4."
4. Accept answers in any of these forms: "Option 2", "Two", "B", "Second option".
5. Before evaluating, confirm with EXACT phrase: "You selected Option X." (X is the number, period at end).
6. This is Test Mode: do NOT reveal whether the answer is correct or incorrect.
7. Say "Moving to the next question." and proceed immediately.
8. After all ${n} questions, say exactly: "Exam complete! You answered all ${n} questions. Well done for finishing the exam!"
9. Be calm, clear, and professionally neutral in tone throughout.
10. Begin IMMEDIATELY — greet the student warmly in one sentence then start Question 1 without waiting.

IMPORTANT: The phrase "You selected Option X." with a period is critical — use it every single time you confirm an answer.`;
}

export default function ExamPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('picking');
  const [level, setLevel] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcript, setTranscript] = useState<Entry[]>([]);
  const [liveCaption, setLiveCaption] = useState<{ role: 'user' | 'ai'; text: string } | null>(null);
  const [duration, setDuration] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
  const answeredCountRef = useRef(0);
  const durationRef = useRef(0);
  const examDoneRef = useRef(false);
  const subjectRef = useRef<string | null>(null);
  const levelRef = useRef<string | null>(null);
  const questionCountRef = useRef(10);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);
  useEffect(() => { subjectRef.current = subject; }, [subject]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { questionCountRef.current = questionCount; }, [questionCount]);
  useEffect(() => {
    if (phase === 'active') {
      timerRef.current = setInterval(() => {
        setDuration(d => { durationRef.current = d + 1; return d + 1; });
      }, 1000);
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

  async function handleExamComplete() {
    if (examDoneRef.current) return;
    examDoneRef.current = true;
    cleanup();
    setPhase('saving');

    try {
      const subj = subjectRef.current ?? '';
      const lvl = levelRef.current ?? '';
      const levelLabel = EXAM_LEVELS.find(l => l.id === lvl)?.label ?? lvl;
      await fetch('/api/session/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `${subj} — ${levelLabel}`,
          transcript: transcriptRef.current,
          durationSecs: durationRef.current,
          startedAt: startedAtRef.current.toISOString(),
          type: 'exam',
          score: JSON.stringify({ answered: answeredCountRef.current, total: questionCountRef.current }),
        }),
      });
    } catch { /* navigate anyway */ }

    setPhase('results');
  }

  async function handleEndExam() {
    if (examDoneRef.current) return;
    examDoneRef.current = true;
    cleanup();
    setPhase('saving');

    try {
      const subj = subjectRef.current ?? '';
      const lvl = levelRef.current ?? '';
      const levelLabel = EXAM_LEVELS.find(l => l.id === lvl)?.label ?? lvl;
      await fetch('/api/session/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `${subj} — ${levelLabel}`,
          transcript: transcriptRef.current,
          durationSecs: durationRef.current,
          startedAt: startedAtRef.current.toISOString(),
          type: 'exam',
          score: JSON.stringify({ answered: answeredCountRef.current, total: questionCountRef.current }),
        }),
      });
    } catch { /* navigate anyway */ }

    setPhase('results');
  }

  async function handleStartExam() {
    if (!subject || !level) return;
    setPhase('connecting');
    setError(null);
    intentionalCloseRef.current = false;
    examDoneRef.current = false;
    answeredCountRef.current = 0;
    setAnsweredCount(0);

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
      const systemText = buildExamSystemInstruction(level, subject, questionCount);

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

            if (sc?.inputTranscription?.text?.trim()) {
              const t = sc.inputTranscription.text.trim();
              setTranscript(prev => [...prev, { role: 'user', text: t }]);
              setLiveCaption({ role: 'user', text: t });
            }

            if (sc?.outputTranscription?.text?.trim()) {
              const chunk = sc.outputTranscription.text.trim();
              aiBufferRef.current += (aiBufferRef.current ? ' ' : '') + chunk;
              setLiveCaption({ role: 'ai', text: aiBufferRef.current });
            }

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

            if (sc?.turnComplete) {
              setOrbState('listening');
              const aiText = aiBufferRef.current.trim();
              if (aiText) {
                setTranscript(prev => [...prev, { role: 'ai', text: aiText }]);

                // Track confirmed answers
                if (parseConfirmedAnswer(aiText) !== null) {
                  answeredCountRef.current += 1;
                  setAnsweredCount(answeredCountRef.current);
                }

                // Detect exam completion
                if (aiText.includes('Exam complete! You answered all')) {
                  setTimeout(() => handleExamComplete(), 400);
                }

                aiBufferRef.current = '';
              }
              setLiveCaption(null);
            }
          },
          onclose: () => {
            if (!intentionalCloseRef.current) {
              setError('Exam disconnected. Please try again.');
              setPhase('picking');
            }
          },
          onerror: () => setError('Connection error — check your connection and try again.'),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          tools: [{ googleSearch: {} }],
          systemInstruction: { parts: [{ text: systemText }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      } as any);

      sessionRef.current = session;

      const levelLabel = EXAM_LEVELS.find(l => l.id === level)?.label ?? level;
      session.sendRealtimeInput({
        text: `Welcome the student warmly in one sentence, then immediately begin Question 1 of ${questionCount} — a ${subject} MCQ for ${levelLabel} students. Present 4 options labeled Option 1, Option 2, Option 3, Option 4.`,
      });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start exam');
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

  const currentSubjects = level ? EXAM_SUBJECTS[level] : [];
  const levelMeta = EXAM_LEVELS.find(l => l.id === level);

  // ─── Results ────────────────────────────────────────────────────────────────
  if (phase === 'results') {
    const lvl = levelRef.current ?? level ?? '';
    const lvlLabel = EXAM_LEVELS.find(l => l.id === lvl)?.label ?? lvl;
    const subj = subjectRef.current ?? subject ?? '';
    const mins = Math.floor(durationRef.current / 60);
    const secs = durationRef.current % 60;
    const answered = answeredCountRef.current;
    const total = questionCountRef.current;

    return (
      <>
        <style>{`
          @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes gradFlow { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
          .exam-results-card { animation: fadeUp .6s ease backwards; }
        `}</style>
        <div style={{ minHeight: '100vh', background: '#EDF2FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div className="exam-results-card" style={{
            background: '#FFFFFF', borderRadius: 28,
            padding: 'clamp(36px,5vw,56px) clamp(28px,5vw,52px)',
            maxWidth: 480, width: '100%',
            boxShadow: '0 8px 48px rgba(59,91,219,0.15)',
            border: '1.5px solid rgba(76,110,245,0.18)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎓</div>
            <h1 style={{ fontSize: 'clamp(22px,5vw,30px)', fontWeight: 800, color: '#1E3A8A', fontFamily: 'var(--font-poppins)', marginBottom: 8, letterSpacing: '-0.5px' }}>
              Exam Complete!
            </h1>
            <p style={{ color: '#4C6EF5', fontSize: 14, opacity: 0.8, marginBottom: 36 }}>
              {lvlLabel} · {subj}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 36 }}>
              <div style={{ background: '#EDF2FF', borderRadius: 18, padding: '22px 16px' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#3B5BDB', fontFamily: 'var(--font-poppins)', letterSpacing: '-1px' }}>
                  {answered}
                </div>
                <div style={{ fontSize: 12, color: '#4C6EF5', fontWeight: 700, marginTop: 6, opacity: 0.8 }}>
                  of {total} answered
                </div>
              </div>
              <div style={{ background: '#EDF2FF', borderRadius: 18, padding: '22px 16px' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#3B5BDB', fontFamily: 'var(--font-poppins)', letterSpacing: '-1px' }}>
                  {mins}:{secs.toString().padStart(2, '0')}
                </div>
                <div style={{ fontSize: 12, color: '#4C6EF5', fontWeight: 700, marginTop: 6, opacity: 0.8 }}>
                  time taken
                </div>
              </div>
            </div>

            <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 32, lineHeight: 1.6 }}>
              Your exam transcript has been saved to your dashboard.
              Detailed score analysis is coming soon.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link href="/dashboard" style={{
                display: 'block', textDecoration: 'none', color: '#FFFBF7',
                padding: '14px 36px', borderRadius: 99, fontWeight: 700, fontSize: 15,
                fontFamily: 'var(--font-poppins)',
                background: 'linear-gradient(135deg, #3B5BDB, #4C6EF5)',
                boxShadow: '0 4px 20px rgba(59,91,219,0.3)',
              }}>
                Back to Dashboard →
              </Link>
              <button
                onClick={() => {
                  examDoneRef.current = false;
                  answeredCountRef.current = 0;
                  setAnsweredCount(0);
                  setDuration(0);
                  durationRef.current = 0;
                  setTranscript([]);
                  setPhase('picking');
                }}
                style={{
                  background: 'transparent', border: '1.5px solid rgba(59,91,219,0.25)',
                  color: '#3B5BDB', padding: '13px 36px', borderRadius: 99,
                  fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-poppins)',
                  cursor: 'pointer',
                }}
              >
                Take another exam
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Connecting ─────────────────────────────────────────────────────────────
  if (phase === 'connecting') {
    return (
      <div style={{ minHeight: '100vh', background: '#EDF2FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <VoiceOrb state="idle" size="lg" />
        <p style={{ color: '#3B5BDB', fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-poppins)' }}>
          Connecting to exam conductor…
        </p>
      </div>
    );
  }

  // ─── Saving ─────────────────────────────────────────────────────────────────
  if (phase === 'saving') {
    return (
      <div style={{ minHeight: '100vh', background: '#EDF2FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ color: '#3B5BDB', fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-poppins)' }}>
          Saving your exam…
        </p>
      </div>
    );
  }

  // ─── Active exam ─────────────────────────────────────────────────────────────
  if (phase === 'active') {
    const subjectMeta = currentSubjects.find(s => s.name === subject);
    return (
      <>
        <style>{`
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes transcriptGlowExam {
            0%,100% { box-shadow: 0 0 0px 0px rgba(59,91,219,0); border-color: #C7D2FE; }
            50%      { box-shadow: 0 0 20px 5px rgba(59,91,219,0.12); border-color: rgba(76,110,245,0.4); }
          }
          .exam-transcript-box { animation: transcriptGlowExam 3s ease-in-out infinite; }
          .exam-bubble-ai   { background: #EEF2FF; color: #1E3A8A; }
          .exam-bubble-user { background: #EEEDFE; color: #26215C; }
        `}</style>

        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#EDF2FF', overflow: 'hidden' }}>

          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
            background: 'rgba(237,242,255,0.92)', backdropFilter: 'blur(16px)',
            borderBottom: '1.5px solid rgba(59,91,219,0.12)', flexShrink: 0, flexWrap: 'wrap',
          }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginRight: 4 }}>
              <img src="https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1776668144/logotutortalk_ecmdbm.png"
                alt="TutorTalk" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            </Link>

            <div style={{
              background: levelMeta?.bg ?? '#EDF2FF', color: levelMeta?.color ?? '#3B5BDB',
              padding: '4px 12px', borderRadius: 99, fontWeight: 700, fontSize: 12,
              fontFamily: 'var(--font-poppins)', border: `1px solid ${levelMeta?.color ?? '#3B5BDB'}25`,
            }}>
              {levelMeta?.emoji} {levelMeta?.label}
            </div>

            <div style={{
              background: subjectMeta?.bg ?? '#EDF2FF', color: subjectMeta?.color ?? '#4C6EF5',
              padding: '4px 12px', borderRadius: 99, fontWeight: 700, fontSize: 12,
              fontFamily: 'var(--font-poppins)', border: `1px solid ${subjectMeta?.color ?? '#4C6EF5'}25`,
            }}>
              {subject}
            </div>

            {/* Question counter */}
            <div style={{
              background: '#3B5BDB', color: '#FFFFFF',
              padding: '4px 14px', borderRadius: 99, fontWeight: 700, fontSize: 12,
              fontFamily: 'var(--font-poppins)',
            }}>
              Q {answeredCount}/{questionCount}
            </div>

            <div style={{ flex: 1 }} />

            {/* Timer */}
            <div style={{
              fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: 14,
              color: '#1E3A8A', letterSpacing: '0.05em',
            }}>
              {fmtTime(duration)}
            </div>

            {/* End exam */}
            <button
              onClick={handleEndExam}
              style={{
                background: '#FEE2E2', color: '#DC2626', border: 'none',
                padding: '7px 16px', borderRadius: 99, fontWeight: 700, fontSize: 13,
                fontFamily: 'var(--font-poppins)', cursor: 'pointer',
              }}
            >
              End Exam
            </button>
          </div>

          {/* Orb section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 8px', flexShrink: 0 }}>
            <VoiceOrb state={orbState} size="md" />
            <p style={{ color: '#3B5BDB', fontSize: 13, fontWeight: 600, marginTop: 8, fontFamily: 'var(--font-poppins)' }}>
              {STATUS_LABEL[orbState]}
            </p>
          </div>

          {/* Transcript */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 16px 16px' }}>
            <div
              className="exam-transcript-box"
              style={{
                flex: 1, minHeight: 0, overflowY: 'auto',
                background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
                borderRadius: 18, border: '1.5px solid #C7D2FE',
                padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              {transcript.length === 0 && !liveCaption && (
                <div style={{ textAlign: 'center', color: '#6366F1', opacity: 0.45, fontSize: 14, marginTop: 24 }}>
                  Exam transcript will appear here…
                </div>
              )}

              {transcript.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: e.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '82%' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', opacity: 0.6, marginBottom: 3, textAlign: e.role === 'user' ? 'right' : 'left', letterSpacing: '0.06em' }}>
                      {e.role === 'user' ? 'YOU' : 'EXAM AI'}
                    </div>
                    <div
                      className={e.role === 'user' ? 'exam-bubble-user' : 'exam-bubble-ai'}
                      style={{ padding: '9px 14px', borderRadius: e.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 14, lineHeight: 1.55 }}
                    >
                      {e.text}
                    </div>
                  </div>
                </div>
              ))}

              {liveCaption && (
                <div style={{ display: 'flex', justifyContent: liveCaption.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '82%' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', opacity: 0.45, marginBottom: 3, textAlign: liveCaption.role === 'user' ? 'right' : 'left', letterSpacing: '0.06em' }}>
                      {liveCaption.role === 'user' ? 'YOU' : 'EXAM AI'}
                    </div>
                    <div
                      className={liveCaption.role === 'user' ? 'exam-bubble-user' : 'exam-bubble-ai'}
                      style={{ padding: '9px 14px', borderRadius: liveCaption.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 14, lineHeight: 1.55, opacity: 0.75 }}
                    >
                      {liveCaption.text}
                      <span style={{ animation: 'blink 1s step-end infinite', marginLeft: 2 }}>|</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Picker ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .page-in { animation: fadeUp .5s ease; }
        @keyframes gradFlow { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .exam-cta-btn {
          background: linear-gradient(135deg, #3B5BDB, #4C6EF5);
          background-size: 200% 200%;
          animation: gradFlow 4s ease infinite;
          border: none; cursor: pointer;
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .exam-cta-btn:hover { transform: scale(1.04); box-shadow: 0 6px 28px rgba(59,91,219,0.35); }
        .exam-cta-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
      `}</style>

      <div className="page-in" style={{ minHeight: '100vh', background: '#EDF2FF', overflowY: 'auto' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px' }}>

          <Link href="/dashboard" style={{ color: '#3B5BDB', textDecoration: 'none', fontSize: 14, fontWeight: 600, display: 'inline-block', marginBottom: 32 }}>
            ← Dashboard
          </Link>

          <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, color: '#1E3A8A', fontFamily: 'var(--font-poppins)', marginBottom: 6 }}>
            Start your exam
          </h1>
          <p style={{ color: '#3B5BDB', fontSize: 15, marginBottom: 36, opacity: 0.8 }}>
            Choose your level, subject, and number of questions to begin.
          </p>

          {error && (
            <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 12, padding: '12px 18px', marginBottom: 24, fontSize: 14, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Step 1: Level */}
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#3B5BDB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              1 · Class Level
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {EXAM_LEVELS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  style={{
                    padding: '10px 22px', borderRadius: 999, cursor: 'pointer',
                    border: `2px solid ${level === l.id ? l.color : 'transparent'}`,
                    background: level === l.id ? l.bg : 'rgba(255,255,255,0.7)',
                    color: l.color, fontWeight: 700, fontSize: 14,
                    transition: 'all 0.15s',
                    transform: level === l.id ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: level === l.id ? `0 4px 16px ${l.color}30` : 'none',
                  }}
                >
                  {l.emoji} {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Subject */}
          {level && (
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#3B5BDB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
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
                      background: subject === s.name ? s.bg : 'rgba(255,255,255,0.7)',
                      color: s.color, fontWeight: 700, fontSize: 14,
                      transition: 'all 0.15s',
                      transform: subject === s.name ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: subject === s.name ? `0 4px 16px ${s.color}30` : 'none',
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Number of questions */}
          {level && subject && (
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#3B5BDB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                3 · Number of questions
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {QUESTION_COUNTS.map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    style={{
                      padding: '10px 28px', borderRadius: 999, cursor: 'pointer',
                      border: `2px solid ${questionCount === n ? '#3B5BDB' : 'transparent'}`,
                      background: questionCount === n ? '#EDF2FF' : 'rgba(255,255,255,0.7)',
                      color: '#3B5BDB', fontWeight: 700, fontSize: 14,
                      transition: 'all 0.15s',
                      transform: questionCount === n ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: questionCount === n ? '0 4px 16px rgba(59,91,219,0.2)' : 'none',
                    }}
                  >
                    {n} questions
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start button */}
          <button
            className="exam-cta-btn"
            onClick={handleStartExam}
            disabled={!level || !subject}
            style={{
              width: '100%', padding: '16px', borderRadius: 16,
              color: '#FFFFFF', fontSize: 17, fontWeight: 800,
              fontFamily: 'var(--font-poppins)', letterSpacing: '-0.3px',
            }}
          >
            Begin Exam →
          </button>

          {/* Info note */}
          <div style={{ marginTop: 24, background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px 18px', border: '1.5px solid rgba(59,91,219,0.12)' }}>
            <p style={{ fontSize: 13, color: '#3B5BDB', opacity: 0.75, lineHeight: 1.6, margin: 0 }}>
              📝 <strong>How it works:</strong> The AI Exam Conductor will ask you MCQ questions one at a time. Say your answer as "Option 1", "Option 2", "B", or "Second". After finishing, you&apos;ll see your results.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
