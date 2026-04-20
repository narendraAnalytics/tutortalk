/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  BrainCircuit, 
  History, 
  ArrowRight,
  StopCircle,
  PlayCircle,
  Loader2,
  CheckCircle2,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types
type SessionStatus = "IDLE" | "CONNECTING" | "ACTIVE" | "ENDED";

interface TranscriptEntry {
  role: "student" | "tutor";
  text: string;
  timestamp: string;
}

const SUBJECTS = [
  { id: "math", name: "Mathematics", icon: <BrainCircuit className="w-5 h-5" />, color: "bg-blue-500" },
  { id: "physics", name: "Physics", icon: <BrainCircuit className="w-5 h-5" />, color: "bg-purple-500" },
  { id: "chemistry", name: "Chemistry", icon: <BrainCircuit className="w-5 h-5" />, color: "bg-emerald-500" },
  { id: "biology", name: "Biology", icon: <BrainCircuit className="w-5 h-5" />, color: "bg-pink-500" },
  { id: "history", name: "History", icon: <History className="w-5 h-5" />, color: "bg-amber-500" },
  { id: "literature", name: "Literature", icon: <BookOpen className="w-5 h-5" />, color: "bg-indigo-500" },
];

export default function App() {
  // State
  const [status, setStatus] = useState<SessionStatus>("IDLE");
  const statusRef = useRef<SessionStatus>("IDLE");
  
  // Sync status to ref
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isOutputMuted, setIsOutputMuted] = useState(false);
  
  // Refs for Audio and Live API
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const liveSessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Initialize AI
  const aiRef = useRef<GoogleGenAI | null>(null);
  if (!aiRef.current && process.env.GEMINI_API_KEY) {
    aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // Base64 helper
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const base64ToArrayBuffer = (base64: string) => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Audio Playback
  const playNextInQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current || isOutputMuted) {
      return;
    }

    isPlayingRef.current = true;
    const pcmData = audioQueueRef.current.shift()!;
    
    // Convert PCM16 to Float32
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768;
    }

    const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      isPlayingRef.current = false;
      playNextInQueue();
    };

    source.start();
  }, [isOutputMuted]);

  // Start Session
  const startSession = async () => {
    if (!aiRef.current) return;
    setStatus("CONNECTING");
    setTranscript([]);

    try {
      // 1. Setup AudioContext & Get Mic Stream early (Must be in user gesture)
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      } else if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      // Pre-fetch mic stream within the click handler
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = micStream;

      // 2. Load Worklet
      await audioContextRef.current.audioWorklet.addModule("/worklets/capture-processor.js");

      // 3. Connect to Live API
      const sessionPromise = aiRef.current.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setStatus("ACTIVE");
            startMicCapture(micStream);
            // Trigger initial greeting from AI
            sessionPromise.then((session: any) => {
              session.sendRealtimeInput({ text: "Hi, I'm ready. Please greet me and ask how you can help me today." });
            });
          },
          onmessage: (message: LiveServerMessage) => {
            handleLiveMessage(message);
          },
          onclose: () => {
            stopSession();
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          },
          systemInstruction: `You are TutorTalk, a wise and patient Socratic tutor specializing in ${subject.name}. 
          The student wants to discuss ${topic || "general concepts"}.
          Rules:
          1. Use the Socratic method: Ask guiding questions instead of giving direct answers.
          2. Speak naturally and clearly. Be encouraging.
          3. If the student seems lost, offer a simple hint or an analogy.
          4. You can use Google Search to stay updated on factual information if needed.`,
          tools: [{ googleSearch: {} }],
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      // Crucial: Assign to ref immediately so callbacks can access it
      liveSessionRef.current = sessionPromise;

    } catch (err) {
      console.error("Failed to start session:", err);
      setStatus("IDLE");
    }
  };

  const startMicCapture = async (stream: MediaStream) => {
    try {
      const source = audioContextRef.current!.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContextRef.current!, "capture-processor");
      
      workletNode.port.onmessage = (event) => {
        if (isMuted || statusRef.current !== "ACTIVE") return;
        
        const pcm16Buffer = event.data;
        const base64Data = arrayBufferToBase64(pcm16Buffer);
        
        liveSessionRef.current.then((session: any) => {
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: "audio/pcm;rate=16000" }
          });
        });
      };

      source.connect(workletNode);
      
      // Connect to destination via zero gain to keep worklet alive and processing
      const silence = audioContextRef.current!.createGain();
      silence.gain.value = 0;
      workletNode.connect(silence);
      silence.connect(audioContextRef.current!.destination);
      
      workletNodeRef.current = workletNode;
    } catch (err) {
      console.error("Mic capture failed:", err);
    }
  };

  const handleLiveMessage = (message: LiveServerMessage) => {
    // 1. Handle Audio Output
    const audioPart = message.serverContent?.modelTurn?.parts?.find(p => p.inlineData);
    if (audioPart?.inlineData?.data) {
      const arrayBuffer = base64ToArrayBuffer(audioPart.inlineData.data);
      audioQueueRef.current.push(new Int16Array(arrayBuffer));
      playNextInQueue();
    }

    // 2. Handle Interruption
    if (message.serverContent?.interrupted) {
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      // Note: Stopping active source nodes requires global tracking of current node
    }

    // 3. Handle Transcriptions (User & AI)
    const msg = message as any;
    if (msg.outputAudioTranscription?.text) {
      const text = msg.outputAudioTranscription.text;
      setTranscript(prev => {
        // Prevent duplicate entries for the same chunk
        if (prev.length > 0 && prev[prev.length - 1].text === text && prev[prev.length - 1].role === "tutor") {
          return prev;
        }
        return [...prev, { role: "tutor", text, timestamp: new Date().toLocaleTimeString() }];
      });
    }

    if (msg.inputAudioTranscription?.text) {
      const text = msg.inputAudioTranscription.text;
      setTranscript(prev => {
        if (prev.length > 0 && prev[prev.length - 1].text === text && prev[prev.length - 1].role === "student") {
          return prev;
        }
        return [...prev, { role: "student", text, timestamp: new Date().toLocaleTimeString() }];
      });
    }

    // 4. Handle text parts (Grounding/Direct responses)
    const textPart = message.serverContent?.modelTurn?.parts?.find(p => p.text);
    if (textPart?.text) {
        setTranscript(prev => {
           if (prev.length > 0 && prev[prev.length - 1].text === textPart.text) return prev;
           return [...prev, { role: "tutor", text: textPart.text!, timestamp: new Date().toLocaleTimeString() }];
        });
    }
  };

  const stopSession = () => {
    setStatus("ENDED");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (liveSessionRef.current) {
      liveSessionRef.current.then((s: any) => s.close());
    }
    audioQueueRef.current = [];
  };

  const resetToHome = () => {
    setStatus("IDLE");
    setTopic("");
    setTranscript([]);
  };

  // Rendering logic for different statuses
  const renderHome = () => (
    <div className="max-w-4xl mx-auto p-8 h-full flex flex-col justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-full uppercase tracking-wider mb-4">
          Next Gen Tutoring
        </span>
        <h1 className="text-6xl font-bold font-sans tracking-tight mb-4 text-slate-900 leading-tight">
          Master any subject with <span className="text-blue-600">voice.</span>
        </h1>
        <p className="text-slate-500 text-xl max-w-2xl mx-auto">
          TutorTalk uses real-time AI to guide you through complex subjects. 
          No typing, just talk and learn.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
            1. Select Subject
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSubject(s)}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                  subject.id === s.id 
                    ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm" 
                    : "border-slate-100 hover:border-slate-200 text-slate-600"
                }`}
              >
                <div className={`p-2 rounded-lg ${subject.id === s.id ? "bg-blue-100 text-blue-600" : "bg-slate-50 text-slate-400"}`}>
                  {s.icon}
                </div>
                <span className="font-medium">{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
            2. Any specific topic?
          </h2>
          <div className="relative flex-grow">
            <textarea
              placeholder="E.g. Quantum mechanics basics, photosynthesis, or the French Revolution..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full h-full min-h-[120px] p-4 bg-slate-50 rounded-2xl border border-transparent focus:border-blue-200 focus:bg-white outline-none transition-all resize-none text-slate-700 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={startSession}
          className="group relative inline-flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-sm font-medium text-gray-900 rounded-full group bg-gradient-to-br from-blue-600 to-indigo-500 group-hover:from-blue-600 group-hover:to-indigo-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 transform transition hover:scale-105 active:scale-95"
        >
          <span className="relative px-12 py-4 transition-all ease-in duration-75 bg-slate-900 rounded-full group-hover:bg-opacity-0 flex items-center gap-3 text-lg font-bold">
            Start Live Session
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </div>
    </div>
  );

  const renderActive = () => (
    <div className="flex h-full w-full bg-[#f8fafc] text-slate-900 font-sans">
      <aside className="w-96 h-full bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-8 border-b border-slate-100">
          <h1 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Current Session</h1>
          <h2 className="text-xl font-semibold text-slate-800">{subject.name}</h2>
          <p className="text-sm text-slate-500 mt-1 truncate">{topic || "General Discussion"}</p>
        </div>
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Live Transcript</h3>
          <div className="space-y-4">
            {transcript.map((entry, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${entry.role === "tutor" ? "items-start" : "items-end"}`}
              >
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm border ${
                  entry.role === "tutor" 
                    ? "bg-white border-slate-100 rounded-tl-none" 
                    : "bg-blue-600 text-white border-blue-500 rounded-tr-none"
                }`}>
                  <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60 ${entry.role === "student" ? "text-blue-100" : "text-slate-400"}`}>
                    {entry.role === "tutor" ? "Tutor" : "You"} • {entry.timestamp}
                  </p>
                  <p className="leading-relaxed">
                    {entry.text}
                  </p>
                </div>
              </motion.div>
            ))}
            <div ref={transcriptEndRef} />
            {transcript.length === 0 && (
              <div className="text-center py-12">
                <p className="text-xs text-slate-300 italic">Silence is golden, but learning begins with a word. Say hello!</p>
              </div>
            )}
          </div>
        </div>
        <div className="p-8 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-4">
            <span>Session Status</span>
            <span>{status}</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <motion.div 
              animate={{ width: isPlayingRef.current ? "100%" : "30%" }}
              className="bg-blue-500 h-full transition-all duration-1000"
            ></motion.div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative voice-gradient">
        <header className="h-20 flex items-center justify-between px-10">
          <div className="flex items-center space-x-3">
            <div className={`w-2 h-2 rounded-full ${status === "ACTIVE" ? "bg-green-500 animate-pulse" : "bg-slate-300"}`}></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tutor Online: {subject.name} AI</span>
          </div>
          <div className="flex items-center space-x-6 text-sm font-medium text-slate-400">
            <button className="hover:text-slate-900 transition-colors">Resources</button>
            <button className="text-slate-900 border-b-2 border-blue-500 pb-1">Conversation</button>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
              <History className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-slate-700">Student</span>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center -mt-10 px-12">
          <div className="relative flex items-center justify-center">
            <motion.div 
              animate={{ scale: isPlayingRef.current ? [1, 1.1, 1] : 1 }}
              transition={{ duration: 2, repeat: Infinity }}
              className="orb-layer-1 absolute"
            ></motion.div>
            <motion.div 
              animate={{ scale: isPlayingRef.current ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="orb-layer-2 absolute"
            ></motion.div>
            <div className="orb-core flex items-center justify-center">
              {isMuted ? <MicOff className="w-10 h-10 text-white/50" /> : <Mic className="w-10 h-10 text-white" />}
            </div>
          </div>

          <div className="mt-16 text-center max-w-2xl min-h-[100px]">
             <AnimatePresence mode="wait">
               {transcript.length > 0 ? (
                 <motion.p 
                   key={transcript[transcript.length-1].text}
                   initial={{ opacity: 0, scale: 0.98 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="text-lg font-light italic text-slate-500 mb-2 leading-relaxed"
                 >
                   "{transcript[transcript.length-1].text}"
                 </motion.p>
               ) : (
                 <p className="text-lg font-light italic text-slate-300 mb-2">
                   "Hello! I'm your {subject.name} tutor. How can I assist your learning today?"
                 </p>
               )}
             </AnimatePresence>
             <p className="text-xs font-bold text-blue-600 uppercase tracking-[0.2em] mt-4">
               {isPlayingRef.current ? "Tutor is explaining" : "Listening..."}
             </p>
          </div>

          <div className="absolute bottom-32 flex space-x-1 h-8 px-4 border-x border-slate-200 items-end">
            {[1,2,3,4,5,6,7].map(i => (
              <motion.div 
                key={i}
                animate={{ height: isPlayingRef.current ? [8, 28, 8] : 4 }}
                transition={{ duration: 0.4 + (i * 0.1), repeat: Infinity }}
                className={`w-1 rounded-full ${i % 2 === 0 ? "bg-blue-500" : "bg-blue-300"}`}
              />
            ))}
          </div>
        </div>

        <footer className="h-24 px-10 flex items-center justify-center bg-transparent">
          <div className="flex items-center space-x-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${isMuted ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button 
              className="px-8 h-12 bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 flex items-center space-x-3 hover:bg-blue-700 transition-all transform active:scale-95"
            >
              <span className="text-sm">Speak to Ask a Question</span>
            </button>
            <button 
              onClick={stopSession}
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          </div>
        </footer>
      </main>
    </div>
  );

  const renderConnecting = () => (
    <div className="h-full flex flex-col items-center justify-center bg-slate-950">
       <div className="w-24 h-24 relative mb-8">
          <Loader2 className="w-full h-full text-blue-600 animate-spin" />
       </div>
       <h2 className="text-2xl font-bold text-white mb-2">Connecting to Knowledge</h2>
       <p className="text-white/40 font-mono tracking-wide">Establishing WebSocket to Gemini Live...</p>
    </div>
  );

  const renderEnded = () => (
    <div className="max-w-4xl mx-auto p-8 h-full flex flex-col justify-center">
       <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-2xl text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Session Complete</h2>
          <p className="text-slate-500 text-lg mb-12 max-w-md mx-auto italic font-serif">
            "Every question answered is another step toward mastery."
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
             <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Subject</h3>
                <p className="text-xl font-bold text-slate-800">{subject.name}</p>
             </div>
             <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Insights Generated</h3>
                <p className="text-xl font-bold text-slate-800">{transcript.length} exchanges</p>
             </div>
          </div>

          <div className="flex gap-4 justify-center">
             <button 
               onClick={resetToHome}
               className="px-8 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition"
             >
                Back to Dashboard
             </button>
             <button 
               className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition"
             >
                Download Learning Report
             </button>
          </div>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      <AnimatePresence mode="wait">
        {status === "IDLE" && (
           <motion.div 
             key="home"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="h-screen overflow-auto"
           >
             {renderHome()}
           </motion.div>
        )}
        {status === "CONNECTING" && (
           <motion.div 
             key="connecting"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="h-screen"
           >
             {renderConnecting()}
           </motion.div>
        )}
        {status === "ACTIVE" && (
           <motion.div 
             key="active"
             initial={{ opacity: 0, scale: 1.1 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0 }}
             className="h-screen"
           >
             {renderActive()}
           </motion.div>
        )}
        {status === "ENDED" && (
           <motion.div 
             key="ended"
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0 }}
             className="h-screen overflow-auto"
           >
             {renderEnded()}
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
