# Local Deployment Guide: TutorTalk (Voice-Based AI App)

This guide provides the steps to deploy and run TutorTalk on your local machine using VS Code and Claude Code.

## 📋 Prerequisites
- **Node.js**: Version 18 or higher.
- **API Key**: A Google Gemini API key (get it from [Google AI Studio](https://aistudio.google.com/app/apikey)).
- **Browser**: A modern browser (Chrome or Edge recommended) for Web Audio API support.

## 🚀 Setup Instructions

### 1. Clone/Copy Files
Copy the following project structure to your local directory:
- `assets/` (if any)
- `public/` (Contains the critical `capture-processor.js`)
- `src/` (All React components and CSS)
- `package.json`
- `server.ts`
- `vite.config.ts`
- `tsconfig.json`
- `.env`

### 2. Install Dependencies
Open your terminal in VS Code and run:
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory and add your Gemini API Key:
```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 4. Running the App
Since this is a full-stack app using an Express server for the WebSocket environment:
```bash
npm run dev
```
The app will typically be available at `http://localhost:3000`.

## 🤖 Using Claude Code for Improvements
If you have **Claude Code** installed in your CLI/VS Code, you can use it to iterate on this app. Here are some prompt examples:

- **To fix bugs**: `claude "Analyze App.tsx and fix any potential memory leaks in the AudioContext implementation."`
- **To add features**: `claude "Add a button to clear the live transcript and reset the session state."`
- **To refactor**: `claude "Extract the Gemini Live API connection logic into a custom React hook named useGeminiLive."`

## ⚠️ Critical Local Notes
- **HTTPS/Localhost**: Browsers only allow microphone access on `localhost` or via `https`. If you access the server via an IP address (e.g., `192.168.1.5`), the mic will be blocked.
- **Audio Worklets**: Ensure the `/public/worklets/capture-processor.js` file is correctly placed, as the app fetches this file at runtime to process your voice.
- **Dependencies**: Ensure `@google/genai` is version `0.21.0` or higher to ensure `live.connect` is available.

---
*Happy Learning with TutorTalk!*
