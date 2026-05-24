import React, { useState } from "react";
import { DeployHub } from "./DeployHub";

interface KbArticle {
  title: string;
  category: string;
  content: string;
  source_urls: string[];
}

interface QaPair {
  question: string;
  answer: string;
  source_url: string;
}

interface Inconsistency {
  description: string;
  pages: string[];
  severity: "high" | "medium" | "low";
}

interface CoverageGap {
  topic: string;
  priority: "high" | "medium" | "low";
}

interface CompetitorGap {
  topic: string;
  competitor_has_it: boolean;
}

interface KbData {
  business_type: string;
  kb_articles: KbArticle[];
  qa_pairs: QaPair[];
  system_prompt: string;
  inconsistencies: Inconsistency[];
  coverage_gaps: CoverageGap[];
  staleness_flags: { content: string; source_url: string; reason: string }[];
  competitor_gaps: CompetitorGap[];
}

interface KbViewerProps {
  kb: KbData | null;
  jobId: string | null;
}

export const KbViewer: React.FC<KbViewerProps> = ({ kb, jobId }) => {
  const [activeTab, setActiveTab] = useState<"articles" | "qa" | "audit" | "competitors" | "system" | "deploy">("articles");
  const [searchQuery, setSearchQuery] = useState("");

  if (!kb) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-12 glass-panel border border-white/5 rounded-3xl min-h-[450px]">
        <div className="p-4 rounded-full bg-purple-600/10 text-purple-400 mb-4 animate-pulse">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h3 className="font-heading font-bold text-gray-200 text-lg mb-2">No Knowledge Base Loaded</h3>
        <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
          Please submit a URL to crawl and architect. Once ready, the structured Knowledge Base will appear here!
        </p>
      </div>
    );
  }

  // Filter articles based on search
  const filteredArticles = kb.kb_articles?.filter(
    (art) =>
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.content.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Filter Q&As based on search
  const filteredQas = kb.qa_pairs?.filter(
    (qa) =>
      qa.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qa.answer.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getSeverityColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case "high":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "medium":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      default:
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    }
  };

  return (
    <div className="flex-1 flex flex-col glass-panel border border-white/5 rounded-3xl overflow-hidden shadow-2xl min-h-[550px]">
      
      {/* KB Subheader Details */}
      <div className="p-6 border-b border-white/5 bg-gradient-to-r from-purple-950/15 to-cyan-950/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 heading-glow animate-pulse"></span>
            <h2 className="font-heading font-extrabold text-lg text-gray-100 tracking-wide">
              Knowledge Base Architect Dashboard
            </h2>
          </div>
          <p className="text-xs text-muted mt-1 uppercase tracking-wider font-semibold font-mono">
            Structure Type: <span className="text-purple-400 font-bold">{kb.business_type.replace(/_/g, " ")}</span>
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "articles", label: "Articles", count: kb.kb_articles?.length },
            { id: "qa", label: "Q&A Bank", count: kb.qa_pairs?.length },
            { id: "audit", label: "Auditor", count: (kb.inconsistencies?.length || 0) + (kb.staleness_flags?.length || 0) },
            { id: "competitors", label: "Market Gaps", count: kb.competitor_gaps?.length },
            { id: "system", label: "Agent Config" },
            { id: "deploy", label: "🚀 Deploy" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20 scale-105"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-black/30 text-purple-400"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar (Visible for articles & QA) */}
      {(activeTab === "articles" || activeTab === "qa") && (
        <div className="p-4 border-b border-white/5 bg-black/10">
          <div className="relative max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/10 focus:border-purple-500 rounded-xl text-xs text-gray-200 focus:outline-none transition-all duration-300"
            />
            <svg className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      )}

      {/* Dashboard Viewport */}
      <div className="flex-1 p-6 overflow-y-auto bg-black/10 max-h-[500px]">
        
        {/* Tab 1: Articles */}
        {activeTab === "articles" && (
          <div className="flex flex-col gap-6">
            {filteredArticles.length === 0 ? (
              <p className="text-center text-xs text-muted py-12">No articles match your search query.</p>
            ) : (
              filteredArticles.map((art, idx) => (
                <div key={idx} className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-3 relative overflow-hidden hover:border-purple-500/20 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/[0.02] rounded-full blur-xl pointer-events-none"></div>
                  
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-heading font-bold text-gray-100 text-sm md:text-base">
                      {art.title}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md">
                      {art.category}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-gray-300 whitespace-pre-line tracking-wide">
                    {art.content}
                  </p>

                  <div className="flex flex-wrap gap-2 items-center border-t border-white/5 pt-3 mt-1">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-muted">Source Pages:</span>
                    {art.source_urls?.map((url, uidx) => (
                      <a
                        key={uidx}
                        href={url.startsWith("http") ? url : `https://${url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[9px] font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-500/10 hover:border-cyan-400/40 px-2 py-0.5 rounded transition-all duration-300"
                      >
                        {url.replace(/^https?:\/\/(www\.)?/, "").substring(0, 35)}
                        {url.length > 35 && "..."}
                      </a>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Q&A Pairs */}
        {activeTab === "qa" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredQas.length === 0 ? (
              <p className="col-span-2 text-center text-xs text-muted py-12">No Q&As match your search query.</p>
            ) : (
              filteredQas.map((qa, idx) => (
                <div key={idx} className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-2.5 hover:border-cyan-500/20 transition-all duration-300">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono">Q</span>
                    <h4 className="font-heading font-semibold text-gray-200 text-xs md:text-sm">
                      {qa.question}
                    </h4>
                  </div>
                  <div className="flex items-start gap-2 border-t border-white/5 pt-3.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono">A</span>
                    <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap tracking-wide">
                      {qa.answer}
                    </p>
                  </div>
                  {qa.source_url && (
                    <div className="mt-2 text-[9px] text-muted flex items-center gap-1.5">
                      <span>Source:</span>
                      <a
                        href={qa.source_url.startsWith("http") ? qa.source_url : `https://${qa.source_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-cyan-500 hover:underline"
                      >
                        {qa.source_url.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Quality Auditor Insights */}
        {activeTab === "audit" && (
          <div className="flex flex-col gap-6">
            
            {/* Contradictions / Inconsistencies */}
            <div>
              <h3 className="font-heading font-bold text-gray-200 text-sm tracking-wide mb-3 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-red-500 rounded-sm"></span>
                Flagged Contradictions ({kb.inconsistencies?.length || 0})
              </h3>
              {(!kb.inconsistencies || kb.inconsistencies.length === 0) ? (
                <div className="glass-panel p-4 rounded-xl border border-white/5 text-center text-xs text-green-400 bg-green-950/5">
                  ✓ Success: Auditor detected zero content contradictions on your site!
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {kb.inconsistencies.map((inc, idx) => (
                    <div key={idx} className="glass-panel p-4 rounded-xl border border-white/5 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityColor(inc.severity)}`}>
                          {inc.severity} Severity Inconsistency
                        </span>
                      </div>
                      <p className="text-xs text-gray-200 leading-relaxed">{inc.description}</p>
                      <div className="flex flex-wrap gap-2 items-center text-[10px] text-muted border-t border-white/5 pt-2 mt-1">
                        <span>Contradicting Pages:</span>
                        {inc.pages?.map((p, pidx) => (
                          <a key={pidx} href={p} target="_blank" rel="noreferrer" className="text-cyan-500 hover:underline font-mono">
                            {p.replace(/^https?:\/\/(www\.)?/, "")}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Staleness / Outdated Content */}
            <div className="mt-4">
              <h3 className="font-heading font-bold text-gray-200 text-sm tracking-wide mb-3 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-orange-500 rounded-sm"></span>
                Staleness & Outdated Content ({kb.staleness_flags?.length || 0})
              </h3>
              {(!kb.staleness_flags || kb.staleness_flags.length === 0) ? (
                <div className="glass-panel p-4 rounded-xl border border-white/5 text-center text-xs text-cyan-400 bg-cyan-950/5">
                  ✓ Success: No outdated dates, seasons, or stale records detected on the site.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {kb.staleness_flags.map((stale, idx) => (
                    <div key={idx} className="glass-panel p-4 rounded-xl border border-white/5 flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded">Stale Fact</span>
                        <a href={stale.source_url} target="_blank" rel="noreferrer" className="text-[9px] font-mono text-cyan-400 hover:underline">
                          {stale.source_url.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                      </div>
                      <p className="text-xs text-gray-300 italic">"{stale.content}"</p>
                      <p className="text-xs text-gray-200 font-semibold border-t border-white/5 pt-2"><span className="text-orange-400">Reason:</span> {stale.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        )}

        {/* Tab 4: Competitor and Market Gaps */}
        {activeTab === "competitors" && (
          <div className="flex flex-col gap-6">
            
            {/* General Content Gaps */}
            <div>
              <h3 className="font-heading font-bold text-gray-200 text-sm tracking-wide mb-3 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-purple-500 rounded-sm"></span>
                Identified Coverage Gaps ({kb.coverage_gaps?.length || 0})
              </h3>
              {(!kb.coverage_gaps || kb.coverage_gaps.length === 0) ? (
                <p className="text-xs text-muted">No coverage gaps detected on the site.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {kb.coverage_gaps.map((gap, idx) => (
                    <div key={idx} className="glass-panel p-4 rounded-xl border border-white/5 flex flex-col gap-1.5 justify-between">
                      <p className="text-xs text-gray-200 font-medium leading-relaxed">{gap.topic}</p>
                      <span className={`text-[8px] font-bold uppercase tracking-wider w-max px-2 py-0.5 rounded border ${
                        gap.priority === "high"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : gap.priority === "medium"
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                          : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      }`}>
                        {gap.priority} Priority Gap
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Competitor Gap Analysis */}
            <div className="mt-4">
              <h3 className="font-heading font-bold text-gray-200 text-sm tracking-wide mb-3 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-cyan-500 rounded-sm"></span>
                Competitor Feature Matrix ({kb.competitor_gaps?.length || 0})
              </h3>
              {(!kb.competitor_gaps || kb.competitor_gaps.length === 0) ? (
                <div className="glass-panel p-4 rounded-xl border border-white/5 text-center text-xs text-green-400 bg-green-950/5">
                  ✓ Success: Fully competitive! No feature gaps found against analyzed competitor sites.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {kb.competitor_gaps.map((gap, idx) => (
                    <div key={idx} className="glass-panel px-4 py-3 rounded-xl border border-white/5 flex items-center justify-between">
                      <span className="text-xs text-gray-200 font-medium">{gap.topic}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Competitor Has It
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab 5: Voice Agent system prompt config */}
        {activeTab === "system" && (
          <div className="flex flex-col gap-4">
            <h3 className="font-heading font-bold text-gray-200 text-sm tracking-wide mb-1 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-teal-500 rounded-sm"></span>
              Synthesized Voice Agent System Instructions
            </h3>
            <p className="text-xs text-muted leading-relaxed mb-2">
              This system prompt was dynamically synthesized from the website's tone of voice, content, and guidelines, and is fed directly to the conversational agent:
            </p>
            <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-black/35 font-mono text-xs leading-relaxed text-purple-300 max-h-[350px] overflow-y-auto whitespace-pre-wrap select-all">
              {kb.system_prompt}
            </div>
          </div>
        )}

        {/* Tab 6: Deployed Agent Channels & Simulator */}
        {activeTab === "deploy" && (
          <DeployHub kb={kb} jobId={jobId} />
        )}

      </div>
    </div>
  );
};
