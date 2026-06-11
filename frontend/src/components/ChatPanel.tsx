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

  const starterPrompts = [
    "What can this business help customers with?",
    "Summarize the most important support policies.",
    "What information is missing from the site?",
    "Create a short phone support greeting.",
  ];

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

  const parseMarkdownToReact = (inputText: string): React.ReactNode => {
    if (!inputText) return null;

    const lines = inputText.split("\n");
    const elements: React.ReactNode[] = [];
    let currentList: React.ReactNode[] = [];
    let isInsideList = false;
    let listType: "ul" | "ol" | null = null;

    const parseInline = (lineText: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let keyIdx = 0;

      const boldParts = lineText.split(/\*\*([^*]+)\*\*/g);
      boldParts.forEach((part, bIdx) => {
        const isBold = bIdx % 2 === 1;
        const codeParts = part.split(/`([^`]+)`/g);
        codeParts.forEach((subPart, cIdx) => {
          const isCode = cIdx % 2 === 1;
          const key = `inline-${bIdx}-${cIdx}-${keyIdx++}`;
          
          if (isCode) {
            parts.push(
              <code key={key} className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 rounded font-mono text-[12px] text-[#00E5CC]">
                {subPart}
              </code>
            );
          } else if (isBold) {
            parts.push(
              <strong key={key} className="font-bold text-[#F0EDE8]">
                {subPart}
              </strong>
            );
          } else {
            parts.push(subPart);
          }
        });
      });

      return parts;
    };

    const flushList = (key: string) => {
      if (currentList.length > 0) {
        const listKey = `list-${key}`;
        if (listType === "ol") {
          elements.push(
            <ol key={listKey} className="list-decimal pl-6 my-2 flex flex-col gap-1.5 text-[14px]">
              {currentList}
            </ol>
          );
        } else {
          elements.push(
            <ul key={listKey} className="list-disc pl-6 my-2 flex flex-col gap-1.5 text-[14px]">
              {currentList}
            </ul>
          );
        }
        currentList = [];
        isInsideList = false;
        listType = null;
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      const key = `block-${idx}`;

      // Headers (e.g., ### Heading)
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        flushList(key);
        const level = headerMatch[1].length;
        const content = headerMatch[2];
        const headerClasses = level === 1 
          ? "text-[20px] font-extrabold text-[#F0EDE8] mt-4 mb-2 font-display" 
          : level === 2 
          ? "text-[17px] font-bold text-[#F0EDE8] mt-3 mb-1.5 font-display" 
          : "text-[15px] font-semibold text-[#00E5CC] mt-2 mb-1 font-display";
        
        elements.push(
          <div key={key} className={headerClasses}>
            {parseInline(content)}
          </div>
        );
        return;
      }

      // Unordered lists (* or -)
      const ulMatch = line.match(/^[\*\-]\s+(.+)$/);
      if (ulMatch) {
        if (!isInsideList || listType !== "ul") {
          flushList(key);
          isInsideList = true;
          listType = "ul";
        }
        currentList.push(
          <li key={`li-${idx}`} className="text-[14px] leading-relaxed text-[rgba(255,255,255,0.7)] ml-2">
            {parseInline(ulMatch[1])}
          </li>
        );
        return;
      }

      // Ordered lists (1., 2., etc.)
      const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (olMatch) {
        if (!isInsideList || listType !== "ol") {
          flushList(key);
          isInsideList = true;
          listType = "ol";
        }
        currentList.push(
          <li key={`li-${idx}`} className="text-[14px] leading-relaxed text-[rgba(255,255,255,0.7)] ml-2">
            {parseInline(olMatch[2])}
          </li>
        );
        return;
      }

      // Blank lines
      if (trimmed === "") {
        flushList(key);
        elements.push(<div key={key} className="h-2" />);
        return;
      }

      // Paragraphs
      flushList(key);
      elements.push(
        <p key={key} className="text-[14px] leading-relaxed text-[rgba(255,255,255,0.75)] mb-2">
          {parseInline(line)}
        </p>
      );
    });

    flushList("end");
    return <div className="flex flex-col gap-1">{elements}</div>;
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
        <div className="leading-[1.6] text-[14px] text-[#F0EDE8]">
          {cleanText ? parseMarkdownToReact(cleanText) : (isStreaming && <span className="animate-pulse">Typing...</span>)}
        </div>
        
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
    <div className="flex-1 flex flex-col h-[580px] md:h-[690px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-[16px] overflow-hidden relative font-sans shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-0 chat-console-grid pointer-events-none opacity-70"></div>

      {/* Agent console header */}
      <div className="relative z-10 px-5 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(6,6,8,0.62)] backdrop-blur-[18px] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-[12px] bg-gradient-to-br from-[#7B5EA7] to-[#00E5CC] flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(0,229,204,0.18)]">
            <span className="absolute inset-0 rounded-[12px] border border-white/20"></span>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4-4-4z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-[18px] text-[#F0EDE8] tracking-tight">
                Grounded Chat Agent
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,229,204,0.22)] bg-[rgba(0,229,204,0.07)] px-2 py-0.5 text-[8px] font-mono uppercase tracking-[0.14em] text-[#00E5CC]">
                <span className="w-1 h-1 rounded-full bg-[#00E5CC] animate-statusPulse"></span>
                Local KB
              </span>
            </div>
            <p className="text-[11px] text-[rgba(255,255,255,0.38)] font-mono truncate">
              {jobId ? `job:${jobId.slice(0, 8)}` : "waiting for indexed knowledge"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Mode", value: useKb ? "Grounded" : "Open" },
            { label: "Turns", value: messages.filter((msg) => msg.sender === "user").length.toString() },
            { label: "State", value: isStreaming ? "Thinking" : "Ready" },
          ].map((item) => (
            <div key={item.label} className="min-w-[78px] rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-3 py-2">
              <span className="block text-[8px] font-mono uppercase tracking-[0.14em] text-[rgba(255,255,255,0.28)]">
                {item.label}
              </span>
              <span className="block mt-0.5 text-[11px] text-[#F0EDE8] font-semibold">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Messages viewport */}
      <div className="relative z-10 flex-1 p-5 md:p-6 overflow-y-auto flex flex-col gap-5 bg-transparent">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full border border-[rgba(0,229,204,0.22)] animate-ringExpand"></div>
              <div className="relative w-14 h-14 rounded-full bg-[rgba(0,229,204,0.08)] border border-[rgba(0,229,204,0.22)] flex items-center justify-center text-[#00E5CC] shadow-[0_0_30px_rgba(0,229,204,0.12)]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <h3 className="font-display font-bold text-[24px] text-[#F0EDE8] tracking-tight">
              Ask from the indexed site.
            </h3>
            <p className="mt-2 text-[13px] text-[rgba(255,255,255,0.42)] font-normal max-w-[420px] leading-[1.7]">
              The agent answers from the generated knowledge base and keeps citations attached when the source is available.
            </p>
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-[620px]">
              {starterPrompts.map((prompt, idx) => (
                <button
                  key={prompt}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={!jobId || isStreaming}
                  className="chat-suggestion text-left min-h-[46px] rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] px-4 py-3 text-[12px] leading-[1.45] text-[rgba(255,255,255,0.56)] hover:text-[#F0EDE8] hover:border-[rgba(0,229,204,0.26)] hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message flex flex-col max-w-full ${
                msg.sender === "user" ? "self-end items-end max-w-[70%]" : "self-start items-start max-w-full"
              }`}
            >
              {msg.sender === "user" ? (
                /* User speech bubble: electric violet glass */
                <div className="relative p-3.5 bg-[rgba(123,94,167,0.18)] border border-[rgba(123,94,167,0.25)] text-[#F0EDE8] rounded-[14px_14px_4px_14px] text-[14px] leading-[1.6] shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                  {renderMessageContent(msg.text)}
                </div>
              ) : (
                /* AI response: plaintext with left border in #00E5CC */
                <div className="relative pl-4 ml-2 border-l-2 border-[#00E5CC] text-[#F0EDE8] text-[14px] leading-[1.6] max-w-full">
                  <span className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-[#00E5CC] shadow-[0_0_12px_rgba(0,229,204,0.8)]"></span>
                  {renderMessageContent(msg.text)}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input container bar: rounded 12px, background 255 0.04 */}
      <div className="relative z-10 p-3 border-t border-[rgba(255,255,255,0.06)] bg-[rgba(6,6,8,0.56)] backdrop-blur-[18px] flex gap-3 items-center">
        <div className={`flex-1 h-[56px] flex items-center bg-[rgba(255,255,255,0.04)] border rounded-[14px] px-3 gap-2 transition-all duration-200 ${
          inputValue.trim()
            ? "border-[rgba(0,229,204,0.32)] shadow-[0_0_28px_rgba(0,229,204,0.08)]"
            : "border-[rgba(255,255,255,0.1)]"
        }`}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputValue)}
            placeholder={jobId ? "Ask the agent a grounded question..." : "Submit URL first..."}
            disabled={!jobId || isStreaming}
            className="flex-1 bg-transparent text-[14px] text-[#F0EDE8] placeholder-[rgba(255,255,255,0.25)] border-none outline-none py-1 focus:ring-0 focus:outline-none min-w-0"
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
            className="premium-btn w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-gradient-to-br from-[#7B5EA7] to-[#00E5CC] text-white border-none shadow-[0_8px_22px_rgba(123,94,167,0.28)] cursor-pointer disabled:from-[#161616] disabled:to-[#161616] disabled:text-[rgba(255,255,255,0.22)] disabled:shadow-none disabled:cursor-not-allowed"
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
