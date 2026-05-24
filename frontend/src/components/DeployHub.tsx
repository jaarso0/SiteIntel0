import React, { useState, useEffect, useRef } from "react";

interface DeployHubProps {
  kb: any;
  jobId: string | null;
}

const API_BASE = "http://localhost:8080";

export const DeployHub: React.FC<DeployHubProps> = ({ kb, jobId }) => {
  const [activeSubTab, setActiveSubTab] = useState<"sandbox" | "widget" | "twilio">("sandbox");

  const siteUrl = kb?.kb_articles?.[0]?.source_urls?.[0] || "";
  const companyName = siteUrl
    ? siteUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split(".")[0].toUpperCase()
    : "STEPSAI";
  
  // Call sandbox states
  const [callState, setCallState] = useState<"idle" | "dialing" | "connected" | "disconnected">("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [captions, setCaptions] = useState<{ sender: "user" | "ai" | "system"; text: string }[]>([]);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);

  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const captionsEndRef = useRef<HTMLDivElement | null>(null);
  const activeCallStateRef = useRef(callState);

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
    };

    rec.onerror = (e: any) => {
      console.error("Speech recognition error in dialer:", e.error);
      setIsListening(false);
      
      // Auto-recover speech recognition loop if still connected
      if (activeCallStateRef.current === "connected" && !isSpeaking && !isAiStreaming) {
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

  // Connect virtual voice call
  const handleStartCall = () => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setCaptions([]);
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
    setCallState("disconnected");
    setIsSpeaking(false);
    setIsListening(false);
    setIsAiStreaming(false);
    setCaptions((prev) => [...prev, { sender: "system", text: "Call Disconnected." }]);
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
    if (activeCallStateRef.current !== "connected" || isMuted || isSpeaking || isAiStreaming) return;

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
                  className="text-[10px] font-mono font-semibold text-[#7B5EA7] bg-transparent border-none cursor-pointer hover:underline"
                >
                  {copiedText === "widget" ? "Copied" : "Copy Code"}
                </button>
              </div>
              <pre className="bg-[rgba(255,255,255,0.02)] p-4 rounded-b-[6px] border border-[rgba(255,255,255,0.07)] font-mono text-[10px] leading-relaxed text-[#7B5EA7] overflow-x-auto select-all max-h-[160px]">
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
                  className="text-[#7B5EA7] hover:underline bg-transparent border-none cursor-pointer"
                >
                  {copiedText === "twilio" ? "Copied" : "Copy"}
                </button>
              </div>
              <input
                type="text"
                readOnly
                value={twilioUrl}
                className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] rounded-[6px] px-3 py-2 text-xs font-mono text-[#7B5EA7] select-all outline-none"
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
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] p-6 flex flex-col gap-4 flex-1 justify-between rounded-[14px]">
            <div>
              <h3 className="font-mono font-semibold text-[#F0EDE8] text-[11px] tracking-[0.12em] uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7B5EA7]"></span>
                Browser Voice Agent Sandbox
              </h3>
              <p className="text-xs text-[rgba(255,255,255,0.4)] mt-1 leading-relaxed font-normal">
                Test the exact conversational feel and accuracy of your website's voice line instantly within the browser using mock phone controls.
              </p>
            </div>

            <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-[6px] p-4 flex flex-col gap-2 font-mono">
              <h4 className="text-xs font-semibold text-[#F0EDE8] uppercase">Sandbox Capabilities:</h4>
              <ul className="text-xs text-[rgba(255,255,255,0.4)] flex flex-col gap-1.5 list-disc pl-4 font-normal">
                <li>Voice Recognition: Hears microphone speech inputs natively.</li>
                <li>Voice Synthesis: Binds and synthesizes answers via speech engines.</li>
                <li>Grounding: Direct connection to your crawled knowledge database.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.02)] p-3 rounded-[6px] border border-[rgba(255,255,255,0.07)] text-[11px] text-[rgba(255,255,255,0.4)] font-mono">
              <span>Click "Simulate Phone Call" on the dialer board on the right to start speaking.</span>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — Dialer device mockup */}
      <div className="w-full lg:w-1/2 flex items-center justify-center pl-6">
        {/* Phone Frame Mockup (320px x 620px) */}
        <div 
          className="relative overflow-hidden flex flex-col justify-between p-6"
          style={{
            width: "320px",
            height: "620px",
            background: "#0E0E12",
            border: "1.5px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "44px",
            boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.04), 0 40px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
          }}
        >
          
          {/* Top Notch design */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100px] h-[6px] rounded-[3px] bg-[rgba(255,255,255,0.15)] z-20 mt-[14px]"></div>

          {/* Top Info Bar: 10px DM Sans, color 0.5 */}
          <div className="flex justify-between items-center text-[10px] font-mono text-[rgba(255,255,255,0.5)] mt-3 relative z-10">
            <span>9:41 AM</span>
            <div className="flex items-center gap-1">
              <span>5G</span>
              <div className="w-[14px] h-[7px] border border-[rgba(255,255,255,0.2)] rounded-sm p-[1px] flex items-center">
                <div className="w-full h-full bg-[#00E5CC] rounded-xs"></div>
              </div>
            </div>
          </div>

          {/* Phone Content viewport */}
          <div className="flex-1 flex flex-col justify-between my-5 relative z-10 max-h-[460px]">
            
            {/* Caller identity */}
            <div className="text-center mt-3 font-sans">
              <h2 className="text-[8px] font-display font-semibold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.3)]">
                SITEINTEL VOICE LINE
              </h2>
              <h1 className="text-[22px] font-display font-bold text-[#F0EDE8] mt-1 truncate max-w-[200px] mx-auto">{companyName}</h1>
              
              <div className="flex justify-center mt-2">
                {callState === "idle" || callState === "disconnected" ? (
                  <span className="text-[8px] font-sans font-normal uppercase tracking-wide bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.3)] rounded-[20px] px-2.5 py-1">
                    OFFLINE
                  </span>
                ) : callState === "dialing" ? (
                  <span className="text-[8px] font-sans font-semibold uppercase tracking-wide bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.2)] text-[#7B5EA7] rounded-[20px] px-2.5 py-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7B5EA7] animate-pulse"></span>
                    DIALING...
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-1 font-mono">
                    <span className="text-[8px] font-sans font-semibold uppercase tracking-wide bg-[rgba(0,229,204,0.08)] border border-[rgba(0,229,204,0.2)] text-[#00E5CC] rounded-[20px] px-2.5 py-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC] animate-statusPulse"></span>
                      LIVE
                    </span>
                    <span className="text-[10px] text-[rgba(255,255,255,0.4)] font-semibold">{formatTime(callDuration)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Visualizer Waveform */}
            <div className="h-24 flex items-center justify-center gap-1 my-4">
              {callState === "connected" && (isSpeaking || isListening || isAiStreaming) ? (
                <div className="flex items-center gap-1 h-12">
                  {[1, 2, 3, 4, 5, 6, 7].map((bar) => {
                    const animationDelay = `${bar * 0.15}s`;
                    let color = "bg-[#7B5EA7]";
                    if (isListening) color = "bg-[#ef4444]";
                    if (isAiStreaming) color = "bg-[#00E5CC]";
                    return (
                      <div
                        key={bar}
                        style={{ animationDelay }}
                        className={`w-1 rounded-full animate-voiceWave ${color}`}
                      ></div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 h-2 justify-center">
                  <div className="w-8 h-0.5 bg-[rgba(255,255,255,0.15)] rounded-full"></div>
                </div>
              )}
            </div>

            {/* Closed Caption transcript */}
            <div className="flex-1 max-h-[140px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-[6px] p-3 flex flex-col gap-2.5 overflow-y-auto font-mono text-[9px] leading-relaxed relative">
              {captions.length === 0 ? (
                <div className="text-center text-[rgba(255,255,255,0.4)] my-auto italic flex flex-col items-center gap-1">
                  <span>No captions active</span>
                  <span>Initiate call to display</span>
                </div>
              ) : (
                captions.map((cap, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      cap.sender === "user"
                        ? "items-end"
                        : cap.sender === "ai"
                        ? "items-start"
                        : "items-center"
                    }`}
                  >
                    <span className={`text-[8px] uppercase tracking-wider font-semibold mb-0.5 ${
                      cap.sender === "user"
                        ? "text-[#7B5EA7]"
                        : cap.sender === "ai"
                        ? "text-[#00E5CC]"
                        : "text-[rgba(255,255,255,0.4)]"
                    }`}>
                      {cap.sender === "user" ? "You" : cap.sender === "ai" ? "Agent" : "System"}
                    </span>
                    <div
                      className={`px-2.5 py-1.5 rounded-[4px] max-w-[85%] ${
                        cap.sender === "user"
                          ? "bg-[rgba(123,94,167,0.1)] text-[#F0EDE8] border border-[rgba(123,94,167,0.15)] text-right"
                          : cap.sender === "ai"
                          ? "bg-[rgba(255,255,255,0.02)] text-[#F0EDE8] border border-[rgba(255,255,255,0.07)] text-left"
                          : "bg-transparent text-[rgba(255,255,255,0.4)] text-center italic border border-[rgba(255,255,255,0.07)]"
                      }`}
                    >
                      {cap.text === "" && isAiStreaming ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-[#00E5CC] animate-ping"></span>
                          <span className="w-1 h-1 rounded-full bg-[#00E5CC] animate-ping delay-100"></span>
                          <span className="w-1 h-1 rounded-full bg-[#00E5CC] animate-ping delay-200"></span>
                        </span>
                      ) : (
                        cap.text
                      )}
                    </div>
                  </div>
                ))
              )}
              {isListening && !isSpeaking && !isAiStreaming && (
                <div className="absolute bottom-2 left-3 flex items-center gap-1 text-[8px] text-[#ef4444] animate-pulse font-semibold uppercase font-mono">
                  Mic Listening
                </div>
              )}
              <div ref={captionsEndRef} />
            </div>
          </div>

          {/* Phone Controls & Bottom Simulate button */}
          <div className="flex flex-col gap-4 relative z-10 border-t border-[rgba(255,255,255,0.06)] pt-4 font-mono">
            {callState === "connected" && (
              <div className="flex justify-around items-center">
                {/* Mute button */}
                <button
                  onClick={handleToggleMute}
                  className={`w-9 h-9 rounded-[6px] flex items-center justify-center transition border cursor-pointer ${
                    isMuted
                      ? "bg-[rgba(239,68,68,0.1)] border-[#ef4444] text-[#ef4444]"
                      : "bg-transparent border-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.4)] hover:text-[#F0EDE8]"
                  }`}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>

                {/* Speaker indicator status */}
                <div className="text-center text-[8px] text-[rgba(255,255,255,0.4)] font-semibold uppercase tracking-wider flex flex-col gap-0.5">
                  <span>Voice Engine</span>
                  <span className={isSpeaking ? "text-[#00E5CC]" : "text-[rgba(255,255,255,0.4)]"}>
                    {isSpeaking ? "Playing" : "Idle"}
                  </span>
                </div>
              </div>
            )}

            {/* Primary Dial button: 85% width, height 54px, gradient, radius 28px, shadow-violet */}
            <div className="flex justify-center">
              {callState === "idle" || callState === "disconnected" ? (
                <button
                  onClick={handleStartCall}
                  className="premium-btn w-[85%] h-[54px] rounded-[28px] bg-gradient-to-br from-[#7B5EA7] to-[#00E5CC] text-white text-[13px] font-semibold uppercase tracking-[0.05em] flex items-center justify-center gap-2 border-none shadow-[0_8px_32px_rgba(123,94,167,0.4)] cursor-pointer"
                >
                  <svg className="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>Simulate Phone Call</span>
                </button>
              ) : (
                <button
                  onClick={handleEndCall}
                  className="premium-btn w-[85%] h-[54px] rounded-[28px] bg-[#ef4444] text-white text-[13px] font-semibold uppercase tracking-[0.05em] flex items-center justify-center gap-2 border-none shadow-none cursor-pointer"
                >
                  <svg className="w-[18px] h-[18px] text-white rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
