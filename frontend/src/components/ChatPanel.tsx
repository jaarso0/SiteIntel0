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
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ jobId, useKb }) => {
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

  // Helper to extract [Source: ...] citations into standalone flat labels
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
        <p className="whitespace-pre-wrap leading-[1.6] text-[14px] text-[#F0EDE8]">
          {cleanText || (isStreaming && <span className="animate-pulse">Typing...</span>)}
        </p>
        
        {citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-[rgba(255,255,255,0.06)] pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.35)] font-mono">
              Citations:
            </span>
            {citations.map((src, idx) => (
              <a
                key={idx}
                href={src.startsWith("http") ? src : `https://${src}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#00E5CC] hover:underline font-mono"
              >
                [{src.replace(/^https?:\/\/(www\.)?/, "").substring(0, 25)}
                {src.length > 25 && "..."}]
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-[550px] md:h-[650px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-[16px] overflow-hidden relative font-sans">
      
      {/* Messages viewport */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 bg-transparent">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            {/* Center empty state document line circle */}
            <div className="w-9 h-9 rounded-full bg-[rgba(0,229,204,0.08)] border border-[rgba(0,229,204,0.2)] flex items-center justify-center text-[#00E5CC] mb-3">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[14px] text-[rgba(255,255,255,0.35)] font-normal">
              Ask anything about stepsai.co
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-full ${
                msg.sender === "user" ? "self-end items-end max-w-[70%]" : "self-start items-start max-w-full"
              }`}
            >
              {msg.sender === "user" ? (
                /* User speech bubble: electric violet glass */
                <div className="p-3.5 bg-[rgba(123,94,167,0.18)] border border-[rgba(123,94,167,0.25)] text-[#F0EDE8] rounded-[12px_12px_4px_12px] text-[14px] leading-[1.6]">
                  {renderMessageContent(msg.text)}
                </div>
              ) : (
                /* AI response: plaintext with left border in #00E5CC */
                <div className="pl-3 ml-2 border-l-2 border-[#00E5CC] text-[#F0EDE8] text-[14px] leading-[1.6] max-w-full">
                  {renderMessageContent(msg.text)}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input container bar: rounded 12px, background 255 0.04 */}
      <div className="p-3 border-t border-[rgba(255,255,255,0.06)] bg-transparent flex gap-3 items-center">
        <div className="flex-1 h-[52px] flex items-center bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-[12px] px-3 gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputValue)}
            placeholder={jobId ? "Ask a question..." : "Submit URL first..."}
            disabled={!jobId || isStreaming}
            className="flex-1 bg-transparent text-[14px] text-[#F0EDE8] placeholder-[rgba(255,255,255,0.25)] border-none outline-none py-1 focus:ring-0 focus:outline-none"
          />
          
          {/* Voice Controller */}
          <VoiceButton
            onSpeechDetected={(text) => handleSendMessage(text)}
            textToSpeak={speechText}
            panelLabel="SiteIntel"
          />

          <button
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim() || isStreaming || !jobId}
            className="premium-btn w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-[#7B5EA7] text-white border-none shadow-none cursor-pointer"
          >
            {isStreaming ? (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
