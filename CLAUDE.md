### Skill
For ALL frontend/UI work — landing page, dashboard, components, emails — use the skill at:
`C:\Users\ES\.claude\skills\nextstack.skill`

---

### Deployed In Vercel
**URL:** https://tutortalk.vercel.app/

---

## What Has Been Built (Session Log)

### Session 1 — Packages & Config
- Installed all required packages (Clerk, Drizzle, Neon, Framer Motion, Lucide, Zod, etc.)
- Updated `CLAUDE.md` with full project spec

### Session 3 — Database, Sync & Middleware Fix

**Files created:**
- `src/db/schema.ts` — `users`, `sessions`, `reports` tables via Drizzle ORM. `clerk_id` is `varchar(255)` (Clerk IDs are strings like `user_xxxxxxx`, NOT UUIDs)
- `src/db/index.ts` — Neon HTTP client + Drizzle db instance export
- `drizzle.config.ts` — points to schema, reads `DATABASE_URL` from `.env`
- `src/app/api/auth/sync/route.ts` — POST endpoint that upserts Clerk user into Neon. Accepts `{ email, name }` in request body — does NOT call `currentUser()` to avoid a second Clerk API round-trip
- `src/middleware.ts` — Clerk middleware moved here from root (see bug fix below)

**Files modified:**
- `src/app/page.tsx` — Added `useEffect` that calls `POST /api/auth/sync` with user data from `useUser()` as soon as `isSignedIn && user` is true. Fires immediately on landing after sign-up/sign-in
- `src/app/dashboard/page.tsx` — Added inline Neon upsert as a fallback sync on dashboard visit

**Schema pushed to Neon:** `npx drizzle-kit push` — all 3 tables live

**Bugs fixed this session:**

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Users table empty after Clerk sign-up | Sync only ran on dashboard visit, not on landing page | Added `useEffect` in `page.tsx` to call `/api/auth/sync` immediately after sign-in |
| `/api/auth/sync` returning 500 — `currentUser()` failing silently | `currentUser()` makes a second server→Clerk API call that was failing in local dev | Removed `currentUser()`. Client sends `email`+`name` in POST body (from `useUser()`), server only calls `auth()` to verify session |
| `Clerk: clerkMiddleware() was not run` — 500 on all auth checks | `middleware.ts` was at project root `./middleware.ts` but Next.js with `src/` layout requires it at `./src/middleware.ts` | Moved middleware to `src/middleware.ts`, deleted root-level file |

**Key lesson:** With a `src/` directory layout in Next.js, middleware MUST be at `src/middleware.ts` — placing it at the project root silently breaks all Clerk auth in API routes.

---

### Session 2 — Landing Page & Dashboard
**Files created/modified:**
- `src/app/globals.css` — Added TutorTalk design tokens + all keyframe animations (orb-breathe, orb-speak, pulse-ring, teal-ring, amber-flash, blob-drift, float-y, chip-float, live-pulse, gradient-shift, eq-wave, page-fade) + utility classes (`.cta-btn`, `.gradient-text`, `.live-dot`, `.eq-bar`, `.page-in`)
- `src/app/layout.tsx` — Added Poppins font (weights 400–800) alongside Inter; added Cloudinary logo as favicon via `metadata.icons`; `favicon.ico` replaced with actual logo PNG
- `src/components/VoiceOrb.tsx` — Animated voice orb component (idle/listening/speaking/interrupted states), EQ bars, pulse rings
- `src/app/page.tsx` — Full landing page (Client Component): animated hero orb cycling through states, welcome-back message for signed-in users, subject chips, 3-column features, testimonials with float animation, gradient footer CTA. Uses `useAuth` + `useUser` from Clerk. No black/white/blue colors anywhere.
- `src/app/dashboard/page.tsx` — Server Component fetching `currentUser()` from Clerk, redirects to `/` if not authenticated
- `src/app/dashboard/DashboardClient.tsx` — Dashboard UI: metric cards (Total sessions, Topics covered, Minutes learned), past sessions list with Download PDF toggle, bottom CTA card

**Auth integration:**
- Nav shows Sign in button (logged out) or Dashboard link + New session + UserButton (logged in)
- Hero shows "Welcome back, {firstName}!" pill when signed in
- Clerk version is v7 — uses `useAuth`, `useUser`, `SignInButton`, `SignUpButton`, `UserButton` (no `SignedIn`/`SignedOut` components — they don't exist in v7)
- `currentUser()` from `@clerk/nextjs/server` used in Server Components

**Design rules enforced (no exceptions):**
- Background: `#FFFBF7` warm cream
- Headings: `#4A1B0C` dark warm brown
- Body text: `#993C1D` warm brown
- Primary buttons: gradient `#D85A30 → #EF9F27` (`.cta-btn` class)
- Button text: `#FFFBF7` on gradient — never pure white/black/blue
- Cards: `#FFF8F3` warm off-white surface

**Logo:**
- Cloudinary URL: `https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1776668144/logotutortalk_ecmdbm.png`
- Used in nav (both landing + dashboard) as `<img>` tag
- Also used as `favicon.ico` (PNG downloaded and saved over the default Next.js favicon)

---


# TutorTalk — Live Voice AI Tutor

AI-powered Socratic voice tutor. Students speak their doubts, the AI guides them to answers through questions — never just giving them away. Sessions end with a downloadable PDF report.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.4 (App Router) |
| Styling | Tailwind CSS v4 |
| Auth | Clerk |
| Database | Neon PostgreSQL (serverless) |
| ORM | Drizzle ORM |
| AI Voice | Gemini Live API — `gemini-3.1-flash-live-preview` |
| AI Text | Gemini API — `gemini-3.1-flash-live-preview` (PDF summary generation) |
| PDF Generation | @react-pdf/renderer |
| File Storage | Cloudinary |
| Deployment | Vercel |

---

## Pre-installed Packages (Beyond Spec)

| Package | Version | Use For |
|---------|---------|---------|
| `shadcn/ui` | — | 17 UI components in `src/components/ui/` (Button, Card, Dialog, Input, Select, Tabs, Badge, Avatar, etc.) |
| `framer-motion` | ^12 | VoiceOrb animations (breathe, pulse rings, equalizer bars) |
| `lucide-react` | ^1.8 | Icons throughout the UI |
| `zod` | ^4 | Form/input validation |

---

## Architecture Overview

TutorTalk uses a browser-direct WebSocket approach — the gold standard for low-latency voice apps per Google's official documentation.

```
Student Browser
│
├─► POST /api/token (Vercel)          ← Clerk auth check + ephemeral token generation
│   └── returns short-lived token
│
└─► WebSocket (wss://generativelanguage.googleapis.com)  ← DIRECT, bypasses Vercel
    ├── Setup message (model + system instruction + Google Search tool)
    ├── realtimeInput chunks (PCM16 audio at 16kHz via AudioWorklet)
    └── serverContent chunks (PCM16 audio at 24kHz → AudioContext playback)

Post-session:
Browser → POST /api/session/save → Neon (transcript + metadata)
Server  → POST /api/session/report → Gemini text → PDF → Cloudinary → Neon (pdf_url)
```

**Why browser-direct?**
- Vercel never touches the audio stream — zero timeout risk
- One fewer hop = lowest possible latency
- Google's officially recommended production pattern
- Security handled by ephemeral tokens (master API key stays server-only)

---

## Gemini Model: `gemini-3.1-flash-live-preview`

- Latest and recommended model for all Gemini Live API use cases (April 2026)
- 128k context window
- Native audio in + audio out (no separate STT/TTS pipeline)
- Built-in barge-in and voice activity detection
- `thinkingLevel: "minimal"` — keeps latency lowest for real-time conversation
- Google Search grounding enabled via `{ google_search: {} }` in tools array
- All older models (`gemini-2.0-flash-live-001`, `gemini-2.5-flash-native-audio-preview-12-2025`) are deprecated and shutting down

---

## Audio Specifications

| Direction | Format | Sample Rate | Channels |
|-----------|--------|-------------|----------|
| Input (mic → Gemini) | PCM 16-bit | 16 kHz | Mono |
| Output (Gemini → browser) | PCM 16-bit | 24 kHz | Mono |

Audio is **Base64-encoded inside JSON** — never raw binary over the WebSocket.

---

## Database Schema

### users
```sql
id          uuid        PRIMARY KEY DEFAULT gen_random_uuid()
clerk_id    varchar(255) UNIQUE NOT NULL
email       varchar(255) UNIQUE NOT NULL
name        varchar(255)
created_at  timestamp   DEFAULT now()
```

### sessions
```sql
id            uuid        PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid        REFERENCES users(id)
subject       varchar(255) NOT NULL
transcript    text
duration_secs integer
started_at    timestamp   NOT NULL
ended_at      timestamp
```

### reports
```sql
id           uuid      PRIMARY KEY DEFAULT gen_random_uuid()
session_id   uuid      REFERENCES sessions(id)
pdf_url      text      NOT NULL
summary      text
generated_at timestamp DEFAULT now()
```

---

## Project Structure

```
tutortalk/
├── public/
│   └── worklets/
│       └── capture-processor.js      ← AudioWorklet (MUST be in public/, not src/)
├── src/
│   ├── app/
│   │   ├── layout.tsx                ← ClerkProvider wraps everything
│   │   ├── page.tsx                  ← Landing page
│   │   ├── dashboard/
│   │   │   └── page.tsx              ← Past sessions list (Server Component)
│   │   ├── session/
│   │   │   └── page.tsx              ← Live voice session UI
│   │   └── api/
│   │       ├── token/route.ts        ← Ephemeral token endpoint
│   │       ├── session/
│   │       │   ├── save/route.ts     ← Save session + transcript to Neon
│   │       │   └── report/route.ts   ← Generate PDF + upload to Cloudinary
│   │       └── auth/sync/route.ts    ← Lazy Clerk → Neon user sync
│   ├── components/
│   │   ├── VoiceOrb.tsx              ← Animated orb, accepts state prop
│   │   ├── SubjectPicker.tsx         ← Pill grid with pastel colors
│   │   ├── TranscriptPanel.tsx       ← Live scrolling transcript
│   │   ├── SessionTimer.tsx          ← Live MM:SS counter
│   │   └── MetricCard.tsx            ← Stat display card
│   ├── db/
│   │   ├── index.ts                  ← Neon client + Drizzle db instance
│   │   └── schema.ts                 ← Table definitions
│   ├── lib/
│   │   ├── audioQueue.ts             ← Playback queue manager (gapless audio)
│   │   └── websocket.ts              ← WebSocket connection + message handlers
│   └── middleware.ts                 ← Clerk route protection (MUST be in src/, not root)
├── drizzle.config.ts
└── .env                              ← Environment variables (NOT .env.local)
```

---

## Environment Variables

File is **`.env`** (not `.env.local`) — already exists in project root.

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Gemini — NEVER add NEXT_PUBLIC_ prefix, server-only
GEMINI_API_KEY=        ← already has a value

# Neon
DATABASE_URL=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

`GEMINI_API_KEY` must stay server-side only. The browser only ever receives short-lived ephemeral tokens — never the master key.

---

## Install Commands

```bash
# Fix: remove deprecated SDK, add correct one + PDF renderer
npm uninstall @google/generative-ai
npm install @google/genai @react-pdf/renderer

# Dev dependency
npm install -D drizzle-kit

# Apply schema to Neon
npx drizzle-kit push
```

> Use `@google/genai` — the new unified SDK. The legacy `@google/generative-ai` is deprecated and was pre-installed by mistake.

---

## Step-by-Step Build Order

### Phase 1 — Foundation
- Update `src/app/layout.tsx` — add `<ClerkProvider>`, TutorTalk metadata, Inter font, warm cream background
- Create `middleware.ts` — protect `/dashboard` and `/session` with Clerk
- Update `src/app/globals.css` — add TutorTalk design tokens

### Phase 2 — Database
- Create `src/db/schema.ts` — users, sessions, reports tables
- Create `src/db/index.ts` — Neon client + Drizzle db export
- Create `drizzle.config.ts` — schema path + DATABASE_URL
- Run `npx drizzle-kit push`

### Phase 3 — API Routes
- `src/app/api/auth/sync/route.ts` — lazy Clerk→Neon user upsert
- `src/app/api/token/route.ts` — verify Clerk session → Google token exchange → return ephemeral token
- `src/app/api/session/save/route.ts` — insert session + transcript into Neon
- `src/app/api/session/report/route.ts` — Gemini text → PDF → Cloudinary → reports table

### Phase 4 — AudioWorklet
- Create `public/worklets/capture-processor.js`
  - Extend `AudioWorkletProcessor`
  - Convert Float32 → Int16Array (multiply by 32767, clamp)
  - Post chunks via `this.port.postMessage()`

### Phase 5 — WebSocket Setup Message
```json
{
  "setup": {
    "model": "models/gemini-3.1-flash-live-preview",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "thinkingConfig": { "thinkingBudget": 0 }
    },
    "tools": [{ "google_search": {} }],
    "systemInstruction": {
      "parts": [{ "text": "You are a patient Socratic tutor for [subject]. Never give direct answers..." }]
    }
  }
}
```

### Phase 6 — Audio Playback
- Loop through ALL parts in each `serverContent` event (audio + transcript can arrive together)
- Decode Base64 → ArrayBuffer → AudioBuffer at 24000 Hz
- Push to `lib/audioQueue.ts` for gapless sequential playback
- Capture `inputTranscription` and `outputTranscription` → build transcript array

### Phase 7 — Barge-In
- Watch for `interrupted: true` in `serverContent`
- On interrupt: clear playback queue + stop current `AudioBufferSourceNode`

### Phase 8 — Session Save + PDF
- End Session: close WebSocket → POST transcript to `/api/session/save`
- `/api/session/save`: insert into Neon sessions table, return `session_id`
- `/api/session/report`: transcript → Gemini → PDF → Cloudinary → reports table → return PDF URL

### Phase 9 — Dashboard
- Server Component — fetch user's sessions from Neon
- Show: subject pill, date, duration, Download PDF button linked to Cloudinary URL

### Phase 10 — Deploy
- Push to GitHub → connect repo in Vercel dashboard
- Add all `.env` variables in Vercel project settings

---

## Key Technical Rules

### AudioWorklet
- Always use `AudioWorkletProcessor` — `ScriptProcessorNode` is deprecated and blocks the main thread
- Worklet file **MUST** live in `public/` — it cannot be imported as an ES module
- Reference as absolute path: `"/worklets/capture-processor.js"`

### WebSocket Messages — Critical Distinction

| Message Type | When to Use |
|-------------|-------------|
| `realtimeInput` | Streaming live audio chunks during conversation |
| `clientContent` | Only for seeding initial context history at session start |
| `toolResponse` | When responding to model's function calls |

**Mixing `realtimeInput` and `clientContent` causes the model to not respond — common bug.**

### AudioContext Autoplay
- `new AudioContext()` inside a `useEffect` = silently blocked by Chrome
- `new AudioContext()` inside `onClick` handler = works correctly
- **This is non-negotiable browser policy**

### Server Events — Gemini 3.1 Change
A single `BidiGenerateContentServerContent` event can contain multiple parts simultaneously (audio chunk + transcript text in the same event). **Always loop through all parts — do not stop at the first one.**

### Ephemeral Tokens
- Generate fresh token on every new session start
- Never reuse tokens across sessions
- Never cache tokens on the client beyond the current session

### Google Search Grounding
- Add `{ "google_search": {} }` to tools in the setup message
- Gemini auto-decides when to trigger search — no per-turn control needed
- Billing: per search query executed, not per session
- Bridges the January 2025 training cutoff for current exam info, syllabus changes, etc.

---

## Design System

### Color Palette — warm, student-friendly, no dark/cold colors

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#FFFBF7` | Page background (warm cream) |
| Primary CTA | `#D85A30` | Buttons, voice orb (gradient) |
| Student accent | `#7F77DD` | Student message bubbles, highlights |
| Tutor accent | `#F0997B` | Tutor message bubbles |
| Success | `#1D9E75` | Session active, correct answer states |
| Live indicator | `#D4537E` | Pulsing dot when session is active |
| Headings | `#26215C` | Deep warm violet, never black |
| Body text | `#993C1D` | Warm brown, never pure black |
| Accent | `#EF9F27` | Highlights, orb glow |

### CSS Design Tokens (globals.css)
```css
:root {
  --tt-bg: #FFFBF7;
  --tt-cta: #D85A30;
  --tt-student: #7F77DD;
  --tt-tutor: #F0997B;
  --tt-success: #1D9E75;
  --tt-live: #D4537E;
  --tt-heading: #26215C;
  --tt-body: #993C1D;
  --tt-accent: #EF9F27;
}
```

### Voice Orb States
- `idle` → slow breathe animation (scale 1 → 1.06)
- `listening` → teal pulse rings
- `speaking` → coral pulse rings + equalizer bars waving
- `interrupted` → amber flash

### Font
Poppins or Inter — rounded, friendly, **never serif**

---

## Common Bugs and Fixes

| Bug | Fix |
|-----|-----|
| WebSocket closes immediately | Check `GEMINI_API_KEY` is valid, model string is exactly `gemini-3.1-flash-live-preview` |
| Audio sounds garbled | Input must be PCM16 at exactly 16kHz mono. Confirm worklet outputs `Int16Array` not `Float32Array` |
| AI does not respond to voice | Use `realtimeInput` not `clientContent` for audio. Check Base64 encoding is correct |
| AudioContext blocked | Move `new AudioContext()` inside the button `onClick` handler |
| AudioWorklet fails to load | File must be in `public/` folder, referenced as absolute path `/worklets/...` |
| Missing transcript | Loop through ALL parts in each server event — audio + transcript arrive together |
| PDF fails on Vercel | `@react-pdf/renderer` must be a regular dependency, not devDependency |

---

## Real-World Problems Solved

1. **Tutor access gap** — Quality 1-on-1 tutoring costs ₹500–2000/hr and is unavailable in Tier 2/3 cities. TutorTalk provides 24/7 Socratic guidance at a fraction of the cost.
2. **Passive learning** — Unlike video platforms, voice forces active engagement. The student must articulate what they know.
3. **Availability** — Students study late at night and on weekends. TutorTalk is always on, infinitely patient, never frustrated.
4. **Language barrier** — Gemini Live supports 70+ languages including Hindi, Telugu, Tamil — real-time regional language tutoring.
5. **Knowledge retention** — Auto-generated PDF session reports reinforce learning after the session ends.

---

## Google Search Grounding — How It Works

1. Student asks a question
2. Gemini analyzes if a web search would improve accuracy
3. If yes → Google Search executes automatically (server-side, no code needed)
4. Gemini synthesizes results into a natural spoken response
5. Grounding metadata (sources, citations) available in the response

**What this unlocks:**
- Current JEE/NEET exam patterns and syllabus
- Recent discoveries in science
- Up-to-date factual answers beyond January 2025 training cutoff
- Significantly reduced hallucinations on factual questions

---

## Useful References
- Gemini Live API docs
- Gemini 3.1 Flash Live Preview
- Live API Tool Use + Google Search
- Ephemeral Tokens guide
- WebSockets API reference
- Clerk Next.js docs
- Drizzle ORM + Neon
- @react-pdf/renderer
- Cloudinary Node.js SDK
