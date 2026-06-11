import React, { useState } from "react";

interface UrlInputProps {
  onCrawlStart: (url: string) => void;
  isLoading: boolean;
  hasKb: boolean;
  onDeployClick: () => void;
  isDeployActive: boolean;
}

export const UrlInput: React.FC<UrlInputProps> = ({ 
  onCrawlStart, 
  isLoading,
  hasKb,
  onDeployClick,
  isDeployActive
}) => {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    // Add protocol fallback if missing
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }
    
    onCrawlStart(targetUrl);
  };

  return (
    <div className="w-full max-w-[640px] mx-auto mt-6 font-sans">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row gap-3 items-center bg-transparent border-none p-0"
      >
        <div className="w-full relative flex-1 h-[48px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgba(255,255,255,0.3)]">
            {/* World / Web icon 16px */}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste target website URL (e.g. https://www.notion.com)..."
            disabled={isLoading}
            className="w-full h-full pl-10 pr-4 py-2 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-[12px] text-[14px] text-[#F0EDE8] placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[rgba(123,94,167,0.6)] focus:ring-3 focus:ring-[rgba(123,94,167,0.12)] transition-all duration-150 disabled:cursor-not-allowed disabled:bg-transparent"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="premium-btn h-[48px] px-5 bg-gradient-to-br from-[#7B5EA7] to-[#5B3F8A] text-white text-[14px] font-medium border-none shadow-[0_4px_20px_rgba(123,94,167,0.35)] hover:brightness-[1.1] hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98] transition-all duration-150 disabled:from-[#161616] disabled:to-[#161616] disabled:text-[rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isLoading ? "Architecting..." : "Crawl & Architect"}
          </button>

          {hasKb && (
            <button
              type="button"
              onClick={onDeployClick}
              className="premium-btn h-[48px] px-5 bg-transparent border border-[rgba(255,255,255,0.15)] text-[#F0EDE8] text-[14px] font-medium hover:bg-[rgba(255,255,255,0.06)] hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98] transition-all duration-150"
            >
              <span>{isDeployActive ? "Viewing Deploy Hub" : "Deploy Agent"}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
