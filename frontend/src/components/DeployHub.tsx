import React, { useState, useEffect, useRef } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

interface DeployHubProps {
  kb: any;
  jobId: string | null;
}

const API_BASE = "http://localhost:8080";

// Dynamically synthesizes a realistic US telephone ringback tone (440Hz + 480Hz, 2s ON / 4s OFF)
class RingtoneGenerator {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private timer: any = null;

  start() {
    if (this.isPlaying) return;
    
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    
    try {
      this.ctx = new AudioCtx();
      this.isPlaying = true;

      const playRing = () => {
        if (!this.isPlaying || !this.ctx) return;

        this.osc1 = this.ctx.createOscillator();
        this.osc2 = this.ctx.createOscillator();
        this.osc1.frequency.value = 440;
        this.osc2.frequency.value = 480;

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.1);
        this.gainNode.gain.setValueAtTime(0.08, this.ctx.currentTime + 1.9);
        this.gainNode.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 2.0);

        this.osc1.connect(this.gainNode);
        this.osc2.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);

        this.osc1.start();
        this.osc2.start();

        const o1 = this.osc1;
        const o2 = this.osc2;
        const g = this.gainNode;
        setTimeout(() => {
          try {
            o1.stop();
            o2.stop();
            o1.disconnect();
            o2.disconnect();
            g.disconnect();
          } catch (e) {}
        }, 2050);
      };

      playRing();
      this.timer = setInterval(playRing, 6000);
    } catch (e) {
      console.warn("Failed to start ringtone generator:", e);
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
    }
    this.osc1 = null;
    this.osc2 = null;
    this.gainNode = null;
  }
}

// Robust dynamic logo retrieval with dual fallback (Clearbit -> Google Favicon -> Gradient monogram)
const Logo: React.FC<{ domain: string; name: string }> = ({ domain, name }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (domain) {
      setImgSrc(`https://logo.clearbit.com/${domain}`);
      setHasError(false);
      setRetryCount(0);
    } else {
      setImgSrc(null);
    }
  }, [domain]);

  const handleError = () => {
    if (retryCount === 0 && domain) {
      // Fallback to Google Favicon API
      setImgSrc(`https://www.google.com/s2/favicons?sz=128&domain=${domain}`);
      setRetryCount(1);
    } else {
      setHasError(true);
    }
  };

  const initial = name ? name.charAt(0).toUpperCase() : "S";

  if (!domain || hasError || !imgSrc) {
    return (
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7B5EA7] to-[#00E5CC] flex items-center justify-center text-white text-2xl font-bold font-display shadow-[0_4px_20px_rgba(123,94,167,0.3)] animate-statusPulse select-none">
        {initial}
      </div>
    );
  }

  return (
    <div className="w-16 h-16 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.12)] p-1.5 flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md relative select-none">
      <div className="absolute inset-0 rounded-full border border-[rgba(0,229,204,0.3)] animate-ping opacity-25 scale-105 pointer-events-none"></div>
      <img
        src={imgSrc}
        alt={`${name} Logo`}
        onError={handleError}
        className="w-full h-full object-contain rounded-full bg-transparent"
      />
    </div>
  );
};

export const DeployHub: React.FC<DeployHubProps> = ({ kb, jobId }) => {
  const [activeSubTab, setActiveSubTab] = useState<"sandbox" | "widget" | "twilio">("sandbox");

  const siteUrl = kb?.kb_articles?.[0]?.source_urls?.[0] || "";
  const companyName = siteUrl
    ? siteUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split(".")[0].toUpperCase()
    : "STEPSAI";
  
  const domain = siteUrl
    ? siteUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]
    : "";
  
  // Call sandbox states
  const [callState, setCallState] = useState<"idle" | "dialing" | "connected" | "disconnected">("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [captions, setCaptions] = useState<{ sender: "user" | "ai" | "system"; text: string }[]>([]);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"native" | "livekit">("native");
  const roomRef = useRef<Room | null>(null);

  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const captionsEndRef = useRef<HTMLDivElement | null>(null);
  const activeCallStateRef = useRef(callState);

  const ringtoneRef = useRef<RingtoneGenerator | null>(null);

  // Initialize ringtone generator on mount
  useEffect(() => {
    ringtoneRef.current = new RingtoneGenerator();
    return () => {
      ringtoneRef.current?.stop();
    };
  }, []);

  // Manage ringtone based on callState
  useEffect(() => {
    if (callState === "dialing") {
      ringtoneRef.current?.start();
    } else {
      ringtoneRef.current?.stop();
    }
  }, [callState]);

  // Check voice synthesis availability on mount
  useEffect(() => {
    fetch(`${API_BASE}/voice/status`)
      .then((res) => res.json())
      .then((data) => {
        setVoiceActive(data.voice_active || data.eleven_labs_active || false);
      })
      .catch((e) => console.log("Voice synthesis service is offline.", e));
  }, []);

  // Sync ref to call state for async browser speech events
  useEffect(() => {
    activeCallStateRef.current = callState;
  }, [callState]);

  const isSpeakingRef = useRef(isSpeaking);
  const isAiStreamingRef = useRef(isAiStreaming);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isAiStreamingRef.current = isAiStreaming;
  }, [isAiStreaming]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Handle call timer increments
  useEffect(() => {
    if (callState === "connected") {
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [callState]);

  // Scroll to bottom of closed captions transcript automatically
  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [captions, isAiStreaming]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  // Format call connection duration
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Setup browser Speech Recognition
  const initSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onend = () => {
      setIsListening(false);
      // Auto-restart listening if call is active, and we are not speaking or streaming
      if (activeCallStateRef.current === "connected" && !isSpeakingRef.current && !isAiStreamingRef.current && !isMutedRef.current) {
        setTimeout(() => {
          triggerListening();
        }, 300);
      }
    };

    rec.onerror = (e: any) => {
      console.error("Speech recognition error in dialer:", e.error);
      setIsListening(false);
      
      // Auto-recover speech recognition loop if still connected
      if (activeCallStateRef.current === "connected" && !isSpeakingRef.current && !isAiStreamingRef.current) {
        setTimeout(() => {
          triggerListening();
        }, 1000);
      }
    };

    rec.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && activeCallStateRef.current === "connected") {
        setCaptions((prev) => [...prev, { sender: "user", text: transcript }]);
        await sendTranscriptionToBackend(transcript);
      }
    };

    recognitionRef.current = rec;
    return rec;
  };

  // Connect via WebRTC using LiveKit Client SDK
  const connectToLiveKit = async () => {
    if (!jobId) return;
    try {
      setCaptions((prev) => [...prev, { sender: "system", text: "Fetching WebRTC credentials..." }]);
      const response = await fetch(`${API_BASE}/livekit/token?job_id=${jobId}`);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Backend token server offline.");
      }
      const data = await response.json();
      const { token, url } = data;

      setCaptions((prev) => [...prev, { sender: "system", text: "Connecting to WebRTC gateway..." }]);

      // Construct a new LiveKit Room instance
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // Handle subscribed tracks (remote audio from AI Agent)
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.id = `track-${track.sid}`;
          audioElement.autoplay = true;
          audioElement.setAttribute("playsinline", "true");
          document.body.appendChild(audioElement);
          audioElement.play().catch((err) => {
            console.error("Browser blocked LiveKit audio playback:", err);
            setCaptions((prev) => [
              ...prev,
              { sender: "system", text: "Browser blocked audio playback. Click anywhere on the page and try again." },
            ]);
          });
          
          // Ring tone stops & connected timer starts only when the agent's voice track is received!
          setCallState("connected");
          setCaptions((prev) => [...prev, { sender: "system", text: "WebRTC Voice Session Established." }]);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = document.getElementById(`track-${track.sid}`);
          if (el) el.remove();
          track.detach();
        }
      });

      // Handle active speaker changes to animate our premium visualizer equalizer!
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const isLocalSpeaking = room.localParticipant.isSpeaking;
        setIsListening(isLocalSpeaking && !isMuted);

        const agentActive = speakers.some(
          (s) => s.identity !== room.localParticipant.identity && s.isSpeaking
        );
        setIsSpeaking(agentActive);
      });

      // Handle custom real-time data packets for transcription text broadcasts!
      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const rawData = new TextDecoder().decode(payload);
          const packet = JSON.parse(rawData);
          
          if (packet.sender && packet.text) {
            if (packet.sender === "user") {
              setCaptions((prev) => [...prev, { sender: "user", text: packet.text }]);
            } else if (packet.sender === "ai") {
              setIsAiStreaming(false);
              setCaptions((prev) => [...prev, { sender: "ai", text: packet.text }]);
            }
          }
        } catch (e) {
          console.error("Failed to parse incoming data stream text packet:", e);
        }
      });

      // Connect WebRTC transport
      await room.connect(url, token);
      // Ring stops and connected timer starts when remote agent audio track is subscribed

      // Publish mic with echo cancellation — prevents agent TTS from looping back as input
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000,
      });

    } catch (err: any) {
      console.error("LiveKit sandbox failure:", err);
      setCaptions((prev) => [...prev, { sender: "system", text: `WebRTC Error: ${err.message || "Gateway offline"}` }]);
      setCallState("disconnected");
      roomRef.current = null;
    }
  };

  const disconnectFromLiveKit = () => {
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (e) {
        console.error(e);
      }
      roomRef.current = null;
    }
    setCallState("disconnected");
    setIsSpeaking(false);
    setIsListening(false);
    setIsAiStreaming(false);
    setCaptions((prev) => [...prev, { sender: "system", text: "WebRTC Session Closed." }]);
  };

  // Connect virtual voice call
  const handleStartCall = () => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setCaptions([]);
    
    if (voiceMode === "livekit") {
      setCallState("dialing");
      setCaptions([{ sender: "system", text: `Initiating LiveKit WebRTC connection...` }]);
      connectToLiveKit();
    } else {
      setCallState("dialing");
      setCaptions([{ sender: "system", text: `Dialing ${companyName} Virtual AI Agent...` }]);

      // Pick up after delay
      setTimeout(() => {
        if (activeCallStateRef.current !== "dialing") return;
        setCallState("connected");
        setCaptions((prev) => [...prev, { sender: "system", text: "Voice Connection Established." }]);
        
        // Speak greeting
        const greeting = `Hello! Thanks for calling the ${companyName} AI support line. How can I help you today with pricing, refunds, or product details?`;
        setCaptions((prev) => [...prev, { sender: "ai", text: greeting }]);
        speakText(greeting);
      }, 1800);
    }
  };

  // Hang up virtual call
  const handleEndCall = () => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    
    if (voiceMode === "livekit") {
      disconnectFromLiveKit();
    } else {
      setCallState("disconnected");
      setIsSpeaking(false);
      setIsListening(false);
      setIsAiStreaming(false);
      setCaptions((prev) => [...prev, { sender: "system", text: "Call Disconnected." }]);
    }
  };

  // Synthesize text response into voice audio
  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(true);

    // Filter citations so reader avoids spelling out brackets or raw URLs
    const filteredText = text.replace(/\[Source:\s*[^\]]+\]/g, "").replace(/https?:\/\/\S+/g, "").trim();
    if (!filteredText) {
      setIsSpeaking(false);
      triggerListening();
      return;
    }

    const runFallbackSpeechSynthesis = () => {
      const utterance = new SpeechSynthesisUtterance(filteredText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        setIsSpeaking(false);
        if (activeCallStateRef.current === "connected" && !isMuted) {
          triggerListening();
        }
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        if (activeCallStateRef.current === "connected" && !isMuted) {
          triggerListening();
        }
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    if (voiceActive) {
      try {
        const audioUrl = `${API_BASE}/voice/tts?text=${encodeURIComponent(filteredText)}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsSpeaking(true);
        };

        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          if (activeCallStateRef.current === "connected" && !isMuted) {
            triggerListening();
          }
        };

        audio.onerror = (e) => {
          console.warn("Voice service audio play failed, falling back to browser synthesis.", e);
          audioRef.current = null;
          runFallbackSpeechSynthesis();
        };

        audio.play().catch((e) => {
          console.warn("Voice service play execution failed, falling back.", e);
          audioRef.current = null;
          runFallbackSpeechSynthesis();
        });
      } catch (e) {
        console.warn("Voice service audio construction failed, falling back.", e);
        runFallbackSpeechSynthesis();
      }
    } else {
      runFallbackSpeechSynthesis();
    }
  };

  // Trigger microphone listener
  const triggerListening = () => {
    if (activeCallStateRef.current !== "connected" || isMutedRef.current || isSpeakingRef.current || isAiStreamingRef.current) return;

    if (!recognitionRef.current) {
      initSpeechRecognition();
    }

    try {
      recognitionRef.current.start();
    } catch (e) {
      // recognition already running
    }
  };

  // Post voice transcription and stream grounded answers
  const sendTranscriptionToBackend = async (messageText: string) => {
    if (!jobId) return;
    setIsAiStreaming(true);
    
    // Add empty placeholder turn for AI stream
    setCaptions((prev) => [...prev, { sender: "ai", text: "" }]);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          message: messageText,
          use_kb: true,
          is_voice: true,
        }),
      });

      if (!response.ok) throw new Error("API Connection broken");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponseText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponseText += chunk;

          // Update the last caption entry with ongoing text stream
          setCaptions((prev) => {
            const copy = [...prev];
            if (copy.length > 0 && copy[copy.length - 1].sender === "ai") {
              copy[copy.length - 1].text = fullResponseText;
            }
            return copy;
          });
        }
      }

      setIsAiStreaming(false);
      
      // Perform TTS on completed text
      if (activeCallStateRef.current === "connected") {
        speakText(fullResponseText);
      }

    } catch (err: any) {
      console.error("Dialer API Error:", err);
      setIsAiStreaming(false);
      setCaptions((prev) => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].sender === "ai") {
          copy[copy.length - 1].text = "Sorry, I had a momentary interruption. Could you please repeat that?";
        }
        return copy;
      });
      speakText("Sorry, I had a momentary interruption. Could you please repeat that?");
    }
  };

  // Handle Mute trigger
  const handleToggleMute = () => {
    if (voiceMode === "livekit") {
      if (roomRef.current) {
        const localParticipant = roomRef.current.localParticipant;
        if (isMuted) {
          localParticipant.setMicrophoneEnabled(true);
          setIsMuted(false);
        } else {
          localParticipant.setMicrophoneEnabled(false);
          setIsMuted(true);
          setIsListening(false);
        }
      }
    } else {
      if (isMuted) {
        setIsMuted(false);
        if (activeCallStateRef.current === "connected" && !isSpeaking && !isAiStreaming) {
          setTimeout(() => triggerListening(), 300);
        }
      } else {
        setIsMuted(true);
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
  };

  // Copy status indicators
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const widgetScript = `<!-- SiteIntel AI Chat Agent Widget -->
<script>
  window.SiteIntelWidgetConfig = {
    jobId: "${jobId || 'your-job-id'}",
    theme: "minimal-dark",
    greeting: "Welcome! I am fully trained on our documentation. Ask me anything!"
  };
</script>
<script src="http://localhost:8080/widgets/v1/siteintel-widget.js" async></script>`;

  const twilioUrl = `http://localhost:8080/twilio/voice?job_id=${jobId || "your-job-id"}`;

  return (
    <div className="flex flex-col lg:flex-row gap-6 mt-2 min-h-[500px] font-sans">
      {/* Left panel — Channels Selector */}
      <div className="w-full lg:w-1/2 flex flex-col gap-5 border-r border-[rgba(255,255,255,0.06)] pr-6">
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] p-4 flex gap-2.5 rounded-[14px]">
          {[
            { id: "sandbox", label: "Live Voice Sandbox", desc: "Test voice loop" },
            { id: "widget", label: "Embed Chatbot", desc: "Add to website" },
            { id: "twilio", label: "Twilio Live Phone", desc: "Deploy support line" },
          ].map((subTab) => (
            <button
              key={subTab.id}
              onClick={() => setActiveSubTab(subTab.id as any)}
              className={`flex-1 p-3 rounded-[10px] transition-all duration-150 text-left border cursor-pointer ${
                activeSubTab === subTab.id
                  ? "bg-[rgba(123,94,167,0.15)] border-[#7B5EA7] text-[#F0EDE8]"
                  : "bg-transparent border-transparent text-[rgba(255,255,255,0.4)] hover:text-[#F0EDE8]"
              }`}
            >
              <h4 className="text-xs font-mono font-semibold tracking-wide">{subTab.label}</h4>
              <p className="text-[9px] text-[rgba(255,255,255,0.4)] mt-0.5 font-normal">{subTab.desc}</p>
            </button>
          ))}
        </div>

        {/* Tab content 1: Widget */}
        {activeSubTab === "widget" && (
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] p-6 flex flex-col gap-4 flex-1 rounded-[14px]">
            <div>
              <h3 className="font-mono font-semibold text-[#F0EDE8] text-[11px] tracking-[0.12em] uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7B5EA7]"></span>
                Grounded HTML Chat Widget
              </h3>
              <p className="text-xs text-[rgba(255,255,255,0.4)] mt-1 leading-relaxed font-normal">
                Add this pre-built conversational widget to your website's primary layout. It connects to your vector indices automatically.
              </p>
            </div>

            <div className="flex flex-col gap-2 relative">
              <div className="flex justify-between items-center bg-[rgba(255,255,255,0.02)] px-4 py-2 border border-[rgba(255,255,255,0.07)] border-b-0 rounded-t-[6px]">
                <span className="text-[10px] uppercase font-semibold tracking-wider font-mono text-[rgba(255,255,255,0.3)]">Embed Snippet</span>
                <button
                  onClick={() => handleCopy(widgetScript, "widget")}
                  className="text-[10px] font-mono font-semibold text-[#A892EE] bg-transparent border-none cursor-pointer hover:underline"
                >
                  {copiedText === "widget" ? "Copied" : "Copy Code"}
                </button>
              </div>
              <pre className="bg-[rgba(255,255,255,0.02)] p-4 rounded-b-[6px] border border-[rgba(255,255,255,0.07)] font-mono text-[10px] leading-relaxed text-[#00E5CC] overflow-x-auto select-all max-h-[160px]">
                {widgetScript}
              </pre>
            </div>

            <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
              <h4 className="text-xs font-mono font-semibold text-[#F0EDE8] mb-2 uppercase">How to install:</h4>
              <ul className="text-xs text-[rgba(255,255,255,0.4)] flex flex-col gap-1.5 list-disc pl-4 font-normal">
                <li>Copy the snippet provided above.</li>
                <li>Paste it right before the closing body tag on your pages.</li>
                <li>Your customer chat icon will render automatically at the bottom right.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab content 2: Twilio */}
        {activeSubTab === "twilio" && (
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] p-6 flex flex-col gap-5 flex-1 rounded-[14px]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-mono font-semibold text-[#F0EDE8] text-[11px] tracking-[0.12em] uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7B5EA7]"></span>
                  Twilio Live Support Line Setup
                </h3>
                <p className="text-xs text-[rgba(255,255,255,0.4)] mt-1 leading-relaxed font-normal">
                  Route actual landline or mobile voice calls to your grounded RAG AI Agent instantly.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-[rgba(255,255,255,0.05)] text-[#00E5CC] border border-[rgba(0,229,204,0.2)] text-[9px] font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5 rounded">
                Live Node
              </span>
            </div>

            <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] p-4 rounded-[6px] flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[rgba(255,255,255,0.3)] font-semibold">1. Webhook URL</span>
                <button
                  onClick={() => handleCopy(twilioUrl, "twilio")}
                  className="text-[#A892EE] hover:underline bg-transparent border-none cursor-pointer"
                >
                  {copiedText === "twilio" ? "Copied" : "Copy"}
                </button>
              </div>
              <input
                type="text"
                readOnly
                value={twilioUrl}
                className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] rounded-[6px] px-3 py-2 text-xs font-mono text-[#00E5CC] select-all outline-none"
              />
            </div>

            <div className="border-t border-[rgba(255,255,255,0.06)] pt-4 flex flex-col gap-3">
              <h4 className="text-xs font-mono font-semibold text-[#F0EDE8] uppercase">Setting up in Twilio Console:</h4>
              <ol className="text-xs text-[rgba(255,255,255,0.4)] flex flex-col gap-2.5 list-decimal pl-4 font-normal">
                <li>Log in to your Twilio Console.</li>
                <li>Navigate to Phone Numbers &gt; Active Numbers.</li>
                <li>Select your configured phone number.</li>
                <li>Scroll down to the Voice &amp; Fax config panel.</li>
                <li>Under "A Call Comes In", select Webhook.</li>
                <li>Paste your copyable Webhook URL in the textbox and click Save.</li>
              </ol>
            </div>

            <div className="p-3.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] text-[11px] text-[rgba(255,255,255,0.4)] leading-relaxed font-mono rounded-[6px]">
              Pro Tip: Since your local server is running on localhost, use a tunneling tool like ngrok (e.g. ngrok http 8080) to generate a public HTTPS URL, then swap http://localhost:8080 for your ngrok domain in the webhook path.
            </div>
          </div>
        )}

        {/* Tab content 3: Sandbox */}
        {activeSubTab === "sandbox" && (
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] p-6 flex flex-col gap-5 flex-1 justify-between rounded-[14px]">
            <div>
              <h3 className="font-mono font-semibold text-[#F0EDE8] text-[11px] tracking-[0.12em] uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7B5EA7]"></span>
                Browser Voice Agent Sandbox
              </h3>
              <p className="text-xs text-[rgba(255,255,255,0.4)] mt-1 leading-relaxed font-normal">
                Configure your testing environment to sandbox conversation flows instantly using Web Speech or real-time WebRTC channels.
              </p>
            </div>

            <div className="flex flex-col gap-3.5">
              <label className="text-[10px] uppercase font-bold tracking-wider font-mono text-[rgba(255,255,255,0.45)]">Voice Engine Sandbox Mode</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <button
                  onClick={() => {
                    if (callState === "connected" || callState === "dialing") return;
                    setVoiceMode("native");
                  }}
                  disabled={callState === "connected" || callState === "dialing"}
                  className={`p-3.5 rounded-[12px] text-left border transition-all duration-200 flex flex-col gap-1 cursor-pointer ${
                    voiceMode === "native"
                      ? "bg-[rgba(123,94,167,0.12)] border-[#7B5EA7] text-[#F0EDE8] shadow-[0_4px_16px_rgba(123,94,167,0.15)]"
                      : "bg-transparent border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.4)] hover:border-[rgba(255,255,255,0.12)] hover:text-[#F0EDE8]"
                  }`}
                >
                  <span className="text-xs font-bold font-sans flex items-center gap-1.5 select-none">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Browser Voice API
                  </span>
                  <span className="text-[9px] text-[rgba(255,255,255,0.4)] leading-relaxed font-normal mt-0.5">Native browser speech engine. Zero external configs needed.</span>
                </button>
                
                <button
                  onClick={() => {
                    if (callState === "connected" || callState === "dialing") return;
                    setVoiceMode("livekit");
                  }}
                  disabled={callState === "connected" || callState === "dialing"}
                  className={`p-3.5 rounded-[12px] text-left border transition-all duration-200 flex flex-col gap-1 cursor-pointer relative ${
                    voiceMode === "livekit"
                      ? "bg-[rgba(0,229,204,0.08)] border-[#00E5CC] text-[#F0EDE8] shadow-[0_4px_16px_rgba(0,229,204,0.1)]"
                      : "bg-transparent border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.4)] hover:border-[rgba(255,255,255,0.12)] hover:text-[#F0EDE8]"
                  }`}
                >
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 select-none">
                    <span className="w-1 h-1 rounded-full bg-[#00E5CC] animate-statusPulse"></span>
                    <span className="text-[7px] font-mono font-bold tracking-wide text-[#00E5CC] uppercase">WebRTC Pro</span>
                  </div>
                  <span className="text-xs font-bold font-sans flex items-center gap-1.5 select-none">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    LiveKit WebRTC Line
                  </span>
                  <span className="text-[9px] text-[rgba(255,255,255,0.4)] leading-relaxed font-normal mt-0.5">Ultra-low latency server agent with natural conversational silences and STT.</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.02)] p-3 rounded-[6px] border border-[rgba(255,255,255,0.07)] text-[11px] text-[rgba(255,255,255,0.4)] font-mono select-none">
              <span>{voiceMode === "livekit" ? "Click 'Simulate Phone Call' to launch a full-duplex WebRTC connection." : "Click 'Simulate Phone Call' on the dialer board on the right to start speaking."}</span>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — Redesigned Premium Obsidian Phone Mockup */}
      <div className="w-full lg:w-1/2 flex items-center justify-center pl-6">
        <div 
          className="relative overflow-hidden flex flex-col justify-between p-6 transition-all duration-500"
          style={{
            width: "330px",
            height: "640px",
            background: "linear-gradient(180deg, #09090b 0%, #0d0c12 100%)",
            border: "2px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "48px",
            boxShadow: `
              0 0 0 1px rgba(255, 255, 255, 0.05),
              0 25px 50px -12px rgba(0, 0, 0, 0.7),
              0 0 40px 0 rgba(123, 94, 167, 0.15),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `
          }}
        >
          
          {/* Dynamic Island Notch */}
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-[85px] h-[22px] rounded-full bg-black border border-[rgba(255,255,255,0.06)] z-25 flex items-center justify-between px-2.5 transition-all duration-300">
            {/* Small camera dot */}
            <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a] border border-[#2b2b2b] flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-[#142340]"></div>
            </div>
            {/* Small dynamic status sensor */}
            {callState === "connected" ? (
              <div className="w-2.5 h-2.5 rounded-full bg-[#00E5CC] animate-statusPulse shadow-[0_0_8px_#00E5CC]"></div>
            ) : callState === "dialing" ? (
              <div className="w-2.5 h-2.5 rounded-full bg-[#7B5EA7] animate-ping"></div>
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-[rgba(255,255,255,0.2)]"></div>
            )}
          </div>

          {/* Immersive mesh backdrop */}
          {callState === "connected" && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[46px] z-0 opacity-40 transition-opacity duration-1000">
              <div className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] rounded-full bg-[radial-gradient(circle,rgba(0,229,204,0.12)_0%,transparent_50%)] animate-breathe"></div>
              <div className="absolute -bottom-1/4 -right-1/4 w-[150%] h-[150%] rounded-full bg-[radial-gradient(circle,rgba(123,94,167,0.12)_0%,transparent_50%)] animate-breathe" style={{ animationDelay: "1.5s" }}></div>
            </div>
          )}

          {/* Top Info Bar */}
          <div className="flex justify-between items-center text-[10px] font-mono text-[rgba(255,255,255,0.45)] mt-3 relative z-10 select-none">
            <span>9:41 AM</span>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <div className="w-[14px] h-[8px] border border-[rgba(255,255,255,0.25)] rounded-xs p-[1px] flex items-center">
                <div className="w-full h-full bg-[#00E5CC] rounded-3xs"></div>
              </div>
            </div>
          </div>

          {/* Phone Content viewport */}
          <div className="flex-1 flex flex-col justify-between my-5 relative z-10 max-h-[480px]">
            
            {/* Caller identity */}
            <div className="text-center mt-4 font-sans flex flex-col items-center gap-3">
              <h2 className="text-[8px] font-mono font-semibold uppercase tracking-[0.25em] text-[rgba(255,255,255,0.35)]">
                SITEINTEL VOICE AGENT
              </h2>
              
              {/* Dynamic Logo Container */}
              <Logo domain={domain} name={companyName} />
              
              <div className="flex flex-col gap-0.5 mt-1 select-none">
                <h1 className="text-[20px] font-display font-extrabold text-[#F0EDE8] tracking-tight leading-tight truncate max-w-[220px] mx-auto">
                  {companyName}
                </h1>
                <span className="text-[9px] font-mono text-[rgba(255,255,255,0.4)] tracking-wide">{domain}</span>
              </div>
              
              {/* Glowing Status Badge and Digital Timer */}
              <div className="flex flex-col items-center justify-center mt-2.5 gap-2">
                {callState === "idle" || callState === "disconnected" ? (
                  <span className="text-[8px] font-mono font-semibold uppercase tracking-wider bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.45)] rounded-full px-3 py-1 shadow-inner backdrop-blur-sm select-none">
                    STANDBY
                  </span>
                ) : callState === "dialing" ? (
                  <span className="text-[8px] font-sans font-bold uppercase tracking-wider bg-[rgba(123,94,167,0.1)] border border-[rgba(123,94,167,0.25)] text-[#7B5EA7] rounded-full px-3 py-1 flex items-center gap-1.5 animate-pulse shadow-[0_0_15px_rgba(123,94,167,0.15)] select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7B5EA7] animate-ping"></span>
                    CONNECTING...
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-sans font-bold uppercase tracking-wider bg-[rgba(0,229,204,0.08)] border border-[rgba(0,229,204,0.25)] text-[#00E5CC] rounded-full px-3 py-1 flex items-center gap-1.5 shadow-[0_0_20px_rgba(0,229,204,0.2)] select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC] animate-statusPulse"></span>
                      CONNECTED
                    </span>
                    <span className="text-[24px] text-[#00E5CC] font-mono font-bold tracking-wider tabular-nums drop-shadow-[0_0_10px_rgba(0,229,204,0.3)] mt-0.5">
                      {formatTime(callDuration)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Visualizer Waveform Equalizer */}
            <div className="h-16 flex items-center justify-center gap-1.5 my-3 relative select-none">
              {callState === "connected" ? (
                <div className="flex items-center justify-center gap-1 h-12">
                  {[...Array(12)].map((_, i) => {
                    const baseHeight = [16, 28, 42, 54, 60, 48, 38, 52, 58, 44, 24, 12][i];
                    const delay = `${i * 0.08}s`;
                    let barColorClass = "bg-[rgba(255,255,255,0.15)]";
                    let duration = "1.2s";

                    if (isSpeaking) {
                      // Active synthesis (AI speaking) -> bright electric teal/cyan
                      barColorClass = "bg-gradient-to-t from-[#00E5CC] to-[#7B5EA7]";
                      duration = "0.7s";
                    } else if (isListening) {
                      // Mic listening (User speaking) -> warm pink/violet
                      barColorClass = "bg-gradient-to-t from-[#7B5EA7] to-[#ec4899]";
                      duration = "0.8s";
                    } else if (isAiStreaming) {
                      // AI thinking -> flowing purple/cyan
                      barColorClass = "bg-gradient-to-t from-[#7B5EA7] to-[#00E5CC]";
                      duration = "1.4s";
                    } else {
                      // Resting state active call
                      barColorClass = "bg-[rgba(0,229,204,0.3)]";
                      duration = "2.0s";
                    }

                    return (
                      <div
                        key={i}
                        className={`w-1 rounded-full transition-all duration-300 origin-center ${barColorClass}`}
                        style={{
                          height: `${baseHeight}px`,
                          transform: (isSpeaking || isListening || isAiStreaming) ? "none" : "scaleY(0.12)",
                          animation: (isSpeaking || isListening || isAiStreaming)
                            ? `voiceWave ${duration} ease-in-out infinite`
                            : "none",
                          animationDelay: delay,
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 h-2 justify-center">
                  <div className="w-12 h-0.5 bg-[rgba(255,255,255,0.12)] rounded-full"></div>
                </div>
              )}
            </div>

            {/* Live Chat Transcription Viewport */}
            <div className="flex-1 max-h-[170px] bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-[20px] p-3.5 flex flex-col gap-3 overflow-y-auto font-sans text-xs leading-relaxed relative scrollbar-none shadow-inner">
              {captions.length === 0 ? (
                <div className="text-center text-[rgba(255,255,255,0.3)] my-auto italic flex flex-col items-center justify-center gap-2 select-none">
                  <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center text-[rgba(255,255,255,0.25)]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-medium tracking-wide">No active transcriptions</span>
                </div>
              ) : (
                captions.map((cap, idx) => {
                  if (cap.sender === "system") {
                    return (
                      <div key={idx} className="flex justify-center my-1 select-none">
                        <div className="px-3 py-1 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-[9px] font-mono text-[rgba(255,255,255,0.4)] text-center tracking-wide shadow-sm">
                          {cap.text}
                        </div>
                      </div>
                    );
                  }

                  const isUser = cap.sender === "user";
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col max-w-[85%] ${isUser ? "self-end items-end" : "self-start items-start"}`}
                    >
                      {/* Name / Role Label */}
                      <span className={`text-[8px] font-mono font-bold tracking-wider mb-1 px-1 flex items-center gap-1 ${isUser ? "text-[#7B5EA7]" : "text-[#00E5CC]"}`}>
                        {!isUser && <span className="w-1 h-1 rounded-full bg-[#00E5CC] animate-statusPulse"></span>}
                        {isUser ? "YOU" : "AGENT"}
                      </span>

                      {/* Bubble */}
                      <div
                        className={`px-3 py-2 rounded-2xl text-[11px] leading-[1.5] shadow-[0_2px_12px_rgba(0,0,0,0.15)] ${
                          isUser
                            ? "bg-[rgba(123,94,167,0.14)] border border-[rgba(123,94,167,0.22)] text-[#F0EDE8] rounded-tr-none text-right"
                            : "bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] text-[#F0EDE8] rounded-tl-none text-left"
                        }`}
                      >
                        {cap.text === "" && isAiStreaming ? (
                          <div className="flex items-center gap-1 py-1 px-2 select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC] animate-bounce"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC] animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC] animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                          </div>
                        ) : (
                          cap.text
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {isListening && !isSpeaking && !isAiStreaming && (
                <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[9px] text-[#ef4444] animate-pulse font-semibold uppercase font-mono tracking-wider bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-full px-2 py-0.5 select-none z-10 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-ping"></span>
                  Listening
                </div>
              )}
              <div ref={captionsEndRef} />
            </div>
          </div>

          {/* Phone Controls & Bottom Simulate button */}
          <div className="flex flex-col gap-4.5 relative z-10 border-t border-[rgba(255,255,255,0.06)] pt-4 font-mono">
            {callState === "connected" && (
              <div className="flex justify-around items-center px-2">
                {/* Mute button */}
                <button
                  onClick={handleToggleMute}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 border cursor-pointer shadow-md ${
                    isMuted
                      ? "bg-[rgba(239,68,68,0.15)] border-[#ef4444] text-[#ef4444]"
                      : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.5)] hover:text-[#F0EDE8] hover:bg-[rgba(255,255,255,0.04)]"
                  }`}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMuted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>

                {/* Voice Engine State Indicator Badge */}
                <div className="flex flex-col items-center gap-0.5 select-none">
                  <span className="text-[7px] text-[rgba(255,255,255,0.35)] font-bold uppercase tracking-widest">Voice Engine</span>
                  <div className="flex items-center gap-1">
                    <span className={`w-1 h-1 rounded-full ${isSpeaking ? "bg-[#00E5CC] animate-statusPulse" : "bg-[rgba(255,255,255,0.2)]"}`}></span>
                    <span className={`text-[8px] font-bold uppercase tracking-wider ${isSpeaking ? "text-[#00E5CC]" : "text-[rgba(255,255,255,0.4)]"}`}>
                      {isSpeaking ? "Speaking" : "Resting"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Dial/End button */}
            <div className="flex justify-center select-none w-full">
              {callState === "idle" || callState === "disconnected" ? (
                <button
                  onClick={handleStartCall}
                  className="premium-btn w-full h-[52px] rounded-full bg-gradient-to-r from-[#7B5EA7] to-[#00E5CC] text-white text-xs font-bold uppercase tracking-[0.1em] flex items-center justify-center gap-2 border-none shadow-[0_6px_24px_rgba(123,94,167,0.35)] hover:shadow-[0_8px_32px_rgba(0,229,204,0.4)] transition-all duration-300 transform animate-statusPulse hover:animate-none cursor-pointer"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>Simulate Phone Call</span>
                </button>
              ) : (
                <button
                  onClick={handleEndCall}
                  className="premium-btn w-full h-[52px] rounded-full bg-gradient-to-r from-[#ef4444] to-[#f43f5e] text-white text-xs font-bold uppercase tracking-[0.1em] flex items-center justify-center gap-2 border-none shadow-[0_6px_24px_rgba(239,68,68,0.25)] hover:brightness-110 transition-all duration-300 transform cursor-pointer"
                >
                  <svg className="w-4 h-4 text-white rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>End Call</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
