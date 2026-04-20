### Skill
For ALL frontend/UI work — landing page, dashboard, components, emails — use the skill at:
`C:\Users\ES\.claude\skills\nextstack.skill`

TutorTalk — Live Voice AI Tutor
AI-powered Socratic voice tutor. Students speak their doubts, the AI guides them to answers
through questions — never just giving them away. Sessions end with a downloadable PDF
report.

Tech Stack
Layer

Technology

Framework

Next.js 15 (App Router)

Styling

Tailwind CSS

Auth

Clerk

Database

Neon PostgreSQL (serverless)

ORM

Drizzle ORM

AI Voice

Gemini Live API — gemini-3.1-flash-live-preview

AI Text

Gemini API — gemini-3.1-flash-live-preview (for PDF summary generation)

PDF Generation

@react-pdf/renderer

File Storage

Cloudinary

Deployment

Vercel

Architecture Overview
TutorTalk uses a browser-direct WebSocket approach — the gold standard for low-latency voice
apps per Google's official documentation.

Student Browser
│
├─► POST /api/token (Vercel)
← Clerk auth check + ephemeral token
generation
│
└── returns short-lived token
│
└─► WebSocket (wss://generativelanguage.googleapis.com) ← DIRECT, bypasses
Vercel
│
├── Setup message (model + system instruction + Google Search tool)
├── realtimeInput chunks (PCM16 audio at 16kHz via AudioWorklet)
└── serverContent chunks (PCM16 audio at 24kHz → AudioContext
playback)
Post-session:
Browser → POST /api/session/save → Neon (transcript + metadata)
Server → POST /api/session/report → Gemini text → PDF → Cloudinary → Neon
(pdf_url)

Why browser-direct?
Vercel never touches the audio stream — zero timeout risk
One fewer hop = lowest possible latency
Google's officially recommended production pattern
Security handled by ephemeral tokens (master API key stays server-only)

Gemini Model
gemini-3.1-flash-live-preview

Latest and recommended model for all Gemini Live API use cases (April 2026)
128k context window
Native audio in + audio out (no separate STT/TTS pipeline)
Built-in barge-in and voice activity detection
thinkingLevel: "minimal" — keeps latency lowest for real-time conversation

Google Search grounding enabled via { google_search: {} } in tools array
All older models ( gemini-2.0-flash-live-001 , gemini-2.5-flash-native-audiopreview-12-2025 ) are deprecated and shutting down.

Audio Specifications
Direction

Format

Sample Rate

Channels

Input (mic → Gemini)

PCM 16-bit

16 kHz

Mono

Output (Gemini → browser)

PCM 16-bit

24 kHz

Mono

Audio is Base64-encoded inside JSON — never raw binary over the WebSocket.

Database Schema
users
sql

id
uuid
PRIMARY KEY DEFAULT gen_random_uuid()
clerk_id
varchar(255) UNIQUE NOT NULL
email
varchar(255) UNIQUE NOT NULL
name
varchar(255)
created_at timestamp
DEFAULT now()

sessions
sql

id
uuid
PRIMARY KEY DEFAULT gen_random_uuid()
user_id
uuid
REFERENCES users(id)
subject
varchar(255) NOT NULL
transcript
text
duration_secs integer
started_at
timestamp
NOT NULL
ended_at
timestamp

reports
sql

id
uuid
session_id uuid
pdf_url
text
summary
text
generated_at timestamp

PRIMARY KEY DEFAULT gen_random_uuid()
REFERENCES sessions(id)
NOT NULL
DEFAULT now()

Project Structure
tutortalk/
├── public/
│ └── worklets/
│
└── capture-processor.js
├── src/
│ ├── app/
│ │ ├── layout.tsx
│ │ ├── page.tsx
│ │ ├── dashboard/
│ │ │ └── page.tsx
│ │ ├── session/
│ │ │ └── page.tsx
│ │ └── api/
│ │
├── token/
│ │
│ └── route.ts
│ │
├── session/
│ │
│ ├── save/
│ │
│ │ └── route.ts
│ │
│ └── report/
│ │
│
└── route.ts
│ │
└── auth/
│ │
└── sync/
│ │
└── route.ts
│ ├── components/
│ │ ├── VoiceOrb.tsx
│ │ ├── SubjectPicker.tsx
│ │ ├── TranscriptPanel.tsx
│ │ ├── SessionTimer.tsx
│ │ └── MetricCard.tsx
│ ├── db/
│ │ ├── index.ts
│ │ └── schema.ts
│ └── lib/
│
├── audioQueue.ts
│
└── websocket.ts
├── drizzle.config.ts
├── middleware.ts
└── .env.local

← AudioWorklet (MUST be in public/, not src/)

← ClerkProvider wraps everything
← Landing page
← Past sessions list (Server Component)
← Live voice session UI

← Ephemeral token endpoint

← Save session + transcript to Neon
← Generate PDF + upload to Cloudinary

← Lazy Clerk → Neon user sync
← Animated orb, accepts state prop
← Pill grid with pastel colors
← Live scrolling transcript
← Live MM:SS counter
← Stat display card
← Neon client + Drizzle db instance
← Table definitions
← Playback queue manager (gapless audio)
← WebSocket connection + message handlers
← Clerk route protection
← See Environment Variables section

Environment Variables
env

# Clerk
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
# Gemini — NEVER add NEXT_PUBLIC_ prefix, server-only
GEMINI_API_KEY=
# Neon
DATABASE_URL=
# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

GEMINI_API_KEY must stay server-side only. The browser only ever receives short-lived

ephemeral tokens — never the master key.

Install Commands
bash

# Core dependencies
npm install @clerk/nextjs drizzle-orm @neondatabase/serverless @google/genai @react# Dev dependencies
npm install -D drizzle-kit
# Database — push schema to Neon
npx drizzle-kit push

Use @google/genai — the new unified SDK. The legacy @google/generative-ai is
deprecated.

Step-by-Step Build Order
Phase 1 — Foundation
Scaffold: npx create-next-app@latest tutortalk --typescript --tailwind --app

Install all packages (see above)
Set up .env.local with all environment variables
Wrap app/layout.tsx with <ClerkProvider>
Add middleware.ts to protect /dashboard and /session
Phase 2 — Database
Define 3 tables in src/db/schema.ts (users, sessions, reports)
Set up Neon client in src/db/index.ts
Run npx drizzle-kit push to apply schema
Create /api/auth/sync — lazy Clerk → Neon user sync on first login
Phase 3 — Ephemeral Token
Build /api/token/route.ts
Verify Clerk session with auth() from @clerk/nextjs/server
Call Google's token exchange using GEMINI_API_KEY
Return short-lived token to browser
Phase 4 — AudioWorklet
Create public/worklets/capture-processor.js
Extend AudioWorkletProcessor
Convert Float32 → Int16Array (multiply by 32767, clamp)
Post chunks back via this.port.postMessage()
In session page: audioContext.audioWorklet.addModule('/worklets/captureprocessor.js')

On worklet message: Base64-encode Int16Array → send as realtimeInput WebSocket
message
Phase 5 — WebSocket Session
On "Start Session" button click (user gesture required):
Init AudioContext (MUST be inside onClick — browser autoplay policy)
Fetch ephemeral token from /api/token
Open WebSocket to Gemini Live endpoint with token
Send setup message on onopen :
json

{
"setup": {
"model": "models/gemini-3.1-flash-live-preview",
"generationConfig": {
"responseModalities": ["AUDIO"],
"thinkingConfig": { "thinkingBudget": 0 }
},
"tools": [{ "google_search": {} }],
"systemInstruction": {
"parts": [{
"text": "You are a patient Socratic tutor for [subject]. Never give dire
}]
}
}
}

Phase 6 — Audio Playback
In onmessage handler: loop through ALL parts in each event (audio + transcript can arrive
together)
For inlineData parts: decode Base64 → ArrayBuffer → AudioBuffer at 24000 Hz
Push to playback queue in lib/audioQueue.ts for gapless sequential playback
Capture inputTranscription and outputTranscription events → build transcript array
Phase 7 — Barge-In
Watch for interrupted: true in serverContent
On interrupt: clear playback queue + stop current AudioBufferSourceNode
Resume mic streaming — conversation continues naturally
Phase 8 — Session Save + PDF
"End Session" button: close WebSocket, POST transcript to /api/session/save
/api/session/save : insert into Neon sessions table, return session_id
/api/session/report :
Fetch transcript from Neon
Call gemini-3.1-flash-live-preview (regular REST generateContent) to generate
structured learning summary
Render PDF with @react-pdf/renderer
Upload to Cloudinary ( resource_type: 'raw' , folder: 'tutortalk/reports' )
Insert PDF URL into Neon reports table
Return PDF URL to browser

Server Component — fetch user's sessions from Neon
Show: subject pill, topic, date, duration, Download PDF button
Link PDF button to Cloudinary URL
Phase 10 — Deploy
Push to GitHub
Connect repo in Vercel dashboard
Add all .env.local variables in Vercel project settings
Deploy — no special config needed

Key Technical Rules
AudioWorklet
Always use AudioWorkletProcessor — ScriptProcessorNode is deprecated and blocks
the main thread
Worklet file MUST live in public/ — it cannot be imported as an ES module
Reference as absolute path: "/worklets/capture-processor.js"
WebSocket Messages — Critical Distinction
Message Type

When to Use

realtimeInput

Streaming live audio chunks during conversation

clientContent

Only for seeding initial context history at session start

toolResponse

When responding to model's function calls

Mixing realtimeInput and clientContent causes the model to not respond — common bug.
AudioContext Autoplay
new AudioContext() inside a useEffect = silently blocked by Chrome
new AudioContext() inside onClick handler = works correctly

This is non-negotiable browser policy
Server Events — Gemini 3.1 Change
A single BidiGenerateContentServerContent event can contain multiple parts simultaneously
(audio chunk + transcript text in the same event). Always loop through all parts — do not stop at

the first one.
Ephemeral Tokens
Generate fresh token on every new session start
Never reuse tokens across sessions
Never cache tokens on the client beyond the current session
Google Search Grounding
Add { "google_search": {} } to tools in the setup message
Gemini auto-decides when to trigger search — no per-turn control needed
Billing: per search query executed, not per session
Bridges the January 2025 training cutoff for current exam info, syllabus changes, etc.

Common Bugs and Fixes
Bug

Fix

WebSocket closes
immediately

Check GEMINI_API_KEY is valid, model string is exactly gemini-3.1flash-live-preview

Audio sounds garbled

Input must be PCM16 at exactly 16kHz mono. Confirm worklet outputs
Int16Array not Float32Array

AI does not respond to
voice

Use realtimeInput not clientContent for audio. Check Base64
encoding is correct

AudioContext blocked

Move new AudioContext() inside the button onClick handler

AudioWorklet fails to
load

File must be in public/ folder, referenced as absolute path
/worklets/...

Missing transcript

Loop through ALL parts in each server event — audio + transcript arrive
together

PDF fails on Vercel

@react-pdf/renderer must be a regular dependency, not
devDependency

Design System
Palette — warm, student-friendly, no dark/cold colors:
Token

Hex

Usage

Background

#FFFBF7

Primary CTA

#D85A30 →

Student accent

#7F77DD

Student message bubbles, highlights

Tutor accent

#F0997B

Tutor message bubbles

Success

#1D9E75

Session active, correct answer states

Live indicator

#D4537E

Pulsing dot when session is active

Headings

#26215C

Deep warm violet, never black

Body text

#993C1D

Warm brown, never pure black

Page background (warm cream)

#EF9F27

Buttons, voice orb (gradient)

Voice Orb States:
idle → slow breathe animation (scale 1 → 1.06)
listening → teal pulse rings
speaking → coral pulse rings + equalizer bars waving
interrupted → amber flash

Font: Poppins or Inter — rounded, friendly, never serif

Real-World Problems Solved
1. Tutor access gap — Quality 1-on-1 tutoring costs ₹500–2000/hr and is unavailable in Tier
2/3 cities. TutorTalk provides 24/7 Socratic guidance at a fraction of the cost.
2. Passive learning — Unlike video platforms, voice forces active engagement. The student
must articulate what they know and the AI responds to exactly that.
3. Availability — Students study late at night and on weekends. TutorTalk is always on,
infinitely patient, never frustrated.
4. Language barrier — Gemini Live supports 70+ languages including Hindi, Telugu, Tamil —
real-time regional language tutoring.
5. Knowledge retention — Auto-generated PDF session reports reinforce learning after the
session ends.

Google Search Grounding — How It Works
When { "google_search": {} } is in the tools array of the setup message:
1. Student asks a question
2. Gemini analyzes if a web search would improve accuracy
3. If yes → Google Search executes automatically (server-side, no code needed)
4. Gemini synthesizes results into a natural spoken response
5. Grounding metadata (sources, citations) available in the response
What this unlocks:
Current JEE/NEET exam patterns and syllabus
Recent discoveries in science
Up-to-date factual answers beyond January 2025 training cutoff
Significantly reduced hallucinations on factual questions

Useful References
Gemini Live API docs
Gemini 3.1 Flash Live Preview
Live API Tool Use + Google Search
Ephemeral Tokens guide
WebSockets API reference
Clerk Next.js docs
Drizzle ORM + Neon
@react-pdf/renderer
Cloudinary Node.js SDK

