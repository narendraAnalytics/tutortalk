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
npm run build        # production build (also type-checks)
npm run start        # serve production build locally
npx drizzle-kit push # push schema changes to Neon (no migrations, direct push)
```

Environment file is **`.env`** (not `.env.local`). All keys including `GEMINI_API_KEY` live there.

There is no lint or test script.

---

## What TutorTalk Does

AI-powered voice learning platform with two modes:

1. **Train** (`/session`) — Socratic voice tutor. AI guides students to answers through questions, never giving answers directly. Sessions end with a downloadable PDF transcript.
2. **Exam** (`/exam`) — Voice MCQ exam conductor. AI asks numbered questions with 4 options, student answers by voice, AI gives immediate correct/incorrect feedback with a brief explanation (3–5 words). Supports **5 exam levels**: Class 10, Intermediate, JEE, NEET, UPSC — each with exam-pattern-specific system prompts. Scoring is **+4 correct / −1 wrong**. An overall countdown timer (1 min/question) auto-ends the exam when it hits zero. Results screen shows marks, score, accuracy %, and time taken.

Both modes use the same Gemini Live WebSocket stack and VoiceOrb component. The dashboard at `/dashboard` shows both past train sessions and exam sessions, with a Train/Exam mode card selector.

---

## Architecture

### Data flow
```
Browser → POST /api/token            → Clerk auth check, returns GEMINI_API_KEY
Browser → WebSocket (direct)         → wss://generativelanguage.googleapis.com (Gemini Live)
Browser → POST /api/session/save     → Neon (transcript + metadata + type + score + plan limit check)
Browser → GET  /api/session/transcript?sessionId=xxx → returns PDF download
```

The WebSocket connects **browser-direct** to Google — Vercel never proxies audio. This is intentional: Vercel's 10s timeout would kill long sessions.

### Key files
| File | Role |
|------|------|
| `src/app/page.tsx` | Landing page (client component) — navbar with plan badge, hero, features, how it works, pricing (3 tiers), footer CTA |
| `src/app/session/page.tsx` | Train mode — voice session UI, WebSocket, AudioWorklet, transcript, orb, plan-based restrictions |
| `src/app/exam/page.tsx` | Exam mode — MCQ voice exam, question counter, score tracking, results screen, plan-based restrictions |
| `src/app/dashboard/page.tsx` | Server Component — fetches sessions from Neon, syncs plan from Clerk, shapes `SessionRow[]`, limits history for free plan |
| `src/app/dashboard/DashboardClient.tsx` | Client UI — nav with plan badge + UserButton, session list with type/score badges, upgrade nudge for free users |
| `src/app/api/token/route.ts` | Returns `GEMINI_API_KEY` to authenticated users |
| `src/app/api/session/save/route.ts` | Saves transcript + metadata; enforces monthly session/exam limits; syncs plan to DB |
| `src/app/api/session/status/route.ts` | Pre-flight check — returns `{ sessionsLeft, limitReached }` for current month |
| `src/app/api/exam/status/route.ts` | Pre-flight check — returns `{ examsLeft, limitReached }` for current month |
| `src/app/api/session/transcript/route.ts` | Returns session transcript as PDF download |
| `src/app/api/auth/sync/route.ts` | Upserts Clerk user into Neon `users` table |
| `src/lib/plans.ts` | **Single source of truth** for plan limits, badges, and `getPlanFromHas()` helper |
| `src/db/schema.ts` | Drizzle schema: `users` (with `plan` column), `sessions` (with `type`/`score`), `reports` (unused) |
| `src/lib/audioQueue.ts` | Gapless PCM16 playback via scheduled AudioBufferSourceNodes |
| `public/worklets/capture-processor.js` | AudioWorklet: Float32 → Int16 mic capture |
| `src/middleware.ts` | Clerk route protection — MUST be at `src/`, not project root |
| `src/components/VoiceOrb.tsx` | Animated orb: `'lg' \| 'md' \| 'sm'` sizes |

### Database schema
**`users` table**
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | primary key |
| `clerk_id` | varchar(255) | Clerk string ID — never uuid |
| `email` | varchar(255) | |
| `name` | varchar(255) | |
| `plan` | varchar(20) | `'free'` (default), `'plus'`, `'pro'` — write-through cache from Clerk |
| `created_at` | timestamp | |

**`sessions` table**
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | primary key |
| `user_id` | uuid | FK → users.id |
| `subject` | varchar(255) | e.g. `"Physics — JEE"` |
| `transcript` | text | JSON array of `{role, text}` entries |
| `duration_secs` | integer | |
| `started_at` | timestamp | |
| `ended_at` | timestamp | |
| `type` | varchar(20) | `'tutor'` (default) or `'exam'` |
| `score` | text | JSON: `{correct, answered, total, marks, maxMarks}` — exam only, null for tutor |

When reading `type` from DB, always guard: `(r.type ?? 'tutor') as 'tutor' | 'exam'`.

---

## Plan System

### Source of truth: `src/lib/plans.ts`
```typescript
type PlanKey = 'free' | 'plus' | 'pro'

PLAN_LIMITS = {
  free:  { sessionsPerMonth: 2, sessionMinutes: 5, examsPerMonth: 1, dashboardHistory: 1,
           tutorSubjects: ['Math','English','History'], examSubjects: ['Math','Chemistry'],
           examMaxQuestions: 5, allowHardDifficulty: false },
  plus:  { sessionsPerMonth: 30, sessionMinutes: 30, examsPerMonth: 30, dashboardHistory: Infinity,
           tutorSubjects: null, examSubjects: null, examMaxQuestions: null, allowHardDifficulty: true },
  pro:   { sessionsPerMonth: Infinity, sessionMinutes: Infinity, examsPerMonth: Infinity, ... },
}
```

### Lazy plan sync — no webhooks
Every request that touches plan-gated features calls `getPlanFromHas(has)` via Clerk's `has({ plan: 'pro' })` and writes the result to `users.plan` if it changed. This means the DB is never stale by more than one request.

**Server-side** (API routes, Server Components):
```typescript
const { has } = await auth();
const plan = getPlanFromHas(has as (p: { plan: string }) => boolean);
```

**Client-side** (session/exam pages, landing page):
```typescript
const { has } = useAuth();
const plan = getPlanFromHas(has as (p: { plan: string }) => boolean);
```

### Where plan is enforced
| Restriction | Enforced in |
|---|---|
| Monthly session count | `POST /api/session/save` — returns `{ error: 'SESSION_LIMIT_REACHED' }` 403 |
| Monthly exam count | `POST /api/session/save` — returns `{ error: 'EXAM_LIMIT_REACHED' }` 403 |
| Dashboard history limit | `src/app/dashboard/page.tsx` — slices rows before passing to client |
| Tutor subject filter | `src/app/session/page.tsx` picking UI |
| Session auto-end timer | `src/app/session/page.tsx` timer effect — fires for any plan where `limits.sessionMinutes !== Infinity` (free: 5 min, plus: 30 min) |
| Hard difficulty locked | `src/app/session/page.tsx` difficulty picker |
| Exam subject filter | `src/app/exam/page.tsx` picking UI |
| Exam question count locked to 5 | `src/app/exam/page.tsx` picking UI |
| Pre-flight limit check (session) | `GET /api/session/status` — called on session page mount for non-pro plans |
| Pre-flight limit check (exam) | `GET /api/exam/status` — called on exam page mount for non-pro plans |

### Plan badge
`PLAN_BADGE` from `src/lib/plans.ts` drives the badge shown in both the landing page navbar and the dashboard navbar. Badge reads from Clerk session token synchronously via `useAuth().has()`.

---

## Critical Rules

### Clerk
- Version is **v7** — use `useAuth`, `useUser`, `auth()`. No `SignedIn`/`SignedOut` components (don't exist in v7).
- `currentUser()` makes an extra server→Clerk round-trip that fails in local dev — avoid it in API routes. Use `auth()` only.
- Middleware MUST be at `src/middleware.ts`. Placing it at the project root silently breaks all Clerk auth.
- Clerk IDs are strings like `user_xxxxxxx` — `clerk_id` is `varchar(255)`, NEVER uuid.
- Plan slugs in Clerk Dashboard must exactly match: `'plus'`, `'pro'` (lowercase) — `has({ plan: 'pro' })` matches literally.

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
  if (sc?.interrupted) { flush(); return; }
  if (sc?.inputTranscription?.text?.trim()) { /* add user entry */ }
  if (sc?.outputTranscription?.text?.trim()) { aiBufferRef.current += ' ' + ...; } // accumulate BEFORE commit
  for (const part of sc?.modelTurn?.parts ?? []) { /* queue audio */ }
  if (sc?.turnComplete) { /* commit aiBufferRef, clear */ }  // LAST
},
```

### Gemini Live — greeting / session auto-start
Send trigger using **`sendRealtimeInput`** with text after `sessionRef.current = session`.
**Do NOT use `sendClientContent`** — mixing `sendClientContent` and `sendRealtimeInput` in the same session causes immediate disconnect.

### Audio
- Input: PCM16 at **16 kHz** mono. AudioWorklet converts Float32→Int16 in `public/worklets/capture-processor.js`.
- Output: PCM16 at **24 kHz**. Decode via `AudioContext({ sampleRate: 24000 })`.
- Two separate AudioContexts — do not share them.
- Both AudioContexts must be created inside an `onClick` handler (not `useEffect`) — Chrome blocks autoplay.
- Base64 encode mic chunks with: `btoa(String.fromCharCode(...new Uint8Array(buf)))`.
- AudioWorklet file MUST live in `public/` and be referenced as `/worklets/capture-processor.js` (absolute path).

### SDK
Use `@google/genai` (new unified SDK). `@google/generative-ai` is deprecated.

### PDF generation
`src/app/api/session/transcript/route.ts` generates PDFs via `@react-pdf/renderer`. It uses `React.createElement(...)` instead of JSX — the pdf renderer components aren't compatible with the Next.js JSX transform inside API routes. Keep this pattern when editing that file.

---

## Exam Mode — Additional Patterns

### Exam page state machine
`picking → connecting → active → saving → results`

The exam page uses refs that shadow state to avoid stale closures inside `onmessage`:
- `answeredCountRef`, `correctCountRef`, `durationRef`, `marksRef`, `countdownRef` — shadow their state counterparts
- `examDoneRef` — guards against double-completion
- `subjectRef`, `levelRef`, `questionCountRef` — captured at exam start so `handleExamComplete` can read them after cleanup
- `lastQuestionRef` — deduplicates `setCurrentQuestion` calls

### Exam scoring
+4 correct / −1 wrong tracked via `marksRef`. Score JSON: `{ correct, answered, total, marks, maxMarks: total * 4 }`.

### Countdown timer
1 minute per question. The same `setInterval` increments `duration` and decrements `countdownRef.current`. When it hits 0, `handleEndExam()` fires — no message is sent to the AI.

### Key parsing functions (in `src/app/exam/page.tsx`)
```typescript
parseQuestionNumber(text)  // matches "Question X of N" → X
parseResult(text)          // matches \bCorrect!\b or \bIncorrect\b
formatAiText(text)         // breaks options onto new lines for rendering
```
`formatAiText` second replace uses `'\n$1'` (NOT `'\nOption $2'` — only one capture group exists).
Render with `whiteSpace: 'pre-line'`. Correct/Incorrect turns get green/red background.

### Exam completion detection
```typescript
if (aiText.includes('Exam complete! You answered all')) {
  setTimeout(() => handleExamComplete(), 400); // 400ms lets last transcript entry commit
}
```

---

## Features Section — Carousel

The landing page features section (`src/app/page.tsx`) uses a 5-slide image carousel replacing the old static grid.

### State
```typescript
const [featIdx, setFeatIdx] = useState(0);
const [featAnim, setFeatAnim] = useState(false);
const goFeat = (next: number) => {
  setFeatAnim(true);
  setTimeout(() => { setFeatIdx((next + FEATURE_SLIDES.length) % FEATURE_SLIDES.length); setFeatAnim(false); }, 180);
};
```

### `FEATURE_SLIDES` constant (top of file)
5 entries, each with: `num`, `badge`, `title`, `bullets[]`, `image` (Cloudinary URL), `accent` (hex), `bg` (hex), `icon` (SVG element).

| # | Badge | Accent | Image Cloudinary ID |
|---|-------|--------|---------------------|
| 01 | Train Mode | `#D85A30` | `feature1_hekepo` |
| 02 | Exam Mode | `#3B5BDB` | `feature2_e1uhhv` |
| 03 | Dashboard | `#1D9E75` | `feature3_bgc9qi` |
| 04 | Smart Gating | `#6B5DB0` | `feature4_wbpatl` |
| 05 | Tech Stack | `#C47A14` | `techstuff_fko6ad` |

### Layout
- Wrapper: `maxWidth: 1180`, `margin: '0 auto'`, `position: 'relative'`
- Slide card: `display: flex`, `flexWrap: 'wrap'`, `minHeight: 380`, `background: #FFF8F3`, `borderRadius: 24`
- Left text col: `flex: '1 1 340px'`, padding `clamp(32px, 5vw, 52px)` — badge row, title, bullet list with check icons, dot nav
- Right image col: `flex: '1 1 420px'`, `minHeight: 280`, `overflow: hidden` — `<img objectFit: cover>` if `image` exists, else gradient placeholder with centered SVG icon
- Arrows: `position: absolute`, `left: -24` / `right: -24`, `top: 50%`
- Slide transition: `opacity` + `translateY(10px)` fade driven by `featAnim` state (180 ms)
- Dot nav: pill width `24px` for active, `8px` for inactive — transitions on `width` + `background`

---

## VoiceOrb sizes
- `'lg'` — orbPx=176, wrapper=510px (landing/picking/connecting screens)
- `'md'` — orbPx=120, wrapper=348px (active session — leaves room for transcript)
- `'sm'` — orbPx=72, wrapper=209px (saving/small contexts)

---

## Transcript UI — active session layout
Vertical layout: orb section (`flexShrink:0`) on top, transcript panel (`flex:1`) below.
Both `flex:1` containers need `minHeight:0` — without it, flex children grow past their container instead of scrolling.

---

## Design System

All UI uses **inline styles** (no Tailwind classes for layout). Two color themes:

### Train mode (coral/warm)
| Purpose | Value |
|---------|-------|
| Page background | `#FFFBF7` |
| Card surface | `#FFF8F3` |
| Headings | `#4A1B0C` |
| Body text | `#993C1D` |
| Primary CTA | `.cta-btn` — `linear-gradient(135deg, #D85A30, #EF9F27)` |
| Student bubble | `#7F77DD` / `#EEEDFE` |
| Tutor bubble | `#F0997B` / `#FFF3EC` |

### Exam mode (indigo/cool)
| Purpose | Value |
|---------|-------|
| Page background | `#EDF2FF` |
| Primary | `#3B5BDB` / `#4C6EF5` |
| Headings | `#1E3A8A` |
| Correct feedback | `#DCFCE7` / `#15803D` |
| Incorrect feedback | `#FEE2E2` / `#DC2626` |

### Plan badges
| Plan | Bg | Color |
|------|----|-------|
| Free | `#F0EDF9` | `#6B5DB0` |
| Plus | `#E0F5EE` | `#1D9E75` |
| Pro | `linear-gradient(135deg,#D85A30,#EF9F27)` | `#FFFBF7` |

### Fonts
| CSS variable | Font | Weights |
|---|---|---|
| `--font-sans` | Inter | default body |
| `--font-poppins` | Poppins | 400–800, headings/badges |

Use `fontFamily: 'var(--font-poppins)'` inline for headings/badges; body text inherits Inter via `--font-sans`.

### shadcn/ui components
`src/components/ui/` contains standard shadcn components (Button, Card, Dialog, etc.). They exist but the project pattern is **inline styles**, not Tailwind utility classes. Use shadcn only when introducing genuinely new interactive primitives; match the coral/indigo color system above.

Logo Cloudinary URL: `https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1776668144/logotutortalk_ecmdbm.png`

Navbar on landing page: sticky glass effect via `.tt-nav-sticky` (globals.css) — `border: none` is required to override Tailwind base layer's `border-border` rule that would otherwise show a dividing line.

---

## Common Bugs

| Symptom | Cause | Fix |
|---------|-------|-----|
| 1007 on session start | Unknown field in `generationConfig` | Check for `thinkingConfig`, snake_case tool keys |
| Session disconnect after greeting | `sendClientContent` mixed with `sendRealtimeInput` | Use only `sendRealtimeInput({ text })` |
| AI transcript entries empty in download | Final `outputTranscription` arrives same message as `turnComplete`; processed too late | Process `outputTranscription` before `turnComplete` |
| Transcript reading from wrong path | Used `msg.inputAudioTranscription` (top-level) | Read from `msg.serverContent.inputTranscription.text` |
| `clerkMiddleware() was not run` | `middleware.ts` at project root | Move to `src/middleware.ts` |
| Plan not updating after upgrade | `has()` reads stale session token | Token refreshes on next page load; DB syncs on next `auth()` call |
| Session limit not enforced | `users.plan` out of date | `POST /api/session/save` re-syncs plan before counting |
| AI doesn't respond to voice | `clientContent` used instead of `realtimeInput` | Switch to `realtimeInput` for all mic audio |
| AudioContext blocked silently | Created in `useEffect` | Move to `onClick` handler |
| Transcript truncated / won't scroll | `flex:1` container missing `minHeight:0` | Add `minHeight:0` to both outer and inner transcript flex containers |
| Exam scores all zero | Ref read before `onmessage` updates it | Read refs inside the `onmessage` callback only |
| Exam completes twice | `handleExamComplete` called by AI phrase and "End Exam" button | Guard with `examDoneRef.current` |
| `type` column null for old sessions | Existing rows stored NULL before default added | Guard: `(r.type ?? 'tutor') as 'tutor' \| 'exam'` |
| Literal `$2` in option text | `formatAiText` regex used `'\nOption $2'` with one capture group | Use `'\n$1'` |
| Navbar dividing line visible | Tailwind base `* { border-border }` adds border-color to `<nav>` | `.tt-nav-sticky` must have `border: none` |
