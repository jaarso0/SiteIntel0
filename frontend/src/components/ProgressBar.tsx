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
          desc: "Preparing our zero-AI crawling crawlers...",
          color: "from-blue-500 to-indigo-600",
        };
      case "crawling":
        return {
          label: "Zero-AI Crawling Phase",
          desc: "Playwright is rendering pages and BeautifulSoup is extracting links...",
          color: "from-indigo-500 to-purple-600 animate-pulse",
        };
      case "building_kb":
        return {
          label: "AI Architect Synthesis",
          desc: "Gemini 2.5 Flash is mapping the entire site into structured JSON KB...",
          color: "from-purple-500 to-pink-500",
        };
      case "auditing":
        return {
          label: "Quality Auditor Review",
          desc: "Analyzing the knowledge base for inconsistencies and coverage gaps...",
          color: "from-pink-500 to-orange-500",
        };
      case "re-crawling":
        return {
          label: "Targeted Re-Crawl Loop",
          desc: "Auditor flagged high-priority gaps! Running targeted re-crawl...",
          color: "from-orange-500 to-amber-500 animate-pulse",
        };
      case "re-building_kb":
        return {
          label: "Updating Architecture",
          desc: "Gemini 2.5 Flash is integrating newly fetched knowledge...",
          color: "from-amber-500 to-yellow-500",
        };
      case "indexing":
        return {
          label: "Local Semantic Indexing",
          desc: "Chunking texts and embedding locally into ChromaDB...",
          color: "from-teal-500 to-cyan-500 glow-bar",
        };
      case "failed":
        return {
          label: "Pipeline Failure",
          desc: error || "An unexpected error occurred during processing.",
          color: "from-red-500 to-rose-600",
        };
      default:
        return {
          label: "Processing Job",
          desc: "Synthesizing site structure...",
          color: "from-purple-500 to-blue-500",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="w-full max-w-4xl mx-auto my-6 px-4">
      <div className="glass-panel glass-panel-glow p-6 rounded-2xl border border-white/5 relative overflow-hidden transition-all duration-300">
        {/* Sleek background particle accents */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl"></div>

        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            {status !== "failed" ? (
              // Glowing pulse indicator
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75`}></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            ) : (
              <span className="h-3 w-3 rounded-full bg-red-500"></span>
            )}
            <h3 className="font-heading text-lg font-semibold tracking-wide text-gray-100">
              {config.label}
            </h3>
          </div>
          <span className="font-mono text-sm font-semibold text-cyan-400">
            {progress}%
          </span>
        </div>

        <p className="text-sm text-gray-400 mb-4 tracking-wide">
          {config.desc}
        </p>

        {/* The glowing neon progress bar track */}
        <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5 p-[1px]">
          <div
            className={`h-full rounded-full bg-gradient-to-right ${config.color} transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Detailed steps list */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-gray-500 justify-between">
          <span className={progress >= 10 ? "text-indigo-400" : ""}>1. Crawl</span>
          <span className="text-gray-700">➔</span>
          <span className={progress >= 40 ? "text-purple-400" : ""}>2. Synthesize KB</span>
          <span className="text-gray-700">➔</span>
          <span className={progress >= 70 ? "text-pink-400" : ""}>3. Quality Audit</span>
          <span className="text-gray-700">➔</span>
          <span className={progress >= 85 ? "text-cyan-400" : ""}>4. Index RAG</span>
        </div>
      </div>
    </div>
  );
};
