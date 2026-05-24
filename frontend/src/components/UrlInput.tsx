import React, { useState } from "react";

interface UrlInputProps {
  onCrawlStart: (url: string) => void;
  isLoading: boolean;
}

export const UrlInput: React.FC<UrlInputProps> = ({ onCrawlStart, isLoading }) => {
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
    <div className="w-full max-w-4xl mx-auto px-4 mt-6">
      <form
        onSubmit={handleSubmit}
        className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-center shadow-lg"
      >
        <div className="w-full relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {/* World / Web icon */}
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste target website URL (e.g. https://www.prephelp.in)..."
            disabled={isLoading}
            className="w-full pl-11 pr-4 py-3.5 bg-black/30 border border-white/10 hover:border-white/15 focus:border-purple-500 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none transition-all duration-300 tracking-wide text-sm font-sans focus:ring-1 focus:ring-purple-500/30"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className={`glow-button px-7 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold tracking-wide flex items-center gap-3 transition-all duration-300 shadow-md shadow-purple-600/20 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <>
              {/* Spinner */}
              <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Architecting...
            </>
          ) : (
            <>
              {/* Wand / Bolt icon */}
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Crawl & Architect
            </>
          )}
        </button>
      </form>
    </div>
  );
};
