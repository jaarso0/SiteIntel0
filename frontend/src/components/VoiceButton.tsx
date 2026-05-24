import React, { useState, useEffect, useRef } from "react";

interface VoiceButtonProps {
  onSpeechDetected: (text: string) => void;
  textToSpeak: string | null;
  panelLabel: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onSpeechDetected,
  textToSpeak,
  panelLabel,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const continuousModeRef = useRef(continuousMode);

  // Sync ref to avoid stale closures in audio callback handlers
  useEffect(() => {
    continuousModeRef.current = continuousMode;
  }, [continuousMode]);

  useEffect(() => {
    // Initialize Web Speech API Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        // Stop any active speech if starting to listen
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          onSpeechDetected(transcript);
        }
      };

      recognitionRef.current = rec;
    }
  }, [onSpeechDetected]);

  // Handle TTS Speaking when new text arrives
  useEffect(() => {
    if (textToSpeak) {
      speak(textToSpeak);
    }
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [textToSpeak]);

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    if (!text) return;

    // Clean up citations [Source: ...] for clean voice reading
    const cleanText = text.replace(/\[Source:\s*[^\]]+\]/g, "").trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05; // Slightly faster for natural feel
    utterance.pitch = 1.0;
    
    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      
      // Auto-listen loop: Trigger microphone automatically when AI finishes speaking
      if (continuousModeRef.current && recognitionRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Auto-start speech recognition failed:", e);
          }
        }, 600); // 600ms delay gives standard speakers a chance to clear
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleToggle = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Failed to start speech recognition", e);
        }
      } else {
        alert("Web Speech Recognition is only supported in Google Chrome and modern browsers.");
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Sleek toggle switch for continuous voice agent mode */}
      <button
        onClick={() => setContinuousMode(!continuousMode)}
        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg border transition-all duration-300 ${
          continuousMode
            ? "bg-cyan-500/10 text-cyan-400 border-cyan-400/30 hover:border-cyan-400/50"
            : "bg-black/20 text-muted border-white/5 hover:border-white/10"
        }`}
        title="Toggle Continuous Conversation Mode (Auto-Listen)"
      >
        {continuousMode ? "Continuous Mode: On" : "Push-to-Talk"}
      </button>

      <button
        onClick={handleToggle}
        className={`relative p-3.5 rounded-full flex items-center justify-center transition-all duration-300 ${
          isListening
            ? "bg-red-500 text-white mic-active shadow-lg shadow-red-500/30"
            : isSpeaking
            ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:scale-105"
            : "bg-purple-600 hover:bg-purple-500 text-white hover:scale-105 shadow-md shadow-purple-600/20"
        }`}
        title={
          isListening
            ? "Listening... Click to stop."
            : isSpeaking
            ? "Speaking... Click to mute."
            : `Speak to ${panelLabel}`
        }
      >
        {isListening ? (
          <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        ) : isSpeaking ? (
          <svg className="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5a6.5 6.5 0 01-6.5-6.5h13a6.5 6.5 0 01-6.5 6.5zM12 18.5v4m-4 0h8m-4-10a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
          </svg>
        )}
      </button>
    </div>
  );
};
