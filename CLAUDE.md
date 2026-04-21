# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

### Skill
For ALL frontend/UI work — landing page, dashboard, session page, exam page, components — use the skill at:
`C:\Users\ES\.claude\skills\nextstack.skill`

---

## Deployed URL
**https://tutortalk.vercel.app/**

---

## Dev Commands

```bash
npm run dev          # start local dev server
npx drizzle-kit push # push schema changes to Neon (no migrations, direct push)
```

Environment file is **`.env`** (not `.env.local`). All keys including `GEMINI_API_KEY` live there.

---

## What TutorTalk Does

AI-powered voice learning platform with two modes:

1. **Train** (`/session`) — Socratic voice tutor. AI guides students to answers through questions, never giving answers directly. Sessions end with a downloadable PDF transcript.
2. **Exam** (`/exam`) — Voice MCQ exam conductor. AI asks numbered questions with 4 options, student answers by voice, AI gives immediate correct/incorrect feedback with a brief explanation (3–5 words). Results screen shows score, accuracy %, and time taken.

Both modes use the same Gemini Live WebSocket stack and VoiceOrb component. The dashboard at `/dashboard` shows both past train sessions and exam sessions, with a Train/Exam mode card selector.

---

## Architecture

### Data flow
```
Browser → POST /api/token            → Clerk auth check, returns GEMINI_API_KEY
Browser → WebSocket (direct)         → wss://generativelanguage.googleapis.com (Gemini Live)
Browser → POST /api/session/save     → Neon (transcript + metadata + type + score)
Browser → GET  /api/session/transcript?sessionId=xxx → returns PDF download
```

The WebSocket connects **browser-direct** to Google — Vercel never proxies audio. This is intentional: Vercel's 10s timeout would kill long sessions.

### Key files
| File | Role |
|------|------|
| `src/app/session/page.tsx` | Train mode — voice session UI, WebSocket, AudioWorklet, transcript, orb |
| `src/app/exam/page.tsx` | Exam mode — MCQ voice exam, question counter, score tracking, results screen |
| `src/app/dashboard/page.tsx` | Server Component — fetches sessions from Neon, shapes `SessionRow[]` |
| `src/app/dashboard/DashboardClient.tsx` | Client UI — Train/Exam mode cards, session list with type/score badges |
| `src/app/api/token/route.ts` | Returns `GEMINI_API_KEY` to authenticated users |
| `src/app/api/session/save/route.ts` | Saves transcript + metadata + type + score to Neon |
| `src/app/api/session/transcript/route.ts` | Returns session transcript as PDF download |
| `src/app/api/auth/sync/route.ts` | Upserts Clerk user into Neon `users` table |
| `src/db/schema.ts` | Drizzle schema: `users`, `sessions` (with `type`/`score` columns), `reports` (unused) |
| `src/lib/audioQueue.ts` | Gapless PCM16 playback via scheduled AudioBufferSourceNodes |
| `public/worklets/capture-processor.js` | AudioWorklet: Float32 → Int16 mic capture |
| `src/middleware.ts` | Clerk route protection — MUST be at `src/`, not project root |
| `src/components/VoiceOrb.tsx` | Animated orb: `'lg' \| 'md' \| 'sm'` sizes |

### Database schema — `sessions` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | primary key |
| `user_id` | uuid | FK → users.id |
| `subject` | varchar(255) | e.g. `"Physics — Class 10"` |
| `transcript` | text | JSON array of `{role, text}` entries |
| `duration_secs` | integer | |
| `started_at` | timestamp | |
| `ended_at` | timestamp | |
| `type` | varchar(20) | `'tutor'` (default) or `'exam'` |
| `score` | text | JSON: `{correct, answered, total}` — exam only, null for tutor |

When reading `type` from DB, always guard: `(r.type ?? 'tutor') as 'tutor' | 'exam'`.

---

## Critical Rules

### Clerk
- Version is **v7** — use `useAuth`, `useUser`, `auth()`. No `SignedIn`/`SignedOut` components (don't exist in v7).
- `currentUser()` makes an extra server→Clerk round-trip that fails in local dev — avoid it in API routes. Use `auth()` only, and have the client send user data in the request body.
- Middleware MUST be at `src/middleware.ts`. Placing it at the project root silently breaks all Clerk auth.
- Clerk IDs are strings like `user_xxxxxxx` — `clerk_id` is `varchar(255)`, NEVER uuid.

### Gemini Live API — working config (confirmed)
```typescript
const session = await ai.live.connect({
  model: 'gemini-3.1-flash-live-preview',
  config: {
    responseModalities: [Modality.AUDIO],   // AUDIO only works fine
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }, // 'Puck' for exam
    tools: [{ googleSearch: {} }],           // camelCase — snake_case causes 1007
    systemInstruction: { parts: [{ text: systemText }] },
    inputAudioTranscription: {},             // enables user speech → sc.inputTranscription.text
    outputAudioTranscription: {},            // enables AI speech  → sc.outputTranscription.text
  } as any,
  callbacks: { onopen, onmessage, onclose, onerror },
});
```

**Voice assignment:** Train mode uses `'Zephyr'`, Exam mode uses `'Puck'` — keeps the two AI personalities audibly distinct.

**Critical config notes:**
- `responseModalities: [Modality.AUDIO]` — TEXT is NOT required for this model version (tested working)
- `tools` key is `googleSearch` (camelCase) — `google_search` (snake_case) causes 1007
- `thinkingConfig` / `thinkingBudget` are NOT supported — causes 1007
- Any unknown field in `generationConfig` causes immediate 1007 disconnect
- `inputAudioTranscription` and `outputAudioTranscription` are set in config (with "Audio"), but arrive in messages WITHOUT "Audio": `sc.inputTranscription.text` / `sc.outputTranscription.text`

### Gemini Live — transcript message paths (CRITICAL)
The config key names and the response message paths are **different**:

| Config key | Message path |
|------------|-------------|
| `inputAudioTranscription: {}` | `msg.serverContent.inputTranscription.text` |
| `outputAudioTranscription: {}` | `msg.serverContent.outputTranscription.text` |

**NOT** `msg.inputAudioTranscription` (top level, wrong) — always read from inside `serverContent`.

### Gemini Live — onmessage handler order (CRITICAL)
The final `outputTranscription` chunk and `turnComplete` often arrive in the **same message**.
**Always process transcription text BEFORE checking `turnComplete`**, or the last chunk is lost:

```typescript
onmessage: (msg: any) => {
  const sc = msg.serverContent;

  // 1. interruption — bail early
  if (sc?.interrupted) { flush(); return; }

  // 2. user speech transcript
  if (sc?.inputTranscription?.text?.trim()) {
    setTranscript(prev => [...prev, { role: 'user', text: sc.inputTranscription.text.trim() }]);
  }

  // 3. AI speech transcript — accumulate into buffer BEFORE commit
  if (sc?.outputTranscription?.text?.trim()) {
    aiBufferRef.current += ' ' + sc.outputTranscription.text.trim();
    setLiveCaption({ role: 'ai', text: aiBufferRef.current });
  }

  // 4. audio parts
  for (const part of sc?.modelTurn?.parts ?? []) {
    if (part.inlineData?.data) queueAudio(part.inlineData.data);
  }

  // 5. turnComplete — commit LAST, after all content in this message is processed
  if (sc?.turnComplete) {
    if (aiBufferRef.current.trim()) {
      setTranscript(prev => [...prev, { role: 'ai', text: aiBufferRef.current.trim() }]);
      aiBufferRef.current = '';
    }
    setLiveCaption(null);
  }
},
```

### Gemini Live — greeting / session auto-start
To make the AI speak immediately on session open (before user says anything):

1. Add to system instruction: `"Begin the session IMMEDIATELY by greeting the student warmly. Do not wait for the student to speak first."`
2. After `sessionRef.current = session`, send a trigger using **`sendRealtimeInput`** with text:

```typescript
session.sendRealtimeInput({
  text: `Greet the student warmly. Let them know you're their ${levelLabel} ${subject} tutor...`,
});
```

**Do NOT use `sendClientContent` for the greeting trigger.** Mixing `sendClientContent` and `sendRealtimeInput` in the same session causes immediate disconnect.

### WebSocket message types
| Type | When |
|------|------|
| `realtimeInput` | Streaming live mic audio chunks AND initial text trigger |
| `clientContent` | Only for seeding initial history (do NOT mix with realtimeInput) |
| `toolResponse` | Responding to model function calls |

**Mixing `realtimeInput` and `clientContent` causes session disconnect.**

### Audio
- Input: PCM16 at **16 kHz** mono. AudioWorklet converts Float32→Int16 in `public/worklets/capture-processor.js`.
- Output: PCM16 at **24 kHz**. Decode via `AudioContext({ sampleRate: 24000 })`.
- Two separate AudioContexts — do not share them.
- Both AudioContexts must be created inside an `onClick` handler (not `useEffect`) — Chrome blocks autoplay.
- Base64 encode mic chunks with: `btoa(String.fromCharCode(...new Uint8Array(buf)))` — the manual loop approach corrupts large chunks.
- AudioWorklet file MUST live in `public/` and be referenced as `/worklets/capture-processor.js` (absolute path).

### Server events — loop through ALL parts
A single `serverContent` event can contain audio + transcript simultaneously. Always loop through `modelTurn.parts` — never stop at the first part.

### SDK
Use `@google/genai` (new unified SDK). `@google/generative-ai` is deprecated.

---

## Exam Mode — Additional Patterns

### Exam page state machine
`picking → connecting → active → saving → results`

The exam page uses several refs that shadow state to avoid stale closures inside `onmessage`:
- `answeredCountRef`, `correctCountRef`, `durationRef` — shadow their state counterparts
- `examDoneRef` — guards against double-completion (natural end + user "End Exam")
- `subjectRef`, `levelRef`, `questionCountRef` — captured at exam start so `handleExamComplete` can read them after cleanup

### Exam question counter
Parse `"Question X of N"` from each committed AI turn to update `currentQuestion` state:
```typescript
function parseQuestionNumber(text: string): number | null {
  const m = text.match(/Question\s+(\d+)\s+of\s+\d+/i);
  return m ? parseInt(m[1], 10) : null;
}
```

### Exam scoring
Parse AI feedback from the same turn that confirms an answer:
```typescript
function parseResult(text: string): 'correct' | 'incorrect' | null {
  if (/\bCorrect!\b/i.test(text)) return 'correct';
  if (/\bIncorrect\b/i.test(text)) return 'incorrect';
  return null;
}
```
The system prompt instructs the AI to say `"Correct!"` or `"Incorrect."` immediately after `"You selected Option X."`. Explanations are capped at 3–5 words.

### Exam completion detection
```typescript
if (aiText.includes('Exam complete! You answered all')) {
  setTimeout(() => handleExamComplete(), 400);
}
```
The 400ms delay lets the last transcript entry commit before cleanup runs.

### Exam transcript formatting
AI turns are reformatted before rendering to put each option on its own line:
```typescript
function formatAiText(text: string): string {
  return text
    .replace(/\s+(Question\s+\d+\s+of\s+\d+[.:)]?\s*)/gi, '\n\n$1')
    .replace(/Option\s+([1-4])\s*[:.]?\s/g, '\nOption $1: ')
    .trim();
}
```
Render with `whiteSpace: 'pre-line'` on the bubble div. Correct/Incorrect turns get green/red background.

---

## VoiceOrb sizes
- `'lg'` — orbPx=176, wrapper=510px (use on landing/picking/connecting screens)
- `'md'` — orbPx=120, wrapper=348px (use in active session — leaves room for transcript)
- `'sm'` — orbPx=72,  wrapper=209px (use in saving/small contexts)

EQ bars (speaking animation) show for both `'lg'` and `'md'`. Only `'sm'` shows the mic icon for speaking.

---

## Transcript UI — active session layout
The active session uses a **vertical layout**: orb section (flexShrink:0) on top, transcript panel (flex:1) below.

Critical CSS to prevent transcript truncation on long conversations:
```tsx
{/* Transcript outer container */}
<div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
  {/* Scrollable messages */}
  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
    {messages}
  </div>
</div>
```
Both `flex: 1` containers need `minHeight: 0` — without it, flex children don't scroll (they grow past their container instead).

---

## Design System

All UI uses inline styles (no Tailwind classes for layout). Two color themes:

### Train mode (coral/warm)
| Purpose | Hex |
|---------|-----|
| Page background | `#FFFBF7` |
| Card surface | `#FFF8F3` |
| Headings | `#4A1B0C` |
| Body text | `#993C1D` |
| Primary / CTA gradient | `#D85A30 → #EF9F27` (`.cta-btn` class) |
| Button text | `#FFFBF7` |
| Student bubble | `#7F77DD` / `#EEEDFE` |
| Tutor bubble | `#F0997B` / `#FFF3EC` |

### Exam mode (indigo/cool)
| Purpose | Hex |
|---------|-----|
| Page background | `#EDF2FF` |
| Primary | `#3B5BDB` / `#4C6EF5` |
| Headings | `#1E3A8A` |
| Body text | `#3B5BDB` |
| CTA gradient | `#3B5BDB → #4C6EF5` |
| AI bubble | `#EEF2FF` / `#1E3A8A` |
| Correct feedback | `#DCFCE7` / `#15803D` |
| Incorrect feedback | `#FEE2E2` / `#DC2626` |

Logo Cloudinary URL: `https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1776668144/logotutortalk_ecmdbm.png`

VoiceOrb states: `idle` (breathe) → `listening` (teal rings) → `speaking` (coral rings + EQ bars) → `interrupted` (amber flash). Defined in `src/components/VoiceOrb.tsx`.

---

## Common Bugs

| Symptom | Cause | Fix |
|---------|-------|-----|
| 1007 on session start | Unknown field in setup `generationConfig` | Check for `thinkingConfig`, snake_case tool keys |
| Session disconnect after greeting | `sendClientContent` mixed with `sendRealtimeInput` | Use only `sendRealtimeInput({ text })` for greeting trigger |
| AI transcript entries empty in download | Final `outputTranscription` chunk arrives same message as `turnComplete`; turnComplete ran first | Process `outputTranscription` before `turnComplete` in `onmessage` |
| No transcript for first AI turn (greeting) | `sendRealtimeInput({ text })` response doesn't populate transcript | Fixed by correct `sc.outputTranscription.text` path + correct message order |
| Transcript reading from wrong path | Used `msg.inputAudioTranscription` (top-level, wrong) | Read from `msg.serverContent.inputTranscription.text` |
| `clerkMiddleware() was not run` | `middleware.ts` at project root | Move to `src/middleware.ts` |
| Users table empty after sign-up | Sync only ran on dashboard visit | `useEffect` in `page.tsx` fires `POST /api/auth/sync` on `isSignedIn && user` |
| AI doesn't respond to voice | `clientContent` used instead of `realtimeInput` | Switch to `realtimeInput` for all mic audio |
| AudioContext blocked silently | Created in `useEffect` | Move to `onClick` handler |
| Garbled audio | Float32 sent instead of Int16 | Verify worklet outputs `Int16Array` |
| Transcript truncated / won't scroll | `flex: 1` container missing `minHeight: 0` | Add `minHeight: 0` to both the outer and inner transcript flex containers |
| Exam scores all zero | `correctCountRef.current` read before `onmessage` updates it | Always read refs inside the `onmessage` callback, not in stale closures |
| Q counter stuck at 1 | Parsing `answeredCount` instead of question number from AI text | Use `parseQuestionNumber()` on committed AI turn text |
| Exam completes twice | `handleExamComplete` called by both AI phrase and "End Exam" button | Guard with `examDoneRef.current` check at top of both handlers |
| `type` column null for old sessions | Column added with `DEFAULT 'tutor'` but existing rows stored NULL | Guard: `(r.type ?? 'tutor') as 'tutor' \| 'exam'` in dashboard map |
