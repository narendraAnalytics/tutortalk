# TutorTalk: Building a Voice-First AI Tutor with Gemini Live API

This document outlines the technical implementation and successful integration of the **Gemini Live API** using the `@google/genai` SDK for real-time, low-latency voice interactions.

## 🚀 Core Technologies
- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS (Clean Minimalism Theme)
- **AI Model**: `gemini-3.1-flash-live-preview`
- **SDK**: `@google/genai` (v0.21.0+)
- **Audio Stack**: Web Audio API (AudioContext, AudioWorklet)

## 📦 Required Dependencies

To build a similar voice-based application, you need the following packages:

```bash
npm install @google/genai lucide-react motion express
```

- `@google/genai`: Provides the `live.connect` method for WebSocket-based streaming.
- `lucide-react`: For the minimalist iconography.
- `motion`: For smooth UI transitions and audio visualizations.
- `express`: Serves as the backend to host the frontend and manage environment variables.

## 🛠️ Implementation Details

### 1. Direct WebSocket Connection
Unlike standard REST requests, TutorTalk uses a direct WebSocket connection via the Live API. This allows for:
- **Bi-directional streaming**: Simultaneous audio input (user) and output (AI).
- **Interruption handling**: AI stops speaking immediately when the user starts.
- **Low Latency**: Real-time conversational feel.

### 2. Audio Processing (PCM16)
The Gemini Live API requires raw audio data in **PCM16** format at a **16kHz** sample rate. We achieved this using a custom `AudioWorklet`:

- **Capture Processor**: Converts browser Float32 audio to Int16 before sending Base64 chunks over the WebSocket.
- **Playback Queue**: Manages incoming audio chunks to ensure gapless, smooth AI speech performance.

### 3. Model Configuration
We used the following configuration to ensure a high-quality Socratic experience:

```typescript
const session = await ai.live.connect({
  model: "gemini-3.1-flash-live-preview",
  config: {
    responseModalities: ["AUDIO"],
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
    },
    tools: [{ googleSearch: {} }], // Enables Grounding
    inputAudioTranscription: {},  // Shows what the user said
    outputAudioTranscription: {}  // Shows what the AI said
  }
});
```

### 4. Key Success Factors
- **User Gesture Implementation**: Microphone access (`getUserMedia`) is triggered inside a user-initiated event (click) to bypass browser security auto-blocks.
- **Silent Sink**: The `AudioWorklet` is connected to a zero-gain destination to prevent the browser from putting the audio process into "sleep mode."
- **Live Ref Syncing**: Using `useRef` to maintain the WebSocket state prevents closure-related bugs during rapid React re-renders.

## 📑 Use Case: The Socratic Method
TutorTalk isn't just an AI; it's a tutor. By using specialized `systemInstructions`, the model is forced to ask guiding questions rather than providing direct answers, fostering active learning through dialogue.

---
*Created as documentation for the successful deployment of TutorTalk.*
