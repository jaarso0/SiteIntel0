import React from "react";

interface ProgressBarProps {
  status: string;
  progress: number;
  error?: string | null;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ status, progress, error }) => {
  if (status === "ready" || status === "not_found" || !status) return null;

  // Custom step titles and descriptions
  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return {
          label: "Initializing Pipeline",
          desc: "Preparing our crawling pipeline...",
          color: "bg-[#7B5EA7]",
        };
      case "crawling":
        return {
          label: "Crawling Phase",
          desc: "Playwright is rendering pages and BeautifulSoup is extracting links...",
          color: "bg-[#7B5EA7]",
        };
      case "building_kb":
        return {
          label: "AI Architect Synthesis",
          desc: "Gemini 2.5 Flash is mapping the entire site into structured JSON...",
          color: "bg-[#7B5EA7]",
        };
      case "auditing":
        return {
          label: "Quality Auditor Review",
          desc: "Analyzing the knowledge base for inconsistencies and coverage gaps...",
          color: "bg-[#7B5EA7]",
        };
      case "re-crawling":
        return {
          label: "Targeted Re-Crawl Loop",
          desc: "Auditor flagged high-priority gaps! Running targeted re-crawl...",
          color: "bg-[#7B5EA7]",
        };
      case "re-building_kb":
        return {
          label: "Updating Architecture",
          desc: "Gemini 2.5 Flash is integrating newly fetched knowledge...",
          color: "bg-[#7B5EA7]",
        };
      case "indexing":
        return {
          label: "Local Semantic Indexing",
          desc: "Chunking texts and embedding locally into ChromaDB...",
          color: "bg-[#7B5EA7]",
        };
      case "failed":
        return {
          label: "Pipeline Failure",
          desc: error || "An unexpected error occurred during processing.",
          color: "bg-[#ef4444]",
        };
      default:
        return {
          label: "Processing Job",
          desc: "Synthesizing site structure...",
          color: "bg-[#7B5EA7]",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="w-full max-w-4xl mx-auto my-6 px-4 font-sans">
      <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] backdrop-blur-[12px] p-6 rounded-[14px] relative overflow-hidden transition-all duration-150">
        
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            {status !== "failed" ? (
              <span className="h-2.5 w-2.5 rounded-full bg-[#00E5CC] animate-statusPulse"></span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]"></span>
            )}
            <h3 className="font-mono font-semibold text-xs tracking-wide text-[#F0EDE8] uppercase">
              {config.label}
            </h3>
          </div>
          <span className="font-mono text-xs font-semibold text-[#F0EDE8]">
            {progress}%
          </span>
        </div>

        <p className="text-xs text-[rgba(255,255,255,0.4)] mb-4 tracking-wide leading-relaxed font-normal">
          {config.desc}
        </p>

        {/* Flat progress bar track */}
        <div className="w-full h-1.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-[12px] p-[1px]">
          <div
            className={`h-full ${config.color} transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Detailed steps list */}
        <div className="mt-4 flex flex-wrap gap-4 text-[10px] font-mono font-semibold text-[rgba(255,255,255,0.35)] justify-between uppercase">
          <span className={progress >= 10 ? "text-[#7B5EA7]" : ""}>1. Crawl</span>
          <span className="text-[rgba(255,255,255,0.1)] font-normal">{"->"}</span>
          <span className={progress >= 40 ? "text-[#7B5EA7]" : ""}>2. Synthesize KB</span>
          <span className="text-[rgba(255,255,255,0.1)] font-normal">{"->"}</span>
          <span className={progress >= 70 ? "text-[#7B5EA7]" : ""}>3. Quality Audit</span>
          <span className="text-[rgba(255,255,255,0.1)] font-normal">{"->"}</span>
          <span className={progress >= 85 ? "text-[#7B5EA7]" : ""}>4. Index RAG</span>
        </div>
      </div>
    </div>
  );
};
