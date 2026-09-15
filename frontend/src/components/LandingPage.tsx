import React, { useState } from "react";
import { UrlInput } from "./UrlInput";

interface LandingPageProps {
  onCrawlStart: (url: string) => void;
  isLoading: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onCrawlStart, isLoading }) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "How does the SiteIntel high-performance crawler work?",
      a: "SiteIntel crawls target domains using automated scrapers that fetch web pages, execute dynamic content using modern layout parsers, and extract high-fidelity semantic structures. It also identifies your top competitors automatically, crawling their main interfaces in parallel to build comparative contextual intelligence."
    },
    {
      q: "Is my corporate or proprietary data secure with ChromaDB?",
      a: "Yes, 100%. SiteIntel relies on a local instance of ChromaDB running directly within your workspace infrastructure. Your document chunks are embedded locally using private Sentence-Transformers models. No raw content, documentation, or search queries are sent to public vector databases."
    },
    {
      q: "How does the zero-hallucination guarantee function?",
      a: "SiteIntel constructs strict prompt anchors using the generated local knowledge base context. Our grounded query retrieval system ensures that the backend Gemini model relies exclusively on verified vector chunks to generate responses. If a query falls outside the knowledge base, the model politely declines to answer rather than fabricating facts."
    },
    {
      q: "Can I connect the deployed voice support agent to my phone lines?",
      a: "Absolutely. The integrated Deploy Hub lets you connect your grounded agent to Twilio. By purchasing a virtual phone number and pasting SiteIntel's generated Webhook, customers can call your support line and converse directly with your custom AI agent in real-time."
    }
  ];

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-8 max-w-5xl mx-auto px-4 w-full animate-fadeIn select-none font-sans bg-[#060608]">
      
      {/* Mesh Background Glowing Orbs */}
      <div className="absolute top-[10%] left-[20%] w-[350px] h-[350px] bg-gradient-to-br from-[rgba(123,94,167,0.12)] to-transparent rounded-full blur-[80px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[20%] right-[15%] w-[400px] h-[400px] bg-gradient-to-br from-[rgba(0,229,204,0.08)] to-transparent rounded-full blur-[90px] pointer-events-none z-0"></div>

      {/* Hero Badge */}
      <div className="z-10 flex items-center gap-2 px-3 py-1 bg-[rgba(123,94,167,0.08)] border border-[rgba(123,94,167,0.25)] rounded-[20px] mb-6 animate-statusPulse">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC]"></span>
        <span className="text-[10px] font-mono font-semibold tracking-wider text-[#00E5CC] uppercase">
          SiteIntel Platform v2.0
        </span>
      </div>

      {/* Hero Headline */}
      <div className="z-10 text-center max-w-3xl mb-4">
        <h1 className="font-display font-bold text-[36px] md:text-[54px] leading-[1.1] text-[#F0EDE8] tracking-tight">
          Architect Grounded <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#7B5EA7] via-[#9B7EC7] to-[#00E5CC]">
            AI Agents Natively.
          </span>
        </h1>
        <p className="text-sm md:text-base text-[rgba(255,255,255,0.45)] max-w-2xl mt-4 mx-auto leading-relaxed font-normal">
          Turn any website into a high-fidelity voice and chat support assistant in seconds. 
          Crawl pages, synthesize structured local knowledge bases , 
          and deploy zero-hallucination support workflows.
        </p>
      </div>

      {/* URL Ingestion Input Box */}
      <div className="z-10 w-full max-w-[680px] mb-12">
        <UrlInput 
          onCrawlStart={onCrawlStart} 
          isLoading={isLoading} 
          hasKb={false}
          onDeployClick={() => {}}
          isDeployActive={false}
        />

        {/* Dynamic Service Status Dots directly under input */}
        <div className="flex flex-wrap items-center justify-center gap-5 mt-4 text-[10px] font-mono text-[rgba(255,255,255,0.35)]">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC]"></span>
            <span>LiveKit</span>
          </div>
          <span className="text-[rgba(255,255,255,0.1)]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7B5EA7]"></span>
            <span>Playwright</span>
          </div>
          <span className="text-[rgba(255,255,255,0.1)]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC]"></span>
            <span>Voice AI</span>
          </div>
        </div>
      </div>

      {/* Pre-Indexed Demo Sites */}
      <div className="z-10 w-full max-w-[680px] mb-12 animate-fadeIn" style={{ animationDelay: "150ms" }}>
        <h3 className="text-center font-mono text-[10px] font-semibold tracking-wider text-[rgba(255,255,255,0.4)] uppercase mb-3.5">
          Select a pre-indexed site to test immediately:
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: "Prepairo AI", url: "https://prepairo.ai", desc: "Admissions Hub" },
            { name: "StepsAI", url: "https://stepsai.co", desc: "Chat Widget Tool" },
            { name: "Notion", url: "https://www.notion.com", desc: "Workspace Docs" },
            { name: "Zoho", url: "https://www.zoho.com", desc: "SaaS CRM Platform" },
          ].map((demo) => (
            <button
              key={demo.name}
              onClick={() => onCrawlStart(demo.url)}
              disabled={isLoading}
              className="premium-btn text-left p-3.5 bg-[rgba(255,255,255,0.015)] border border-[rgba(255,255,255,0.06)] rounded-[12px] hover:border-[#7B5EA7]/40 hover:bg-[rgba(123,94,167,0.04)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="block text-[12px] font-bold text-[#F0EDE8]">{demo.name}</span>
              <span className="block text-[9px] text-[rgba(255,255,255,0.35)] font-mono mt-0.5">{demo.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Journey Visual Map */}
      <div className="z-10 w-full premium-card p-6 md:p-8 mb-16 border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
        <h3 className="font-display font-bold text-sm text-[#F0EDE8] uppercase tracking-wider mb-6 text-center">
          Grounded RAG Pipeline Architecture
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center p-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(123,94,167,0.1)] border border-[#7B5EA7]/30 flex items-center justify-center text-[#7B5EA7] mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <span className="text-[11px] font-mono font-bold text-[#F0EDE8] uppercase">1. Web URL</span>
            <span className="text-[9px] text-[rgba(255,255,255,0.35)] mt-1">Submit target site domain</span>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex justify-center text-[rgba(255,255,255,0.15)]">
            <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center p-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(0,229,204,0.1)] border border-[#00E5CC]/30 flex items-center justify-center text-[#00E5CC] mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <span className="text-[11px] font-mono font-bold text-[#F0EDE8] uppercase">2. Playwright Crawl</span>
            <span className="text-[9px] text-[rgba(255,255,255,0.35)] mt-1">Concurrent site & competitor scraper</span>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex justify-center text-[rgba(255,255,255,0.15)]">
            <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center p-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] flex items-center justify-center text-[#F0EDE8] mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span className="text-[11px] font-mono font-bold text-[#F0EDE8] uppercase">3. Local ChromaDB</span>
            <span className="text-[9px] text-[rgba(255,255,255,0.35)] mt-1">Private, local embedding vectors</span>
          </div>
        </div>
      </div>

      {/* Premium Features Showcase Grid */}
      <div className="z-10 grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-20">
        {[
          {
            title: "Lightning-Fast Crawl Engine",
            desc: "Spawns automated Chromium page scrapers that extract site maps, raw markup, and competitor features in minutes.",
            icon: (
              <svg className="w-5 h-5 text-[#7B5EA7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            ),
            border: "hover:border-[#7B5EA7]/30"
          },
          {
            title: "Zero Leakage Local RAG",
            desc: "Maintains absolute data containment. Documents are chunked and vectorized locally with Sentence-Transformers and stored securely in ChromaDB.",
            icon: (
              <svg className="w-5 h-5 text-[#00E5CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ),
            border: "hover:border-[#00E5CC]/30"
          },
          {
            title: "Voice Sandbox & Phone Trunks",
            desc: "Instantly launch LiveKit voice calls to test agent knowledge, or paste our webhook endpoint into Twilio to take real phone call trunks live.",
            icon: (
              <svg className="w-5 h-5 text-[#F0EDE8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            ),
            border: "hover:border-[rgba(255,255,255,0.2)]"
          }
        ].map((feat, idx) => (
          <div
            key={idx}
            className={`premium-card p-6 text-left flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 bg-[rgba(255,255,255,0.015)] border border-[rgba(255,255,255,0.06)] cursor-default ${feat.border}`}
          >
            <div className="w-9 h-9 rounded-[10px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] flex items-center justify-center shrink-0">
              {feat.icon}
            </div>
            <div>
              <h4 className="font-display font-bold text-sm tracking-wide text-[#F0EDE8] mb-1.5">
                {feat.title}
              </h4>
              <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed font-normal">
                {feat.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Accordion FAQ Section */}
      <div className="z-10 w-full max-w-[760px] mb-8">
        <h3 className="font-display font-bold text-lg text-[#F0EDE8] tracking-wide mb-6 text-center">
          Frequently Answered Questions
        </h3>

        <div className="flex flex-col gap-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div 
                key={idx} 
                className="premium-card overflow-hidden border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.015)] transition-all duration-300"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-5 py-4.5 flex items-center justify-between text-left cursor-pointer border-none bg-transparent"
                >
                  <span className="text-xs md:text-sm font-semibold text-[#F0EDE8] tracking-wide pr-4">
                    {faq.q}
                  </span>
                  <span className={`text-[rgba(255,255,255,0.4)] transition-transform duration-300 transform shrink-0 ${isOpen ? "rotate-180 text-[#00E5CC]" : "rotate-0"}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>

                <div 
                  className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[200px] border-t border-[rgba(255,255,255,0.05)] opacity-100 py-4 px-5" : "max-h-0 opacity-0 overflow-hidden"}`}
                >
                  <p className="text-[12px] md:text-xs text-[rgba(255,255,255,0.45)] leading-relaxed font-normal">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
