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

AI-powered Socratic voice tutor. Students speak; the AI guides them to answers through questions — never giving answers directly. Sessions end with a downloadable PDF summary.

---

## Architecture

### Data flow
```
Browser → POST /api/token       → Clerk auth check, returns GEMINI_API_KEY
Browser → WebSocket (direct)    → wss://generativelanguage.googleapis.com (Gemini Live)
Browser → POST /api/session/save → Neon (transcript + metadata)
Server  → POST /api/session/report → Gemini text → PDF → Cloudinary → Neon (pdf_url)
```

The WebSocket connects **browser-direct** to Google — Vercel never proxies audio. This is intentional: Vercel's 10s timeout would kill long sessions.

### Key files
| File | Role |
|------|------|
| `src/app/session/page.tsx` | Full voice session UI — WebSocket, AudioWorklet, transcript, orb |
| `src/app/dashboard/page.tsx` | Server Component — fetches sessions + PDF URLs from Neon |
| `src/app/dashboard/DashboardClient.tsx` | Client UI for dashboard |
| `src/app/api/token/route.ts` | Returns `GEMINI_API_KEY` to authenticated users |
| `src/app/api/session/save/route.ts` | Saves transcript + metadata to Neon |
| `src/app/api/session/report/route.tsx` | Gemini → PDF → Cloudinary → Neon (.tsx for JSX) |
| `src/app/api/auth/sync/route.ts` | Upserts Clerk user into Neon `users` table |
| `src/db/schema.ts` | Drizzle schema: `users`, `sessions`, `reports` |
| `src/lib/audioQueue.ts` | Gapless PCM16 playback via scheduled AudioBufferSourceNodes |
| `public/worklets/capture-processor.js` | AudioWorklet: Float32 → Int16 mic capture |
| `src/middleware.ts` | Clerk route protection — MUST be at `src/`, not project root |

---

## Critical Rules

### Clerk
- Version is **v7** — use `useAuth`, `useUser`, `auth()`. No `SignedIn`/`SignedOut` components (don't exist in v7).
- `currentUser()` makes an extra server→Clerk round-trip that fails in local dev — avoid it in API routes. Use `auth()` only, and have the client send user data in the request body.
- Middleware MUST be at `src/middleware.ts`. Placing it at the project root silently breaks all Clerk auth.
- Clerk IDs are strings like `user_xxxxxxx` — `clerk_id` is `varchar(255)`, NEVER uuid.

### Gemini Live API — WebSocket setup message
```json
{
  "setup": {
    "model": "models/gemini-3.1-flash-live-preview",
    "generationConfig": {
      "responseModalities": ["AUDIO", "TEXT"]
    },
    "tools": [{ "googleSearch": {} }],
    "systemInstruction": {
      "parts": [{ "text": "..." }]
    }
  }
}
```
- `responseModalities` must include **both** `"AUDIO"` and `"TEXT"` — omitting `"TEXT"` causes 1007 disconnect.
- Tools key is `googleSearch` (camelCase) — `google_search` (snake_case) causes 1007.
- `thinkingConfig` / `thinkingBudget` are NOT supported by the Live API — causes 1007.
- Any unknown field in `generationConfig` causes immediate 1007 disconnect.

### WebSocket message types
| Type | When |
|------|------|
| `realtimeInput` | Streaming live mic audio chunks |
| `clientContent` | Only for seeding initial history |
| `toolResponse` | Responding to model function calls |

**Mixing `realtimeInput` and `clientContent` causes the model to not respond.**

### Audio
- Input: PCM16 at **16 kHz** mono. AudioWorklet converts Float32→Int16 in `public/worklets/capture-processor.js`.
- Output: PCM16 at **24 kHz**. Decode via `AudioContext({ sampleRate: 24000 })`.
- Two separate AudioContexts — do not share them.
- Both AudioContexts must be created inside an `onClick` handler (not `useEffect`) — Chrome blocks autoplay.
- Base64 encode mic chunks with: `btoa(String.fromCharCode(...new Uint8Array(buf)))` — the manual loop approach corrupts large chunks.
- AudioWorklet file MUST live in `public/` and be referenced as `/worklets/capture-processor.js` (absolute path).

### Server events — loop through ALL parts
A single `serverContent` event can contain audio + transcript simultaneously. Always loop through `modelTurn.parts` — never stop at the first part.

### PDF route
- `src/app/api/session/report/route.tsx` — must be `.tsx` (uses JSX for `@react-pdf/renderer`).
- Has `export const maxDuration = 60; export const runtime = "nodejs"` at top.
- Cloudinary upload uses `resource_type: 'raw'` and base64 data URI.
- Session save fires PDF generation with `keepalive: true` so it completes after navigation.

### SDK
Use `@google/genai` (new unified SDK). `@google/generative-ai` is deprecated.

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
| 1007 on session start | Unknown field in setup `generationConfig` | Check for `thinkingConfig`, snake_case tool keys, missing `TEXT` in modalities |
| `clerkMiddleware() was not run` | `middleware.ts` at project root | Move to `src/middleware.ts` |
| Users table empty after sign-up | Sync only ran on dashboard visit | `useEffect` in `page.tsx` fires `POST /api/auth/sync` on `isSignedIn && user` |
| AI doesn't respond to voice | `clientContent` used instead of `realtimeInput` | Switch to `realtimeInput` for all mic audio |
| AudioContext blocked silently | Created in `useEffect` | Move to `onClick` handler |
| Garbled audio | Float32 sent instead of Int16 | Verify worklet outputs `Int16Array` |
| PDF fails on Vercel | `@react-pdf/renderer` in devDependencies | Move to regular dependencies |
