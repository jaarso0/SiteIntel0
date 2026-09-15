import React, { useState, useEffect, useRef } from "react";

const API_BASE = "http://localhost:8080";

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
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        // Stop any active answer playback if starting to listen.
        stopAudio();
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
      stopAudio();
    };
  }, [textToSpeak]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const speak = (text: string) => {
    stopAudio();

    if (!text) return;

    // Clean up citations and URLs so Edge TTS reads only the answer.
    const cleanText = text
      .replace(/\[Source:\s*[^\]]+\]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .trim();
    if (!cleanText) return;

    const audio = new Audio(`${API_BASE}/voice/tts?text=${encodeURIComponent(cleanText)}`);
    audioRef.current = audio;

    audio.onplay = () => {
      setIsSpeaking(true);
    };

    audio.onended = () => {
      audioRef.current = null;
      setIsSpeaking(false);
    };

    audio.onerror = () => {
      audioRef.current = null;
      setIsSpeaking(false);
      console.error("Edge TTS playback failed.");
    };

    audio.play().catch((error) => {
      audioRef.current = null;
      setIsSpeaking(false);
      console.error("Edge TTS playback was blocked or failed:", error);
    });
  };

  const handleToggle = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else if (isSpeaking) {
      stopAudio();
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
    <div className="flex items-center shrink-0">
      <button
        onClick={handleToggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
          isListening
            ? "bg-[#ef4444] border border-[#ef4444] text-white"
            : isSpeaking
            ? "bg-[#22c55e] border border-[#22c55e] text-white"
            : "bg-[rgba(123,94,167,0.2)] border border-[rgba(123,94,167,0.3)] text-white hover:brightness-110"
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
          <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        ) : isSpeaking ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5a6.5 6.5 0 01-6.5-6.5h13a6.5 6.5 0 01-6.5 6.5zM12 18.5v4m-4 0h8m-4-10a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
          </svg>
        )}
      </button>
    </div>
  );
};
