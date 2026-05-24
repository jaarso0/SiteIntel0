import { useState, useEffect } from "react";
import { UrlInput } from "./components/UrlInput";
import { ProgressBar } from "./components/ProgressBar";
import { ChatPanel } from "./components/ChatPanel";
import { KbViewer } from "./components/KbViewer";
import { DeployHub } from "./components/DeployHub";
import { OnboardingFlow } from "./components/OnboardingFlow";

const API_BASE = "http://localhost:8080";

function App() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [kb, setKb] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"chat" | "kb" | "deploy">("chat");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Poll job status
  useEffect(() => {
    if (!jobId || !isLoading) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/status/${jobId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch job status");
        }
        
        const data = await response.json();
        setStatus(data.status);
        setProgress(data.progress || 0);
        setError(data.error || null);

        if (data.status === "ready") {
          setIsLoading(false);
          setKb(data.kb);
          setViewMode("kb");
          clearInterval(interval);
        } else if (data.status === "failed") {
          setIsLoading(false);
          clearInterval(interval);
        }
      } catch (err: any) {
        console.error("Polling error:", err);
        setError("Network error polling status.");
        setIsLoading(false);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, isLoading]);

  const handleCrawlStart = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    setStatus("pending");
    setJobId(null);
    setSubmittedUrl(url);
    setShowOnboarding(true);

    try {
      const response = await fetch(`${API_BASE}/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error("Failed to initialize crawl pipeline");
      }

      const data = await response.json();
      if (data.job_id) {
        setJobId(data.job_id);
      } else {
        throw new Error("No job ID returned from server");
      }
    } catch (err: any) {
      console.error("Crawl start error:", err);
      setError(err.message || "Failed to contact backend server.");
      setIsLoading(false);
      setStatus("failed");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#060608] text-[#F0EDE8] selection:bg-[#7B5EA7]/20 selection:text-[#F0EDE8]">
      
      {/* Header Bar: sticky, height 52px, rgba background, blur */}
      <header className="sticky top-0 z-50 h-[52px] bg-[rgba(6,6,8,0.85)] backdrop-blur-[20px] border-b border-[rgba(255,255,255,0.06)] px-6">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Brand mark lightning SVG with violet-to-cyan gradient */}
            <div className="w-7 h-7 flex items-center justify-center shrink-0 rounded-[8px] bg-gradient-to-br from-[#7B5EA7] to-[#00E5CC] text-white">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-display font-bold text-[18px] text-[#F0EDE8] tracking-tight">
              SiteIntel
            </span>
          </div>

          {/* Navigation Links: text only, 13px, active cyan bottom border */}
          {kb && (
            <div className="flex gap-6 h-full items-center">
              <button
                onClick={() => setViewMode("chat")}
                className={`h-full px-1 text-[13px] font-normal transition-all duration-150 cursor-pointer border-none bg-transparent flex items-center relative ${
                  viewMode === "chat"
                    ? "text-[#F0EDE8] font-semibold"
                    : "text-[rgba(255,255,255,0.4)] hover:text-[#F0EDE8]"
                }`}
              >
                <span>Chat Agent</span>
                {viewMode === "chat" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00E5CC]"></span>
                )}
              </button>
              <button
                onClick={() => setViewMode("kb")}
                className={`h-full px-1 text-[13px] font-normal transition-all duration-150 cursor-pointer border-none bg-transparent flex items-center relative ${
                  viewMode === "kb"
                    ? "text-[#F0EDE8] font-semibold"
                    : "text-[rgba(255,255,255,0.4)] hover:text-[#F0EDE8]"
                }`}
              >
                <span>Knowledge Base</span>
                {viewMode === "kb" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00E5CC]"></span>
                )}
              </button>
              <button
                onClick={() => setViewMode("deploy")}
                className={`h-full px-1 text-[13px] font-normal transition-all duration-150 cursor-pointer border-none bg-transparent flex items-center relative ${
                  viewMode === "deploy"
                    ? "text-[#F0EDE8] font-semibold"
                    : "text-[rgba(255,255,255,0.4)] hover:text-[#F0EDE8]"
                }`}
              >
                <span>Deploy Agent</span>
                {viewMode === "deploy" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00E5CC]"></span>
                )}
              </button>
            </div>
          )}

          {/* Right side: Gemini status chip with pulsing green/cyan dot */}
          <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] px-3 py-1 rounded-[20px]">
            <span className="w-2 h-2 rounded-full bg-[#00E5CC] animate-statusPulse"></span>
            <span className="text-[11px] text-[rgba(255,255,255,0.5)] font-sans font-normal">
              Gemini 2.5 Flash
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-6 flex flex-col gap-6 relative z-10 justify-center">
        {showOnboarding ? (
          <OnboardingFlow
            url={submittedUrl}
            kbReady={kb !== null}
            error={error}
            onComplete={() => {
              setShowOnboarding(false);
              setViewMode("chat");
            }}
          />
        ) : kb === null ? (
          /* SaaS Hero Landing Page (when no URL crawled yet) */
          <div className="flex-1 flex flex-col items-center justify-center py-12 max-w-4xl mx-auto text-center animate-fadeIn">
            {/* Pulsing centered gradient lightning brandmark */}
            <div className="w-12 h-12 flex items-center justify-center rounded-[16px] bg-gradient-to-br from-[#7B5EA7] to-[#00E5CC] text-white shadow-[0_8px_32px_rgba(123,94,167,0.3)] mb-8 animate-statusPulse">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
            </div>

            <h1 className="font-display font-bold text-[36px] md:text-[44px] leading-tight text-[#F0EDE8] tracking-tight max-w-2xl">
              Architect Grounded AI Agents Natively.
            </h1>
            
            <p className="text-sm md:text-base text-[rgba(255,255,255,0.4)] max-w-xl mt-4 mb-10 leading-relaxed font-normal">
              Turn any website into a high-fidelity voice and chat support line. Crawl pages, synthesize structured knowledge bases with Gemini 2.5 Flash, and go live in seconds.
            </p>

            {/* URL Input Bar centered directly under hero */}
            <div className="w-full max-w-[640px]">
              <UrlInput 
                onCrawlStart={handleCrawlStart} 
                isLoading={isLoading} 
                hasKb={false}
                onDeployClick={() => setViewMode("deploy")}
                isDeployActive={false}
              />
            </div>

            {/* Premium feature grid cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-16 w-full px-4">
              {[
                {
                  title: "High-Performance Crawler",
                  desc: "Playwright and BeautifulSoup render, scrape, and extract target domain hierarchies.",
                  color: "border-l-2 border-[#7B5EA7]"
                },
                {
                  title: "Local ChromaDB Vector RAG",
                  desc: "Securely chunk, index, and query local embeddings with zero third-party data leakage.",
                  color: "border-l-2 border-[#00E5CC]"
                },
                {
                  title: "Sandbox & Deploy Hub",
                  desc: "Instantly test voice sandbox calls, copy chat widget embeds, or hook Twilio trunks.",
                  color: "border-l-2 border-[#F0EDE8]"
                }
              ].map((feat, idx) => (
                <div
                  key={idx}
                  className={`premium-card p-5 text-left flex flex-col gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.05)] cursor-default ${feat.color}`}
                >
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[#F0EDE8]">
                    {feat.title}
                  </h4>
                  <p className="text-[11px] text-[rgba(255,255,255,0.4)] leading-relaxed font-normal">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Active Grounded workspace (once url is successfully indexed) */
          <>
            {/* Step 1: URL Entry (re-crawls or swaps active url) */}
            <UrlInput 
              onCrawlStart={handleCrawlStart} 
              isLoading={isLoading} 
              hasKb={true}
              onDeployClick={() => setViewMode("deploy")}
              isDeployActive={viewMode === "deploy"}
            />

            {/* Step 2: Glowing Progress Indicator */}
            <ProgressBar status={status} progress={progress} error={error} />

            {/* Step 3: Single full-width active Chat Panel / Knowledge Base / Deploy Hub */}
            {viewMode === "chat" ? (
              <section className="flex-1 flex flex-col gap-6 mt-4 animate-fadeIn">
                <ChatPanel
                  jobId={jobId}
                  useKb={true}
                />
              </section>
            ) : viewMode === "kb" ? (
              <section className="flex-1 flex flex-col mt-4 animate-fadeIn">
                <KbViewer kb={kb} />
              </section>
            ) : (
              <section className="flex-1 flex flex-col mt-4 animate-fadeIn">
                <DeployHub kb={kb} jobId={jobId} />
              </section>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[11px] text-[rgba(255,255,255,0.4)] border-t border-[rgba(255,255,255,0.06)] mt-auto relative z-10 bg-[rgba(6,6,8,0.5)] font-mono">
        <p className="tracking-wide">
          SiteIntel © 2026. Architected with local Sentence-Transformers & persistent ChromaDB RAG.
        </p>
      </footer>
    </div>
  );
}

export default App;
