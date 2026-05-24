import React, { useState, useEffect, useRef } from "react";
import { VoiceButton } from "./VoiceButton";

const API_BASE = "http://localhost:8080";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  isStreaming?: boolean;
}

interface ChatPanelProps {
  jobId: string | null;
  useKb: boolean;
  label: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ jobId, useKb, label }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [speechText, setSpeechText] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;
    if (!jobId) {
      alert("Please submit and build a site knowledge base first!");
      return;
    }

    const userMessageId = Math.random().toString();
    const aiMessageId = Math.random().toString();

    // 1. Add User Message
    const userMsg: Message = {
      id: userMessageId,
      sender: "user",
      text: textToSend,
    };
    
    // 2. Add empty AI placeholder message
    const aiMsg: Message = {
      id: aiMessageId,
      sender: "ai",
      text: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInputValue("");
    setIsStreaming(true);
    setSpeechText(null);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: jobId,
          message: textToSend,
          use_kb: useKb,
        }),
      });

      if (!response.ok) {
        throw new Error("Chat streaming failed");
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      // 3. Read chunks from response stream
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          accumulatedText += chunk;
          
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, text: accumulatedText } : msg
            )
          );
        }
      }

      // Mark streaming as completed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
      
      // Trigger Speech Synthesis (TTS) once full response is gathered
      setSpeechText(accumulatedText);

    } catch (error: any) {
      console.error("Error streaming chat:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? { ...msg, text: `[Error: ${error.message || "Could not stream response from server."}]`, isStreaming: false }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  // Helper to extract [Source: ...] citations into standalone glowing pills
  const renderMessageContent = (text: string) => {
    const citationRegex = /\[Source:\s*([^\]]+)\]/g;
    const cleanText = text.replace(citationRegex, "").trim();
    
    // Find all unique citations
    const citations: string[] = [];
    let match;
    while ((match = citationRegex.exec(text)) !== null) {
      if (!citations.includes(match[1])) {
        citations.push(match[1]);
      }
    }

    return (
      <div className="flex flex-col gap-2">
        <p className="whitespace-pre-wrap leading-relaxed text-sm tracking-wide text-gray-100">
          {cleanText || (isStreaming && <span className="animate-pulse">Typing...</span>)}
        </p>
        
        {citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Citations:
            </span>
            {citations.map((src, idx) => (
              <a
                key={idx}
                href={src.startsWith("http") ? src : `https://${src}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 hover:border-cyan-400/40 px-2 py-0.5 rounded-md transition-all duration-300 font-mono flex items-center gap-1 hover:shadow-sm hover:shadow-cyan-400/10"
              >
                {src.replace(/^https?:\/\/(www\.)?/, "").substring(0, 25)}
                {src.length > 25 && "..."}
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-[550px] md:h-[650px] glass-panel border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Dynamic Header based on Grounded status */}
      <div className={`p-5 flex items-center justify-between border-b border-white/5 bg-gradient-to-r ${
        useKb 
          ? "from-purple-950/20 to-cyan-950/20" 
          : "from-orange-950/10 to-transparent"
      }`}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${useKb ? "bg-cyan-400 heading-glow" : "bg-orange-500 animate-pulse"}`}></span>
            <h2 className="font-heading font-bold text-base tracking-wide text-gray-100 uppercase">
              {label}
            </h2>
          </div>
          <span className="text-[11px] text-muted tracking-wide mt-0.5">
            {useKb 
              ? "Grounded AI Agent: Zero-hallucination RAG" 
              : "Baseline Assistant: Highly prone to hallucinations"}
          </span>
        </div>
        
        {/* Glow pill */}
        <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
          useKb 
            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
            : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
        }`}>
          {useKb ? "Grounded" : "Hallucinatory"}
        </div>
      </div>

      {/* Messages viewport */}
      <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-black/10">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className={`p-4 rounded-full bg-white/5 mb-4 ${useKb ? "text-cyan-500" : "text-orange-500"}`}>
              {useKb ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <h4 className="font-heading font-semibold text-gray-300 text-sm tracking-wide mb-1">
              No conversation started
            </h4>
            <p className="text-xs text-muted max-w-xs leading-relaxed">
              {useKb 
                ? "Ask anything about the crawled site. The response is strictly grounded in vectors." 
                : "Ask about pricing, refunds, or support, and watch it confidently invent details!"}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${
                msg.sender === "user" ? "self-end flex-row-reverse" : "self-start"
              }`}
            >
              {/* Avatar */}
              <div className={`w-8.5 h-8.5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold font-heading ${
                msg.sender === "user" 
                  ? "bg-purple-600/35 text-purple-200 border border-purple-500/20" 
                  : useKb 
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20" 
                  : "bg-orange-500/15 text-orange-300 border border-orange-500/20"
              }`}>
                {msg.sender === "user" ? "ME" : "AI"}
              </div>

              {/* Message Bubble */}
              <div className={`p-4 rounded-2xl ${
                msg.sender === "user"
                  ? "bg-purple-600/10 border border-purple-500/20 rounded-tr-none text-right"
                  : useKb
                  ? "bg-cyan-950/10 border border-cyan-500/10 rounded-tl-none"
                  : "bg-orange-950/5 border border-orange-500/5 rounded-tl-none"
              }`}>
                {renderMessageContent(msg.text)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input container bar */}
      <div className="p-4 border-t border-white/5 bg-black/20 flex gap-3 items-center">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputValue)}
          placeholder={jobId ? `Ask ${label}...` : "Submit URL first..."}
          disabled={!jobId || isStreaming}
          className="flex-1 bg-black/40 border border-white/5 hover:border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none transition-all duration-300 disabled:cursor-not-allowed disabled:bg-gray-950/20 focus:ring-1 focus:ring-purple-500/20"
        />
        
        {/* Real-time Voice Controller */}
        <VoiceButton
          onSpeechDetected={(text) => handleSendMessage(text)}
          textToSpeak={speechText}
          panelLabel={label}
        />

        <button
          onClick={() => handleSendMessage(inputValue)}
          disabled={!inputValue.trim() || isStreaming || !jobId}
          className={`p-3 rounded-xl flex items-center justify-center transition-all duration-300 ${
            inputValue.trim() && !isStreaming && jobId
              ? "bg-purple-600 hover:bg-purple-500 text-white hover:scale-105"
              : "bg-gray-800 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isStreaming ? (
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};
