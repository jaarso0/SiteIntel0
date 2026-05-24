import React, { useState, useEffect, useRef } from "react";

interface DeployHubProps {
  kb: any;
  jobId: string | null;
}

const API_BASE = "http://localhost:8080";

export const DeployHub: React.FC<DeployHubProps> = ({ kb, jobId }) => {
  const [activeSubTab, setActiveSubTab] = useState<"sandbox" | "widget" | "twilio">("sandbox");
  
  // Call sandbox states
  const [callState, setCallState] = useState<"idle" | "dialing" | "connected" | "disconnected">("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [captions, setCaptions] = useState<{ sender: "user" | "ai" | "system"; text: string }[]>([]);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const captionsEndRef = useRef<HTMLDivElement | null>(null);
  const activeCallStateRef = useRef(callState);

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

  // Derive target business title
  const siteUrl = kb?.kb_articles?.[0]?.source_urls?.[0] || "";
  const companyName = siteUrl
    ? siteUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split(".")[0].toUpperCase()
    : "YOUR WEBSITE";

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
    setCaptions([]);
    setCallState("dialing");
    setCaptions([{ sender: "system", text: `Dialing ${companyName} Virtual AI Agent...` }]);

    // Pick up after delay
    setTimeout(() => {
      if (activeCallStateRef.current !== "dialing") return;
      setCallState("connected");
      setCaptions((prev) => [...prev, { sender: "system", text: "Voice Connection Established." }]);
      
      // Speak greeting
      const greeting = `Hello! Thanks for calling the ${companyName} A.I. support line. How can I help you today with pricing, refunds, or product details?`;
      setCaptions((prev) => [...prev, { sender: "ai", text: greeting }]);
      speakText(greeting);
    }, 1800);
  };

  // Hang up virtual call
  const handleEndCall = () => {
    window.speechSynthesis.cancel();
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
    setIsSpeaking(true);

    // Filter citations so reader avoids spelling out brackets or raw URLs
    const filteredText = text.replace(/\[Source:\s*[^\]]+\]/g, "").replace(/https?:\/\/\S+/g, "").trim();
    if (!filteredText) {
      setIsSpeaking(false);
      triggerListening();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(filteredText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);
      // Trigger listening after audio playback completes
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
    theme: "cyber-purple",
    greeting: "Welcome! I am fully trained on our documentation. Ask me anything!"
  };
</script>
<script src="http://localhost:8080/widgets/v1/siteintel-widget.js" async></script>`;

  const twilioUrl = `http://localhost:8080/twilio/voice?job_id=${jobId || "your-job-id"}`;

  return (
    <div className="flex flex-col lg:flex-row gap-6 mt-2 min-h-[500px]">
      {/* Left panel — Channels Selector */}
      <div className="w-full lg:w-1/2 flex flex-col gap-5">
        <div className="glass-panel border border-white/5 rounded-2xl p-4 flex gap-2.5 bg-black/25">
          {[
            { id: "sandbox", label: "📞 Live Voice Sandbox", desc: "Test voice loop" },
            { id: "widget", label: "💬 Embed Chatbot", desc: "Add to website" },
            { id: "twilio", label: "📱 Twilio Live Phone", desc: "Deploy support line" },
          ].map((subTab) => (
            <button
              key={subTab.id}
              onClick={() => setActiveSubTab(subTab.id as any)}
              className={`flex-1 p-3 rounded-xl transition-all duration-300 text-left ${
                activeSubTab === subTab.id
                  ? "bg-purple-600/15 border border-purple-500/30 text-white shadow-lg shadow-purple-500/5"
                  : "bg-white/[0.02] border border-white/5 text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              <h4 className="text-xs font-bold tracking-wide">{subTab.label}</h4>
              <p className="text-[9px] text-muted mt-0.5">{subTab.desc}</p>
            </button>
          ))}
        </div>

        {/* Tab content 1: Widget */}
        {activeSubTab === "widget" && (
          <div className="glass-panel border border-white/5 rounded-3xl p-6 bg-black/10 flex flex-col gap-4 flex-1">
            <div>
              <h3 className="font-heading font-bold text-gray-100 text-sm md:text-base flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
                Grounded HTML Chat Widget
              </h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Add this pre-built conversational widget to your website's primary layout. It connects to your vector indices automatically.
              </p>
            </div>

            <div className="flex flex-col gap-2 relative">
              <div className="flex justify-between items-center bg-black/35 px-4 py-2 rounded-t-xl border-b border-white/5">
                <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-cyan-400">Embed Snippet</span>
                <button
                  onClick={() => handleCopy(widgetScript, "widget")}
                  className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 transition"
                >
                  {copiedText === "widget" ? "✓ Copied!" : "📋 Copy Code"}
                </button>
              </div>
              <pre className="bg-black/30 p-4 rounded-b-xl border border-t-0 border-white/5 font-mono text-[10px] leading-relaxed text-purple-300 overflow-x-auto select-all max-h-[160px]">
                {widgetScript}
              </pre>
            </div>

            <div className="border-t border-white/5 pt-4">
              <h4 className="text-xs font-bold text-gray-200 mb-2">How to install:</h4>
              <ul className="text-xs text-muted flex flex-col gap-1.5 list-disc pl-4">
                <li>Copy the snippet provided above.</li>
                <li>Paste it right before the closing <code className="text-purple-400 text-[10px] bg-white/5 px-1 py-0.5 rounded font-mono">&lt;/body&gt;</code> tag on your pages.</li>
                <li>Your customer chat icon will render automatically at the bottom right.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab content 2: Twilio */}
        {activeSubTab === "twilio" && (
          <div className="glass-panel border border-white/5 rounded-3xl p-6 bg-black/10 flex flex-col gap-5 flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-heading font-bold text-gray-100 text-sm md:text-base flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse"></span>
                  Twilio Live Support Line Setup
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Route actual landline or mobile voice calls to your grounded RAG AI Agent instantly.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Live Node
              </span>
            </div>

            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted font-bold">1. Twilio Request Webhook URL:</span>
                <button
                  onClick={() => handleCopy(twilioUrl, "twilio")}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  {copiedText === "twilio" ? "✓ Copied!" : "📋 Copy"}
                </button>
              </div>
              <input
                type="text"
                readOnly
                value={twilioUrl}
                className="w-full bg-black/35 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-cyan-400 select-all"
              />
            </div>

            <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-gray-200">🚀 Setting up in Twilio Console (5 Minutes):</h4>
              <ol className="text-xs text-muted flex flex-col gap-2.5 list-decimal pl-4">
                <li>Log in to your <strong>Twilio Console</strong>.</li>
                <li>Navigate to <strong>Phone Numbers</strong> &gt; <strong>Active Numbers</strong>.</li>
                <li>Select your configured phone number (or purchase a trial support number).</li>
                <li>Scroll down to the <strong>Voice &amp; Fax</strong> config panel.</li>
                <li>Under <strong>"A Call Comes In"</strong>, select <strong>Webhook</strong>.</li>
                <li>Paste your copyable Webhook URL in the textbox and click **Save**.</li>
              </ol>
            </div>

            <div className="p-3.5 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 text-[11px] text-cyan-400 leading-relaxed">
              <strong>💡 Pro Tip:</strong> Since your local server is running on <code className="font-mono text-white">localhost</code>, use a tunneling tool like <strong>ngrok</strong> (e.g., <code className="font-mono text-white bg-black/30 px-1 py-0.5 rounded">ngrok http 8080</code>) to generate a public HTTPS URL, then swap `http://localhost:8080` for your ngrok domain in the webhook path!
            </div>
          </div>
        )}

        {/* Tab content 3: Sandbox */}
        {activeSubTab === "sandbox" && (
          <div className="glass-panel border border-white/5 rounded-3xl p-6 bg-black/10 flex flex-col gap-4 flex-1 justify-between">
            <div>
              <h3 className="font-heading font-bold text-gray-100 text-sm md:text-base flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
                Browser Voice Agent Sandbox
              </h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Test the exact conversational feel and accuracy of your website's voice line instantly within the browser using mock phone controls.
              </p>
            </div>

            <div className="bg-purple-950/5 border border-purple-500/10 rounded-2xl p-4 flex flex-col gap-2">
              <h4 className="text-xs font-bold text-purple-300">Sandbox Capabilities:</h4>
              <ul className="text-xs text-muted flex flex-col gap-1.5 list-disc pl-4">
                <li><strong>Voice Recognition:</strong> Hears microphone speech inputs natively.</li>
                <li><strong>Voice Synthesis:</strong> Binds and synthesizes answers via speech engines.</li>
                <li><strong>Grounding:</strong> Direct connection to your crawled knowledge database.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 bg-black/35 p-3 rounded-2xl border border-white/5 text-[11px] text-muted">
              <svg className="w-4 h-4 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Click <strong>"Simulate Phone Call"</strong> on the dialer board on the right to start speaking.</span>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — Dialer device mockup */}
      <div className="w-full lg:w-1/2 flex items-center justify-center">
        <div className="w-full max-w-[340px] aspect-[9/18] rounded-[42px] border-4 border-white/10 bg-[#090b10] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col justify-between p-6">
          
          {/* Top Notch design */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-4.5 bg-black rounded-full z-20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-white/[0.04]"></div>
            <div className="w-10 h-1 bg-neutral-900 rounded-full ml-4"></div>
          </div>

          {/* Top Info Bar */}
          <div className="flex justify-between items-center text-[10px] font-mono text-muted tracking-wider mt-1 relative z-10">
            <span>9:41 AM</span>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <div className="w-5 h-2.5 border border-white/20 rounded-sm p-0.5 flex">
                <div className="w-full h-full bg-green-500 rounded-xs"></div>
              </div>
            </div>
          </div>

          {/* Phone Content viewport */}
          <div className="flex-1 flex flex-col justify-between my-5 relative z-10 max-h-[460px]">
            
            {/* Caller identity */}
            <div className="text-center mt-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-purple-400 font-mono">SITEINTEL VOICE LINE</h2>
              <h1 className="text-lg font-heading font-extrabold text-gray-200 mt-1.5 truncate max-w-[260px] mx-auto">{companyName}</h1>
              
              {callState === "idle" && <p className="text-[10px] text-muted mt-1 uppercase font-semibold">Offline</p>}
              {callState === "dialing" && <p className="text-[10px] text-cyan-400 mt-1 uppercase font-bold animate-pulse">Calling...</p>}
              {callState === "connected" && (
                <div className="flex flex-col items-center gap-1 mt-1">
                  <p className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Connected</p>
                  <p className="text-xs font-mono text-gray-400 font-bold">{formatTime(callDuration)}</p>
                </div>
              )}
              {callState === "disconnected" && <p className="text-[10px] text-red-500 mt-1 uppercase font-bold">Ended</p>}
            </div>

            {/* Simulated Audio Visualizer (Waveform) */}
            <div className="h-28 flex items-center justify-center gap-1.5 my-4">
              {callState === "connected" && (isSpeaking || isListening || isAiStreaming) ? (
                <div className="flex items-center gap-1.5 h-16">
                  {[1, 2, 3, 4, 5, 6, 7].map((bar) => {
                    const animationDelay = `${bar * 0.15}s`;
                    let color = "bg-purple-500";
                    if (isListening) color = "bg-red-500";
                    if (isAiStreaming) color = "bg-cyan-400";
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
                  <div className="w-12 h-1 bg-white/10 rounded-full"></div>
                </div>
              )}
            </div>

            {/* Closed Caption scrollable viewer */}
            <div className="flex-1 max-h-[140px] bg-black/45 border border-white/5 rounded-2xl p-3 flex flex-col gap-2.5 overflow-y-auto font-mono text-[9px] leading-relaxed relative">
              {captions.length === 0 ? (
                <div className="text-center text-muted my-auto italic flex flex-col items-center gap-1">
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
                    <span className={`text-[8px] uppercase tracking-wider font-bold mb-0.5 ${
                      cap.sender === "user"
                        ? "text-purple-400"
                        : cap.sender === "ai"
                        ? "text-cyan-400"
                        : "text-muted"
                    }`}>
                      {cap.sender === "user" ? "👤 You" : cap.sender === "ai" ? "🤖 Agent" : "🛜 System"}
                    </span>
                    <div
                      className={`px-2.5 py-1.5 rounded-xl max-w-[85%] ${
                        cap.sender === "user"
                          ? "bg-purple-600/20 text-purple-200 border border-purple-500/10 rounded-tr-none text-right"
                          : cap.sender === "ai"
                          ? "bg-cyan-950/20 text-cyan-200 border border-cyan-500/10 rounded-tl-none text-left"
                          : "bg-white/[0.02] text-muted text-center italic border border-white/5"
                      }`}
                    >
                      {cap.text === "" && isAiStreaming ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping delay-100"></span>
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping delay-200"></span>
                        </span>
                      ) : (
                        cap.text
                      )}
                    </div>
                  </div>
                ))
              )}
              {isListening && !isSpeaking && !isAiStreaming && (
                <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[8px] text-red-400 animate-pulse font-bold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Mic Listening...
                </div>
              )}
              <div ref={captionsEndRef} />
            </div>
          </div>

          {/* Phone Controls (Keys / Dialing controls) */}
          <div className="flex flex-col gap-4 relative z-10 border-t border-white/5 pt-4">
            {callState === "connected" && (
              <div className="flex justify-around items-center">
                {/* Mute button */}
                <button
                  onClick={handleToggleMute}
                  className={`p-3 rounded-full flex items-center justify-center transition ${
                    isMuted
                      ? "bg-yellow-600/25 border border-yellow-500/40 text-yellow-400"
                      : "bg-white/5 hover:bg-white/10 text-gray-300"
                  }`}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMuted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>

                {/* Speaker indicator status */}
                <div className="text-center font-mono text-[8px] text-muted font-bold uppercase tracking-wider flex flex-col gap-0.5">
                  <span>Voice Engine</span>
                  <span className={isSpeaking ? "text-cyan-400 animate-pulse" : "text-gray-500"}>
                    {isSpeaking ? "🔊 Playing Response" : "💤 Idle"}
                  </span>
                </div>
              </div>
            )}

            {/* Primary Dial button */}
            <div className="flex justify-center">
              {callState === "idle" || callState === "disconnected" ? (
                <button
                  onClick={handleStartCall}
                  className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] shadow-lg shadow-purple-600/10 active:scale-[0.98] transition cursor-pointer"
                >
                  <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>Simulate Phone Call</span>
                </button>
              ) : (
                <button
                  onClick={handleEndCall}
                  className="w-full py-3.5 px-6 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] shadow-lg shadow-red-500/10 active:scale-[0.98] transition cursor-pointer animate-pulse"
                >
                  <svg className="w-4 h-4 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>End Call Session</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
