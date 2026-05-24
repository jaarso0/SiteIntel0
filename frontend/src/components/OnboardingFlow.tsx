import React, { useState, useEffect } from "react";

interface OnboardingFlowProps {
  url: string;
  kbReady: boolean;
  error: string | null;
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ url, kbReady, error, onComplete }) => {
  const [phase, setPhase] = useState<1 | 2 | 3 | "final">(1);
  const [isCollapsingPhase1, setIsCollapsingPhase1] = useState(false);
  const [isCompressingPhase2, setIsCompressingPhase2] = useState(false);

  // Phase 1: crawling counts & dots state
  const [pagesCrawled, setPagesCrawled] = useState(1);
  
  // Phase 2: embedding count state
  const [embeddingsCount, setEmbeddingsCount] = useState(0);



  // Generate Crawling nodes coordinates (centered in 600x400 SVG box)
  const rootNode = { x: 300, y: 200, label: url };
  const nodes = [
    { id: 1, x: 160, y: 120, label: "/pricing" },
    { id: 2, x: 440, y: 120, label: "/docs" },
    { id: 3, x: 140, y: 280, label: "/about" },
    { id: 4, x: 460, y: 280, label: "/features" },
    { id: 5, x: 300, y: 70, label: "/api" },
    { id: 6, x: 300, y: 330, label: "/integrations" },
    // Grandchildren
    { id: 7, x: 80, y: 80, label: "/pricing/plans", parentId: 1 },
    { id: 8, x: 520, y: 80, label: "/docs/setup", parentId: 2 },
    { id: 9, x: 60, y: 320, label: "/about/team", parentId: 3 },
    { id: 10, x: 540, y: 320, label: "/features/ai", parentId: 4 },
  ];

  // Helper to trace edges
  const edges = nodes.map((node) => {
    if (node.parentId) {
      const parent = nodes.find((n) => n.id === node.parentId)!;
      return { x1: parent.x, y1: parent.y, x2: node.x, y2: node.y, targetId: node.id };
    }
    return { x1: rootNode.x, y1: rootNode.y, x2: node.x, y2: node.y, targetId: node.id };
  });

  // Predefined list of 8 knowledge chunk cards
  const cards = [
    { title: "Pricing Plans · 4 chunks", color: "#7B5EA7" },
    { title: "Integration Docs · 7 chunks", color: "#00E5CC" },
    { title: "FAQ · 12 chunks", color: "#7B5EA7" },
    { title: "User Authentication · 5 chunks", color: "#00E5CC" },
    { title: "API Reference · 18 chunks", color: "#7B5EA7" },
    { title: "Refund Policy · 3 chunks", color: "#00E5CC" },
    { title: "Security Standards · 9 chunks", color: "#7B5EA7" },
    { title: "Getting Started · 6 chunks", color: "#00E5CC" },
  ];

  // Step sequences
  useEffect(() => {
    // 1. Pages Crawled Bursts (starts at 1, ticks dynamically)
    const crawlInterval = setInterval(() => {
      if (phase === 1) {
        setPagesCrawled((prev) => {
          if (prev >= 32) {
            clearInterval(crawlInterval);
            return 32;
          }
          const chance = Math.random();
          if (chance > 0.7) return prev + Math.floor(Math.random() * 8) + 3; // burst
          if (chance > 0.3) return prev + Math.floor(Math.random() * 2) + 1; // single
          return prev;
        });
      }
    }, 280);

    // 2. Collapse Phase 1 early at 3600ms
    const collapseP1Timer = setTimeout(() => {
      setIsCollapsingPhase1(true);
    }, 3600);

    // 3. Advance to Phase 2 at 4000ms
    const toPhase2Timer = setTimeout(() => {
      setPhase(2);
      setIsCollapsingPhase1(false);
    }, 4000);

    return () => {
      clearInterval(crawlInterval);
      clearTimeout(collapseP1Timer);
      clearTimeout(toPhase2Timer);
    };
  }, []);

  // Phase 2 timers
  useEffect(() => {
    if (phase !== 2) return;

    // Fast embedding tick (Interval of 50ms adding 15-40 embeddings)
    const embedInterval = setInterval(() => {
      setEmbeddingsCount((prev) => {
        if (prev >= 1800) {
          clearInterval(embedInterval);
          return 1842;
        }
        return prev + Math.floor(Math.random() * 25) + 15;
      });
    }, 50);

    // Compress Phase 2 early at 2000ms (500ms before P3)
    const compressP2Timer = setTimeout(() => {
      setIsCompressingPhase2(true);
    }, 2000);

    // Advance to Phase 3 at 2500ms
    const toPhase3Timer = setTimeout(() => {
      setPhase(3);
      setIsCompressingPhase2(false);
      setEmbeddingsCount(1842); // make sure it matches target
    }, 2500);

    return () => {
      clearInterval(embedInterval);
      clearTimeout(compressP2Timer);
      clearTimeout(toPhase3Timer);
    };
  }, [phase]);

  // Phase 3 timers
  useEffect(() => {
    if (phase !== 3) return;

    // Phase 3 lasts 1500ms, then hold for 600ms before final CTA page
    const toFinalTimer = setTimeout(() => {
      setPhase("final");
    }, 2100);

    return () => {
      clearTimeout(toFinalTimer);
    };
  }, [phase]);

  return (
    <div className="w-full flex-grow flex flex-col items-center justify-center min-h-[500px] py-12 relative overflow-hidden select-none font-sans bg-[#060608]">
      
      {/* PHASE 1: CRAWLING */}
      {phase === 1 && (
        <div className={`flex flex-col items-center justify-center gap-6 w-full ${isCollapsingPhase1 ? "animate-collapseGraph" : "animate-fadeIn"}`}>
          {/* Top Label */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC] animate-statusPulse"></span>
            <span className="text-[10px] font-medium tracking-[0.2em] text-[#00E5CC] uppercase">
              CRAWLING
            </span>
          </div>

          {/* Node Graph Area */}
          <div className="w-full max-w-[600px] h-[400px] relative">
            <svg 
              className="w-full h-full" 
              viewBox="0 0 600 400"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7B5EA7" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00E5CC" stopOpacity="0.3" />
                </linearGradient>
              </defs>

              {/* Edge lines with draw keyframe staggered */}
              {edges.map((edge, idx) => {
                const len = Math.sqrt(Math.pow(edge.x2 - edge.x1, 2) + Math.pow(edge.y2 - edge.y1, 2));
                return (
                  <g key={idx}>
                    <line
                      x1={edge.x1}
                      y1={edge.y1}
                      x2={edge.x2}
                      y2={edge.y2}
                      stroke="url(#edge-grad)"
                      strokeWidth="1.2"
                      strokeDasharray={len}
                      strokeDashoffset={len}
                      style={{
                        animation: `drawPath 400ms cubic-bezier(0.4, 0, 0.2, 1) ${idx * 300}ms forwards`
                      }}
                    />
                    
                    {/* Travelling Dot along active edge (Wait for line draw to finish) */}
                    <circle cx={edge.x1} cy={edge.y1} r="2" fill="#00E5CC" opacity="0">
                      <animate 
                        attributeName="cx" 
                        from={edge.x1} 
                        to={edge.x2} 
                        dur="1.5s" 
                        begin={`${idx * 300 + 400}ms`} 
                        repeatCount="indefinite" 
                      />
                      <animate 
                        attributeName="cy" 
                        from={edge.y1} 
                        to={edge.y2} 
                        dur="1.5s" 
                        begin={`${idx * 300 + 400}ms`} 
                        repeatCount="indefinite" 
                      />
                      <animate
                        attributeName="opacity"
                        from="0.9"
                        to="0.9"
                        dur="0.1s"
                        begin={`${idx * 300 + 400}ms`}
                        fill="freeze"
                      />
                    </circle>
                  </g>
                );
              })}

              {/* Center Root Node */}
              <circle
                cx={rootNode.x}
                cy={rootNode.y}
                r="14"
                fill="rgba(123, 94, 167, 0.15)"
                stroke="#7B5EA7"
                strokeWidth="1.5"
                className="transition-all duration-300"
              />

              {/* Child & Grandchild Nodes with staggered fade in */}
              {nodes.map((node, idx) => (
                <circle
                  key={node.id}
                  cx={node.x}
                  cy={node.y}
                  r="8"
                  fill="rgba(0, 229, 204, 0.08)"
                  stroke="rgba(0, 229, 204, 0.3)"
                  strokeWidth="1"
                  opacity="0"
                  style={{
                    animation: `fadeIn 300ms ease-out ${idx * 300 + 350}ms forwards`
                  }}
                />
              ))}
            </svg>

            {/* Root Domain URL label text */}
            <div 
              className="absolute left-1/2 text-center -translate-x-1/2 pointer-events-none mt-2 font-mono text-[11px] text-[rgba(255,255,255,0.4)]"
              style={{ top: `${rootNode.y + 16}px` }}
            >
              {rootNode.label}
            </div>

            {/* Child Node Labels overlay staggered */}
            {nodes.map((node, idx) => (
              <div
                key={node.id}
                className="absolute text-center pointer-events-none font-mono text-[9px] text-[rgba(255,255,255,0.25)] opacity-0 -translate-x-1/2"
                style={{
                  left: `${node.x}px`,
                  top: `${node.y + 10}px`,
                  animation: `fadeIn 300ms ease-out ${idx * 300 + 400}ms forwards`
                }}
              >
                {node.label}
              </div>
            ))}
          </div>

          {/* Counter bottom-center */}
          <div className="font-mono text-xs text-[rgba(255,255,255,0.35)] tracking-wide">
            {pagesCrawled} pages crawled
          </div>
        </div>
      )}

      {/* PHASE 2: ARCHITECTING */}
      {phase === 2 && (
        <div className={`flex flex-col items-center justify-center gap-6 w-full ${isCompressingPhase2 ? "animate-cardsCompress" : "animate-fadeIn"}`}>
          {/* Top Label */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC] animate-statusPulse"></span>
            <span className="text-[10px] font-medium tracking-[0.2em] text-[#00E5CC] uppercase">
              VECTORIZING
            </span>
          </div>

          {/* Card Stack Container (Width 420px max) */}
          <div className="flex flex-col gap-2 w-full max-w-[420px] px-4 min-h-[310px] justify-center">
            {cards.map((card, idx) => (
              <div
                key={idx}
                className="animate-cardSlideUp flex items-center justify-between w-full h-[36px] px-4.5 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-[8px]"
                style={{ animationDelay: `${idx * 150}ms` }}
              >
                <div className="flex items-center gap-3">
                  {/* Alternating left dot indicator */}
                  <span 
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: card.color }}
                  ></span>
                  <span className="text-xs font-normal text-[rgba(255,255,255,0.5)]">
                    {card.title}
                  </span>
                </div>

                {/* Staggered green tick check icon */}
                <div 
                  className="opacity-0 flex items-center justify-center text-[#00E5CC]"
                  style={{
                    animation: `fadeInCheck 300ms cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 150 + 400}ms forwards`
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* Embedding Tickers */}
          <div className="font-mono text-xs text-[rgba(255,255,255,0.35)] tracking-wide">
            {embeddingsCount.toLocaleString()} embeddings created
          </div>
        </div>
      )}

      {/* PHASE 3: DEPLOYING */}
      {phase === 3 && (
        <div className="flex flex-col items-center justify-center gap-6 w-full animate-fadeIn relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] pointer-events-none">
            {/* Concentric expands */}
            <div className="absolute top-1/2 left-1/2 w-10 h-10 border border-[rgba(0,229,204,0.4)] rounded-full animate-ringExpand" style={{ animationDelay: "0ms" }}></div>
            <div className="absolute top-1/2 left-1/2 w-10 h-10 border border-[rgba(0,229,204,0.4)] rounded-full animate-ringExpand" style={{ animationDelay: "200ms" }}></div>
            <div className="absolute top-1/2 left-1/2 w-10 h-10 border border-[rgba(0,229,204,0.4)] rounded-full animate-ringExpand" style={{ animationDelay: "400ms" }}></div>
          </div>

          {/* Central Pulsing Glowing Orb */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7B5EA7] to-[#00E5CC] animate-pulseOrb shadow-[0_0_40px_rgba(0,229,204,0.4)]"></div>

          {/* Agent ready text header */}
          <h2 className="opacity-0 font-display font-bold text-[14px] tracking-[0.15em] text-[#F0EDE8] uppercase mt-2"
              style={{ animation: "fadeIn 350ms ease-out 600ms forwards" }}
          >
            AGENT READY
          </h2>
        </div>
      )}

      {/* FINAL STATE: REVEAL */}
      {phase === "final" && (
        <div className="flex flex-col items-center justify-center text-center animate-fadeIn max-w-[480px] px-6">
          {/* Slower Breathing Large Orb */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#7B5EA7] to-[#00E5CC] animate-breathe shadow-[0_0_40px_rgba(123,94,167,0.45)]"></div>

          <h1 className="font-display font-bold text-[24px] text-[#F0EDE8] tracking-wide mt-6">
            {error ? "Pipeline processing failed." : "Your agent is ready."}
          </h1>

          <p className="text-[13px] text-[rgba(255,255,255,0.4)] mt-2.5 mb-8 tracking-wide font-normal">
            {error 
              ? `Error: ${error}` 
              : <>Grounded on <span className="font-mono text-[12px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded text-[rgba(255,255,255,0.65)]">{url}</span>. Zero hallucinations.</>}
          </p>

          {/* Button sync with active knowledge database */}
          {error ? (
            <button
              onClick={onComplete}
              className="premium-btn h-[52px] w-[260px] flex items-center justify-center gap-2 border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[#ef4444] rounded-[14px] text-[15px] font-semibold tracking-[0.03em] hover:bg-[rgba(239,68,68,0.15)] transition-all duration-200 cursor-pointer"
            >
              <span>Pipeline Failed. Close</span>
            </button>
          ) : (
            <button
              onClick={kbReady ? onComplete : undefined}
              disabled={!kbReady}
              className={`premium-btn h-[52px] w-[260px] flex items-center justify-center gap-2 border-none rounded-[14px] text-[15px] font-semibold tracking-[0.03em] shadow-[0_8px_40px_rgba(123,94,167,0.45)] transition-all duration-200 ${
                kbReady 
                  ? "bg-gradient-to-r from-[#7B5EA7] to-[#00E5CC] text-white hover:-translate-y-[2px] hover:shadow-[0_12px_50px_rgba(123,94,167,0.65)] cursor-pointer"
                  : "bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.3)] shadow-none cursor-wait"
              }`}
            >
              {kbReady ? (
                <>
                  <span>Open Agent Chat</span>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              ) : (
                <div className="flex items-center gap-2.5">
                  {/* Loader */}
                  <div className="w-4 h-4 border-2 border-[rgba(255,255,255,0.2)] border-t-[rgba(255,255,255,0.8)] rounded-full animate-spin"></div>
                  <span>Finalizing Agent...</span>
                </div>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
