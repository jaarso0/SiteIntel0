import React, { useState, useEffect } from "react";
import { UrlInput } from "./components/UrlInput";
import { ProgressBar } from "./components/ProgressBar";
import { ChatPanel } from "./components/ChatPanel";

const API_BASE = "http://localhost:8080";

function App() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="flex-1 flex flex-col min-h-screen bg-[#06070a] text-gray-100 selection:bg-purple-500/30 selection:text-purple-200">
      
      {/* Decorative Cyber Grid Background Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
      
      {/* Header Bar */}
      <header className="glass-panel border-b border-white/5 py-4 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Glowing SiteIntel Neon Logo */}
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="font-heading font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-gray-100 to-purple-300 bg-clip-text text-transparent heading-glow">
                SiteIntel
              </h1>
              <p className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                Grounded Knowledge Base Architect
              </p>
            </div>
          </div>

          {/* Quick Stats / Info badge */}
          <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl text-xs text-gray-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Gemini 2.5 Flash Online
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6 relative z-10">
        
        {/* Step 1: URL Entry */}
        <UrlInput onCrawlStart={handleCrawlStart} isLoading={isLoading} />

        {/* Step 2: Glowing Progress Indicator */}
        <ProgressBar status={status} progress={progress} error={error} />

        {/* Step 3: High-Fidelity Split Screen Chat Demonstration */}
        <section className="flex-1 flex flex-col lg:flex-row gap-6 mt-4">
          <ChatPanel
            jobId={jobId}
            useKb={false}
            label="Without KB"
          />
          <ChatPanel
            jobId={jobId}
            useKb={true}
            label="With KB — SiteIntel"
          />
        </section>
      </main>

      {/* Footer footer */}
      <footer className="py-6 text-center text-[11px] text-muted border-t border-white/5 mt-auto relative z-10 bg-black/20">
        <p className="tracking-wide">
          SiteIntel © 2026. Architected with local Sentence-Transformers & persistent ChromaDB RAG.
        </p>
      </footer>
    </div>
  );
}

export default App;
