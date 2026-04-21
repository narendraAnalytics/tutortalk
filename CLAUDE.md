# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

### Skill
For ALL frontend/UI work — landing page, dashboard, session page, components — use the skill at:
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

AI-powered Socratic voice tutor. Students speak; the AI guides them to answers through questions — never giving answers directly. Sessions end with a downloadable transcript (`.txt`).

---

## Architecture

### Data flow
```
Browser → POST /api/token            → Clerk auth check, returns GEMINI_API_KEY
Browser → WebSocket (direct)         → wss://generativelanguage.googleapis.com (Gemini Live)
Browser → POST /api/session/save     → Neon (transcript + metadata)
Browser → GET  /api/session/transcript?sessionId=xxx → returns .txt download
```

The WebSocket connects **browser-direct** to Google — Vercel never proxies audio. This is intentional: Vercel's 10s timeout would kill long sessions.

### Key files
| File | Role |
|------|------|
| `src/app/session/page.tsx` | Full voice session UI — WebSocket, AudioWorklet, transcript, orb |
| `src/app/dashboard/page.tsx` | Server Component — fetches sessions from Neon |
| `src/app/dashboard/DashboardClient.tsx` | Client UI for dashboard |
| `src/app/api/token/route.ts` | Returns `GEMINI_API_KEY` to authenticated users |
| `src/app/api/session/save/route.ts` | Saves transcript + metadata to Neon |
| `src/app/api/session/transcript/route.ts` | Returns session transcript as `.txt` download |
| `src/app/api/auth/sync/route.ts` | Upserts Clerk user into Neon `users` table |
| `src/db/schema.ts` | Drizzle schema: `users`, `sessions`, `reports` (`reports` table unused but kept) |
| `src/lib/audioQueue.ts` | Gapless PCM16 playback via scheduled AudioBufferSourceNodes |
| `public/worklets/capture-processor.js` | AudioWorklet: Float32 → Int16 mic capture |
| `src/middleware.ts` | Clerk route protection — MUST be at `src/`, not project root |
| `src/components/VoiceOrb.tsx` | Animated orb: `'lg' \| 'md' \| 'sm'` sizes |

---

## Critical Rules

### Clerk
- Version is **v7** — use `useAuth`, `useUser`, `auth()`. No `SignedIn`/`SignedOut` components (don't exist in v7).
- `currentUser()` makes an extra server→Clerk round-trip that fails in local dev — avoid it in API routes. Use `auth()` only, and have the client send user data in the request body.
- Middleware MUST be at `src/middleware.ts`. Placing it at the project root silently breaks all Clerk auth.
- Clerk IDs are strings like `user_xxxxxxx` — `clerk_id` is `varchar(255)`, NEVER uuid.


###
  Crystal clear. The middleware is at ./middleware.ts but with a src/ project it must be at ./src/middleware.ts.

  
### Gemini Live API — working config (confirmed)
```typescript
const session = await ai.live.connect({
  model: 'gemini-3.1-flash-live-preview',
  config: {
    responseModalities: [Modality.AUDIO],   // AUDIO only works fine
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
    tools: [{ googleSearch: {} }],           // camelCase — snake_case causes 1007
    systemInstruction: { parts: [{ text: systemText }] },
    inputAudioTranscription: {},             // enables user speech → sc.inputTranscription.text
    outputAudioTranscription: {},            // enables AI speech  → sc.outputTranscription.text
  } as any,
  callbacks: { onopen, onmessage, onclose, onerror },
});
```

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

## Voice Code — Our Implementation vs Reference (jaydanurwin/gemini-live-agent-demo)

| Area | Reference demo | TutorTalk | Verdict |
|------|---------------|-----------|---------|
| `responseModalities` | `[AUDIO]` | `[AUDIO]` | ✓ same |
| `outputAudioTranscription` | `{}` in config | `{}` in config | ✓ same |
| `inputAudioTranscription` | absent | `{}` in config | ✓ **ours better** (user speech transcript) |
| `speechConfig / Zephyr` | ✓ | ✓ | ✓ same |
| `tools: googleSearch` | ✓ | ✓ | ✓ same |
| Mic encoding | `btoa(fromCharCode loop)` | `btoa(String.fromCharCode(...new Uint8Array(buf)))` | ✓ same |
| Audio output decode | manual Int16→Float32 | `b64ToAudioBuffer()` — same logic | ✓ same |
| Gapless audio playback | scheduled `AudioBufferSourceNode`s | `AudioQueue` lib — same pattern | ✓ equal/better |
| Transcript paths | `sc.outputTranscription.text` | `sc.outputTranscription.text` | ✓ same (fixed) |
| Text → model | `sendClientContent()` | `sendRealtimeInput({ text })` | ✓ ours correct (avoids mixing) |
| Auto-greet | manual button click | `sendRealtimeInput({ text })` after connect | ✓ ours better (automatic) |
| Message order | n/a (server-side) | transcription before turnComplete | ✓ ours fixed |

**Conclusion**: TutorTalk's voice implementation is equal or better than the reference on all dimensions.

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

All UI uses inline styles (no Tailwind classes for layout). Colors — no exceptions:

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
