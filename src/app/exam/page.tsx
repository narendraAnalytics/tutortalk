'use client';

import { useEffect, useRef, useState } from 'react';
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
  { id: 'jee',          label: 'JEE',          emoji: '⚡', color: '#7C3AED', bg: '#F3E8FF' },
  { id: 'neet',         label: 'NEET',         emoji: '🧬', color: '#059669', bg: '#ECFDF5' },
  { id: 'upsc',         label: 'UPSC',         emoji: '🏛️', color: '#B45309', bg: '#FFFBEB' },
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
  jee: [
    { name: 'Physics',     bg: '#F3E8FF', color: '#7C3AED' },
    { name: 'Chemistry',   bg: '#EDE9FE', color: '#6D28D9' },
    { name: 'Mathematics', bg: '#F3E8FF', color: '#7C3AED' },
  ],
  neet: [
    { name: 'Physics',   bg: '#ECFDF5', color: '#059669' },
    { name: 'Chemistry', bg: '#D1FAE5', color: '#047857' },
    { name: 'Biology',   bg: '#ECFDF5', color: '#059669' },
  ],
  upsc: [
    { name: 'History',              bg: '#FFFBEB', color: '#B45309' },
    { name: 'Geography',            bg: '#FEF3C7', color: '#D97706' },
    { name: 'Polity',               bg: '#FFFBEB', color: '#B45309' },
    { name: 'Economics',            bg: '#FEF3C7', color: '#D97706' },
    { name: 'Science & Technology', bg: '#FFFBEB', color: '#B45309' },
    { name: 'Current Affairs',      bg: '#FEF3C7', color: '#D97706' },
  ],
};

const QUESTION_COUNTS = [5, 10, 15];
const TIME_LIMITS = [30, 60, 90, 120];

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

// Parse "Question X of N" from AI text → returns X
function parseQuestionNumber(text: string): number | null {
  const m = text.match(/Question\s+(\d+)\s+of\s+\d+/i);
  return m ? parseInt(m[1], 10) : null;
}

// Parse whether this turn confirmed an answer
function parseConfirmedAnswer(text: string): boolean {
  return /You selected Option\s+\d/i.test(text) ||
    /You have selected Option\s+\d/i.test(text) ||
    /You chose Option\s+\d/i.test(text);
}

// Parse whether AI said Correct or Incorrect this turn
function parseResult(text: string): 'correct' | 'incorrect' | null {
  if (/\bCorrect!\b/i.test(text)) return 'correct';
  if (/\bIncorrect\b/i.test(text)) return 'incorrect';
  return null;
}

// Format AI transcript text: put each option and question on its own line
function formatAiText(text: string): string {
  return text
    .replace(/\s+(Question\s+\d+\s+of\s+\d+[.:)]?\s*)/gi, '\n\n$1')
    .replace(/\s+(Option\s+[1-4]\s*[:.]?\s)/gi, '\nOption $2')
    // keep "Option 1:" format clean
    .replace(/Option\s+([1-4])\s*[:.]?\s/g, 'Option $1: ')
    .trim();
}

function buildExamSystemInstruction(level: string, subject: string, n: number): string {
  const levelLabel = EXAM_LEVELS.find(l => l.id === level)?.label ?? level;

  const patternMap: Record<string, string> = {
    jee: `JEE-pattern rules: multi-step numerical reasoning, combine 2+ concepts per question, avoid direct formula recall, use common misconceptions as distractors, force derivation not memorisation.`,
    neet: `NEET-pattern rules: strictly NCERT-based, mix concept + fact precision, include application questions, use high-quality distractors testing common biological/chemical misconceptions.`,
    upsc: `UPSC-pattern rules: use statement-based format ("Which of the following statements is/are correct?"), elimination logic required, mix conceptual + analytical + current-affairs style questions, all options must be plausible.`,
    class10: `Difficulty rules: analytical and application-based questions, no trivial recall, test deep understanding, use believable wrong options.`,
    intermediate: `Difficulty rules: advanced application questions, multi-concept integration, force conceptual clarity, avoid surface-level recall.`,
  };
  const examPattern = patternMap[level] ?? patternMap['intermediate'];

  return `You are an expert AI Exam Conductor specialising in ${levelLabel} exam preparation.
Conduct a ${subject} exam with exactly ${n} MCQ questions, one at a time.

${examPattern}

Marking scheme (inform students): +4 for correct, -1 for wrong answer.

Rules:
1. Number each: "Question 1 of ${n}", "Question 2 of ${n}", etc.
2. Present exactly 4 options: Option 1: ... Option 2: ... Option 3: ... Option 4: ...
3. Ask: "Please say Option 1, 2, 3, or 4."
4. Accept: "Option 2", "Two", "B", "Second".
5. Confirm with EXACT phrase: "You selected Option X." (X = number, period at end).
6. Evaluate immediately:
   - Correct: "Correct! [3–5 words max — why]"
   - Incorrect: "Incorrect. Answer is Option Y. [3–5 words max — why]"
7. Say "Next question." and continue.
8. If you receive "Time is up!" — say "Time up! Moving on." then present the next question immediately. Do NOT say Correct or Incorrect.
9. After all ${n} questions say exactly: "Exam complete! You answered all ${n} questions."
10. Begin IMMEDIATELY — one-sentence welcome then Question 1.

CRITICAL: Always use "You selected Option X." before Correct/Incorrect. Explanations 3–5 words only.`;
}

export default function ExamPage() {
  const [phase, setPhase] = useState<Phase>('picking');
  const [level, setLevel] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcript, setTranscript] = useState<Entry[]>([]);
  const [liveCaption, setLiveCaption] = useState<{ role: 'user' | 'ai'; text: string } | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [questionTimeLimit, setQuestionTimeLimit] = useState(60);
  const [questionTimerSecs, setQuestionTimerSecs] = useState(60);
  const [marks, setMarks] = useState(0);

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
  const correctCountRef = useRef(0);
  const answeredCountRef = useRef(0);
  const durationRef = useRef(0);
  const examDoneRef = useRef(false);
  const subjectRef = useRef<string | null>(null);
  const levelRef = useRef<string | null>(null);
  const questionCountRef = useRef(10);
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionTimerSecsRef = useRef(60);
  const questionTimeLimitRef = useRef(60);
  const lastQuestionRef = useRef(0);
  const questionAnsweredRef = useRef(false);
  const marksRef = useRef(0);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);
  useEffect(() => { subjectRef.current = subject; }, [subject]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { questionCountRef.current = questionCount; }, [questionCount]);
  useEffect(() => { questionTimeLimitRef.current = questionTimeLimit; }, [questionTimeLimit]);
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
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
  }

  async function saveAndFinish() {
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
          score: JSON.stringify({
            correct: correctCountRef.current,
            answered: answeredCountRef.current,
            total: questionCountRef.current,
            marks: marksRef.current,
            maxMarks: questionCountRef.current * 4,
          }),
        }),
      });
    } catch { /* navigate anyway */ }
    setPhase('results');
  }

  async function handleExamComplete() {
    if (examDoneRef.current) return;
    examDoneRef.current = true;
    cleanup();
    await saveAndFinish();
  }

  async function handleEndExam() {
    if (examDoneRef.current) return;
    examDoneRef.current = true;
    cleanup();
    await saveAndFinish();
  }

  async function handleStartExam() {
    if (!subject || !level) return;
    setPhase('connecting');
    setError(null);
    intentionalCloseRef.current = false;
    examDoneRef.current = false;
    correctCountRef.current = 0;
    answeredCountRef.current = 0;
    marksRef.current = 0;
    setCorrectCount(0);
    setAnsweredCount(0);
    setMarks(0);
    setCurrentQuestion(1);
    lastQuestionRef.current = 0;
    questionAnsweredRef.current = false;
    questionTimerSecsRef.current = questionTimeLimitRef.current;
    setQuestionTimerSecs(questionTimeLimitRef.current);

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

                // Detect new question → start per-question timer
                const qNum = parseQuestionNumber(aiText);
                if (qNum !== null && qNum !== lastQuestionRef.current) {
                  lastQuestionRef.current = qNum;
                  setCurrentQuestion(qNum);
                  startQuestionTimer();
                }

                // Answer confirmed → stop per-question timer, count as answered
                if (parseConfirmedAnswer(aiText) && !questionAnsweredRef.current) {
                  questionAnsweredRef.current = true;
                  if (questionTimerRef.current) {
                    clearInterval(questionTimerRef.current);
                    questionTimerRef.current = null;
                  }
                  answeredCountRef.current += 1;
                  setAnsweredCount(answeredCountRef.current);
                }

                // Score the result
                const result = parseResult(aiText);
                if (result === 'correct') {
                  correctCountRef.current += 1;
                  setCorrectCount(correctCountRef.current);
                  marksRef.current += 4;
                  setMarks(marksRef.current);
                } else if (result === 'incorrect') {
                  marksRef.current -= 1;
                  setMarks(marksRef.current);
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
        text: `Welcome the student in one sentence, then start Question 1 of ${questionCount} — ${subject} MCQ for ${levelLabel}. Present 4 options: Option 1, 2, 3, 4.`,
      });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start exam');
      setPhase('picking');
      cleanup();
    }
  }

  function startQuestionTimer() {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    questionAnsweredRef.current = false;
    questionTimerSecsRef.current = questionTimeLimitRef.current;
    setQuestionTimerSecs(questionTimeLimitRef.current);

    questionTimerRef.current = setInterval(() => {
      questionTimerSecsRef.current -= 1;
      setQuestionTimerSecs(questionTimerSecsRef.current);

      if (questionTimerSecsRef.current <= 0) {
        clearInterval(questionTimerRef.current!);
        questionTimerRef.current = null;
        if (!questionAnsweredRef.current && !examDoneRef.current) {
          questionAnsweredRef.current = true;
          answeredCountRef.current += 1;
          setAnsweredCount(answeredCountRef.current);
          marksRef.current -= 1;
          setMarks(marksRef.current);
          sessionRef.current?.sendRealtimeInput({ text: 'Time is up! Move to the next question immediately.' });
        }
      }
    }, 1000);
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
    const correct = correctCountRef.current;
    const answered = answeredCountRef.current;
    const total = questionCountRef.current;
    const finalMarks = marksRef.current;
    const maxMarks = total * 4;
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    const accuracyColor = accuracy >= 70 ? '#16A34A' : accuracy >= 40 ? '#D97706' : '#DC2626';
    const accuracyBg   = accuracy >= 70 ? '#DCFCE7' : accuracy >= 40 ? '#FEF3C7' : '#FEE2E2';
    const marksColor = finalMarks >= 0 ? '#15803D' : '#DC2626';
    const marksBg    = finalMarks >= 0 ? '#DCFCE7' : '#FEE2E2';

    return (
      <>
        <style>{`
          @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          .exam-results-card { animation: fadeUp .6s ease backwards; }
          .exam-stat-tile { border-radius: 18px; padding: 20px 12px; text-align: center; }
        `}</style>
        <div style={{ minHeight: '100vh', background: '#EDF2FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div className="exam-results-card" style={{
            background: '#FFFFFF', borderRadius: 28,
            padding: 'clamp(32px,5vw,52px) clamp(24px,5vw,48px)',
            maxWidth: 500, width: '100%',
            boxShadow: '0 8px 48px rgba(59,91,219,0.15)',
            border: '1.5px solid rgba(76,110,245,0.18)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🎓</div>
            <h1 style={{ fontSize: 'clamp(22px,5vw,28px)', fontWeight: 800, color: '#1E3A8A', fontFamily: 'var(--font-poppins)', marginBottom: 6, letterSpacing: '-0.5px' }}>
              Exam Complete!
            </h1>
            <p style={{ color: '#4C6EF5', fontSize: 14, opacity: 0.8, marginBottom: 28 }}>
              {lvlLabel} · {subj}
            </p>

            {/* Marks highlight */}
            <div style={{ background: marksBg, borderRadius: 18, padding: '16px 24px', marginBottom: 10 }}>
              <div style={{ fontSize: 38, fontWeight: 800, color: marksColor, fontFamily: 'var(--font-poppins)', letterSpacing: '-1px', lineHeight: 1 }}>
                {finalMarks >= 0 ? '+' : ''}{finalMarks} / {maxMarks}
              </div>
              <div style={{ fontSize: 12, color: marksColor, fontWeight: 700, marginTop: 6, opacity: 0.85 }}>
                marks  ·  +4 correct, −1 wrong
              </div>
            </div>

            {/* Score highlight */}
            <div style={{ background: accuracyBg, borderRadius: 18, padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: accuracyColor, fontFamily: 'var(--font-poppins)', letterSpacing: '-2px', lineHeight: 1 }}>
                {correct}/{total}
              </div>
              <div style={{ fontSize: 13, color: accuracyColor, fontWeight: 700, marginTop: 8, opacity: 0.85 }}>
                {accuracy}% accuracy · {answered} answered
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
              <div className="exam-stat-tile" style={{ background: '#EDF2FF' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#3B5BDB', fontFamily: 'var(--font-poppins)' }}>
                  {correct}
                </div>
                <div style={{ fontSize: 11, color: '#4C6EF5', fontWeight: 700, marginTop: 4, opacity: 0.8 }}>correct</div>
              </div>
              <div className="exam-stat-tile" style={{ background: '#EDF2FF' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#3B5BDB', fontFamily: 'var(--font-poppins)' }}>
                  {mins}:{secs.toString().padStart(2, '0')}
                </div>
                <div style={{ fontSize: 11, color: '#4C6EF5', fontWeight: 700, marginTop: 4, opacity: 0.8 }}>time taken</div>
              </div>
            </div>

            <p style={{ color: '#6B7280', fontSize: 12.5, marginBottom: 28, lineHeight: 1.6 }}>
              Transcript saved to your dashboard. Review each answer in the transcript above.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  correctCountRef.current = 0;
                  answeredCountRef.current = 0;
                  marksRef.current = 0;
                  setCorrectCount(0);
                  setAnsweredCount(0);
                  setMarks(0);
                  setCurrentQuestion(1);
                  setDuration(0);
                  durationRef.current = 0;
                  lastQuestionRef.current = 0;
                  setTranscript([]);
                  setPhase('picking');
                }}
                style={{
                  background: 'transparent', border: '1.5px solid rgba(59,91,219,0.25)',
                  color: '#3B5BDB', padding: '13px 36px', borderRadius: 99,
                  fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-poppins)',
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
        `}</style>

        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#EDF2FF', overflow: 'hidden' }}>

          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
            background: 'rgba(237,242,255,0.95)', backdropFilter: 'blur(16px)',
            borderBottom: '1.5px solid rgba(59,91,219,0.12)', flexShrink: 0, flexWrap: 'wrap',
          }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', marginRight: 2 }}>
              <img src="https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1776668144/logotutortalk_ecmdbm.png"
                alt="TutorTalk" style={{ width: 26, height: 26, objectFit: 'contain' }} />
            </Link>

            <div style={{ background: levelMeta?.bg ?? '#EDF2FF', color: levelMeta?.color ?? '#3B5BDB', padding: '3px 11px', borderRadius: 99, fontWeight: 700, fontSize: 11.5, fontFamily: 'var(--font-poppins)', border: `1px solid ${levelMeta?.color ?? '#3B5BDB'}25` }}>
              {levelMeta?.emoji} {levelMeta?.label}
            </div>

            <div style={{ background: subjectMeta?.bg ?? '#EDF2FF', color: subjectMeta?.color ?? '#4C6EF5', padding: '3px 11px', borderRadius: 99, fontWeight: 700, fontSize: 11.5, fontFamily: 'var(--font-poppins)', border: `1px solid ${subjectMeta?.color ?? '#4C6EF5'}25` }}>
              {subject}
            </div>

            {/* Current question counter — updates live from transcript */}
            <div style={{ background: '#3B5BDB', color: '#FFFFFF', padding: '3px 13px', borderRadius: 99, fontWeight: 700, fontSize: 11.5, fontFamily: 'var(--font-poppins)' }}>
              Q {currentQuestion}/{questionCount}
            </div>

            {/* Live score */}
            <div style={{ background: '#DCFCE7', color: '#16A34A', padding: '3px 11px', borderRadius: 99, fontWeight: 700, fontSize: 11.5, fontFamily: 'var(--font-poppins)' }}>
              ✓ {correctCount}
            </div>

            {/* Per-question countdown */}
            <div style={{
              background: questionTimerSecs > 30 ? '#DCFCE7' : questionTimerSecs > 10 ? '#FEF3C7' : '#FEE2E2',
              color: questionTimerSecs > 30 ? '#15803D' : questionTimerSecs > 10 ? '#D97706' : '#DC2626',
              padding: '3px 11px', borderRadius: 99, fontWeight: 800, fontSize: 12,
              fontFamily: 'var(--font-poppins)',
              border: `1.5px solid ${questionTimerSecs <= 10 ? '#DC262640' : 'transparent'}`,
            }}>
              ⏱ {questionTimerSecs}s
            </div>

            <div style={{ flex: 1 }} />

            {/* Marks badge */}
            <div style={{
              background: marks >= 0 ? '#DCFCE7' : '#FEE2E2',
              color: marks >= 0 ? '#15803D' : '#DC2626',
              padding: '3px 11px', borderRadius: 99, fontWeight: 800, fontSize: 11.5,
              fontFamily: 'var(--font-poppins)',
            }}>
              {marks >= 0 ? '+' : ''}{marks} marks
            </div>

            {/* Overall elapsed */}
            <div style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: 12, color: '#1E3A8A', opacity: 0.65 }}>
              {fmtTime(duration)}
            </div>

            <button
              onClick={handleEndExam}
              style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', padding: '6px 14px', borderRadius: 99, fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-poppins)', cursor: 'pointer' }}
            >
              End Exam
            </button>
          </div>

          {/* Orb section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 16px 6px', flexShrink: 0 }}>
            <VoiceOrb state={orbState} size="md" />
            <p style={{ color: '#3B5BDB', fontSize: 12.5, fontWeight: 600, marginTop: 6, fontFamily: 'var(--font-poppins)' }}>
              {STATUS_LABEL[orbState]}
            </p>
          </div>

          {/* Transcript */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 14px 14px' }}>
            <div
              className="exam-transcript-box"
              style={{
                flex: 1, minHeight: 0, overflowY: 'auto',
                background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)',
                borderRadius: 16, border: '1.5px solid #C7D2FE',
                padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              {transcript.length === 0 && !liveCaption && (
                <div style={{ textAlign: 'center', color: '#6366F1', opacity: 0.45, fontSize: 14, marginTop: 24 }}>
                  Exam transcript will appear here…
                </div>
              )}

              {transcript.map((e, i) => {
                const isAI = e.role === 'ai';
                // Format AI text: break before each "Option X:" and "Question X of N"
                const displayText = isAI ? formatAiText(e.text) : e.text;
                // Detect result lines for coloring
                const isCorrect = isAI && /\bCorrect!\b/i.test(e.text);
                const isIncorrect = isAI && /\bIncorrect\b/i.test(e.text);
                const bubbleBg = isCorrect ? '#DCFCE7' : isIncorrect ? '#FEE2E2' : isAI ? '#EEF2FF' : '#EEEDFE';
                const bubbleColor = isCorrect ? '#15803D' : isIncorrect ? '#DC2626' : isAI ? '#1E3A8A' : '#26215C';

                return (
                  <div key={i} style={{ display: 'flex', justifyContent: isAI ? 'flex-start' : 'flex-end' }}>
                    <div style={{ maxWidth: '88%' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#6366F1', opacity: 0.55, marginBottom: 2, textAlign: isAI ? 'left' : 'right', letterSpacing: '0.07em' }}>
                        {isAI ? 'EXAM AI' : 'YOU'}
                      </div>
                      <div style={{
                        background: bubbleBg, color: bubbleColor,
                        padding: '9px 13px',
                        borderRadius: isAI ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                        fontSize: 13.5, lineHeight: 1.6,
                        whiteSpace: 'pre-line',
                      }}>
                        {displayText}
                      </div>
                    </div>
                  </div>
                );
              })}

              {liveCaption && (
                <div style={{ display: 'flex', justifyContent: liveCaption.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '88%' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#6366F1', opacity: 0.4, marginBottom: 2, textAlign: liveCaption.role === 'user' ? 'right' : 'left', letterSpacing: '0.07em' }}>
                      {liveCaption.role === 'user' ? 'YOU' : 'EXAM AI'}
                    </div>
                    <div style={{
                      background: liveCaption.role === 'ai' ? '#EEF2FF' : '#EEEDFE',
                      color: liveCaption.role === 'ai' ? '#1E3A8A' : '#26215C',
                      padding: '9px 13px',
                      borderRadius: liveCaption.role === 'ai' ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                      fontSize: 13.5, lineHeight: 1.6, opacity: 0.7,
                      whiteSpace: 'pre-line',
                    }}>
                      {liveCaption.role === 'ai' ? formatAiText(liveCaption.text) : liveCaption.text}
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
                <button key={l.id} onClick={() => setLevel(l.id)} style={{ padding: '10px 22px', borderRadius: 999, cursor: 'pointer', border: `2px solid ${level === l.id ? l.color : 'transparent'}`, background: level === l.id ? l.bg : 'rgba(255,255,255,0.7)', color: l.color, fontWeight: 700, fontSize: 14, transition: 'all 0.15s', transform: level === l.id ? 'scale(1.05)' : 'scale(1)', boxShadow: level === l.id ? `0 4px 16px ${l.color}30` : 'none' }}>
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
                  <button key={s.name} onClick={() => setSubject(s.name)} style={{ padding: '10px 22px', borderRadius: 999, cursor: 'pointer', border: `2px solid ${subject === s.name ? s.color : 'transparent'}`, background: subject === s.name ? s.bg : 'rgba(255,255,255,0.7)', color: s.color, fontWeight: 700, fontSize: 14, transition: 'all 0.15s', transform: subject === s.name ? 'scale(1.05)' : 'scale(1)', boxShadow: subject === s.name ? `0 4px 16px ${s.color}30` : 'none' }}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Question count */}
          {level && subject && (
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#3B5BDB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                3 · Number of questions
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {QUESTION_COUNTS.map(n => (
                  <button key={n} onClick={() => setQuestionCount(n)} style={{ padding: '10px 28px', borderRadius: 999, cursor: 'pointer', border: `2px solid ${questionCount === n ? '#3B5BDB' : 'transparent'}`, background: questionCount === n ? '#EDF2FF' : 'rgba(255,255,255,0.7)', color: '#3B5BDB', fontWeight: 700, fontSize: 14, transition: 'all 0.15s', transform: questionCount === n ? 'scale(1.05)' : 'scale(1)', boxShadow: questionCount === n ? '0 4px 16px rgba(59,91,219,0.2)' : 'none' }}>
                    {n} questions
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Time per question */}
          {level && subject && (
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#3B5BDB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                4 · Time per question
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {TIME_LIMITS.map(t => (
                  <button key={t} onClick={() => setQuestionTimeLimit(t)} style={{ padding: '10px 22px', borderRadius: 999, cursor: 'pointer', border: `2px solid ${questionTimeLimit === t ? '#3B5BDB' : 'transparent'}`, background: questionTimeLimit === t ? '#EDF2FF' : 'rgba(255,255,255,0.7)', color: '#3B5BDB', fontWeight: 700, fontSize: 14, transition: 'all 0.15s', transform: questionTimeLimit === t ? 'scale(1.05)' : 'scale(1)', boxShadow: questionTimeLimit === t ? '0 4px 16px rgba(59,91,219,0.2)' : 'none' }}>
                    {t}s
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="exam-cta-btn" onClick={handleStartExam} disabled={!level || !subject} style={{ width: '100%', padding: '16px', borderRadius: 16, color: '#FFFFFF', fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-poppins)', letterSpacing: '-0.3px' }}>
            Begin Exam →
          </button>

          <div style={{ marginTop: 24, background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px 18px', border: '1.5px solid rgba(59,91,219,0.12)' }}>
            <p style={{ fontSize: 13, color: '#3B5BDB', opacity: 0.75, lineHeight: 1.6, margin: 0 }}>
              📝 <strong>How it works:</strong> The AI asks MCQ questions one at a time. Say your answer — &quot;Option 1&quot;, &quot;B&quot;, or &quot;Second&quot;. <strong>+4 for correct, −1 for wrong.</strong> Each question has a countdown timer. Marks and score shown at the end.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
