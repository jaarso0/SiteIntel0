import React, { useState } from "react";

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
}

export const KbViewer: React.FC<KbViewerProps> = ({ kb }) => {
  const [activeTab, setActiveTab] = useState<"articles" | "qa" | "audit" | "competitors" | "system">("articles");
  const [searchQuery, setSearchQuery] = useState("");

  if (!kb) {
    return (
      <div className="flex-grow flex flex-col items-start justify-start p-6 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-[14px] min-h-[450px] font-sans">
        <h3 className="font-mono font-semibold text-[11px] tracking-[0.12em] text-[rgba(255,255,255,0.35)] uppercase mb-2">
          No Knowledge Base Loaded
        </h3>
        <p className="text-sm text-[rgba(255,255,255,0.4)] max-w-sm leading-[1.6]">
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

  const getSeverityStyle = (sev: string) => {
    switch (sev.toLowerCase()) {
      case "high":
        return "border-l-2 border-[#ef4444] text-[#ef4444]";
      case "medium":
        return "border-l-2 border-orange-500 text-orange-500";
      default:
        return "border-l-2 border-yellow-500 text-yellow-500";
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-[14px] overflow-hidden min-h-[550px] font-sans backdrop-blur-[12px]">
      
      {/* KB Subheader Details (Flat and Premium Summary Block at Top) */}
      <div className="p-6 border-b border-[rgba(255,255,255,0.06)] bg-transparent flex flex-col gap-4">
        <div className="summary-block">
          <span className="font-mono">STRUCTURE_TYPE: {kb.business_type.replace(/_/g, " ").toUpperCase()}</span>
        </div>
      </div>

      {/* Main split layout: Left-rail navigation, right-rail tab contents */}
      <div className="flex-1 flex flex-col md:flex-row min-h-[480px]">
        {/* Left rail Tab Navigation */}
        <div className="w-full md:w-[220px] shrink-0 border-r border-[rgba(255,255,255,0.06)] bg-transparent flex flex-col p-4 gap-2">
          {[
            { id: "articles", label: "Articles", count: kb.kb_articles?.length },
            { id: "qa", label: "Q&A Bank", count: kb.qa_pairs?.length },
            { id: "audit", label: "Auditor", count: (kb.inconsistencies?.length || 0) + (kb.staleness_flags?.length || 0) },
            { id: "competitors", label: "Market Gaps", count: kb.competitor_gaps?.length },
            { id: "system", label: "Agent Config" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearchQuery("");
                }}
                className={`w-full text-left pl-3 pr-2 py-2 text-[13px] font-normal transition-all duration-150 cursor-pointer border-none bg-transparent flex items-center justify-between border-l-2 ${
                  isActive
                    ? "text-[#F0EDE8] border-l-[#7B5EA7] font-semibold"
                    : "text-[rgba(255,255,255,0.45)] border-l-transparent hover:text-[#F0EDE8]"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="text-[10px] font-semibold bg-[rgba(123,94,167,0.15)] text-[rgba(123,94,167,0.9)] rounded-[4px] px-1.5 py-0.5 font-sans">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right side contents */}
        <div className="flex-grow flex flex-col bg-transparent">
          {/* Search Bar (Visible for articles & QA) */}
          {(activeTab === "articles" || activeTab === "qa") && (
            <div className="p-4 border-b border-[rgba(255,255,255,0.06)] bg-transparent">
              <div className="relative max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeTab === "articles" ? "articles" : "questions"}...`}
                  className="w-full h-9 pl-8 pr-4 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-[12px] text-xs text-[#F0EDE8] placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[rgba(123,94,167,0.6)] focus:ring-3 focus:ring-[rgba(123,94,167,0.12)] transition-all duration-150"
                />
                <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[rgba(255,255,255,0.3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          )}

          {/* Content Viewport */}
          <div className="flex-grow p-6 overflow-y-auto max-h-[500px] bg-transparent">
            
            {/* Tab 1: Articles */}
            {activeTab === "articles" && (
              <div className="flex flex-col gap-6">
                {filteredArticles.length === 0 ? (
                  <p className="text-xs text-[rgba(255,255,255,0.4)] py-6 font-normal">No articles match your search query.</p>
                ) : (
                  filteredArticles.map((art, idx) => (
                    <div key={idx} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[18px_20px] flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-display font-semibold text-[#F0EDE8] text-[15px]">
                          {art.title}
                        </h3>
                        <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#00E5CC] bg-[rgba(0,229,204,0.08)] border border-[rgba(0,229,204,0.2)] px-2 py-0.5 rounded-[4px] shrink-0">
                          {art.category}
                        </span>
                      </div>

                      <p className="text-[13px] leading-[1.6] text-[rgba(255,255,255,0.5)] whitespace-pre-line font-normal">
                        {art.content}
                      </p>

                      <div className="flex flex-wrap gap-3 items-center border-t border-[rgba(255,255,255,0.06)] pt-3 mt-1">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-[rgba(255,255,255,0.35)] font-mono flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          Source Pages:
                        </span>
                        {art.source_urls?.map((url, uidx) => (
                          <a
                            key={uidx}
                            href={url.startsWith("http") ? url : `https://${url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-mono text-[rgba(255,255,255,0.3)] hover:text-[#00E5CC] transition-colors"
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
              <div className="grid grid-cols-1 gap-4">
                {filteredQas.length === 0 ? (
                  <p className="text-xs text-[rgba(255,255,255,0.4)] py-6 font-normal">No Q&As match your search query.</p>
                ) : (
                  filteredQas.map((qa, idx) => (
                    <div key={idx} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[18px_20px] flex flex-col gap-3">
                      <div className="flex items-start gap-2">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.4)] font-mono">Q</span>
                        <h4 className="font-sans font-semibold text-[#F0EDE8] text-[14px]">
                          {qa.question}
                        </h4>
                      </div>
                      <div className="flex items-start gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3.5">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[rgba(123,94,167,0.15)] text-[#7B5EA7] font-mono">A</span>
                        <p className="text-[13px] text-[rgba(255,255,255,0.5)] leading-[1.6] whitespace-pre-wrap font-normal">
                          {qa.answer}
                        </p>
                      </div>
                      {qa.source_url && (
                        <div className="mt-1 text-[11px] text-[rgba(255,255,255,0.3)] flex items-center gap-1.5 font-mono">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          <span>Source:</span>
                          <a
                            href={qa.source_url.startsWith("http") ? qa.source_url : `https://${qa.source_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#7B5EA7] hover:underline"
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
                  <h3 className="font-mono font-semibold text-[11px] tracking-[0.12em] text-[rgba(255,255,255,0.35)] uppercase mb-3 flex items-center gap-2">
                    <span className="w-1 h-2.5 bg-[#ef4444] rounded-sm"></span>
                    Flagged Contradictions ({kb.inconsistencies?.length || 0})
                  </h3>
                  {(!kb.inconsistencies || kb.inconsistencies.length === 0) ? (
                    <div className="p-4 border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-xs text-[#00E5CC] rounded-[12px]">
                      Auditor detected zero content contradictions on your site.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {kb.inconsistencies.map((inc, idx) => (
                        <div key={idx} className={`p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-[12px] flex flex-col gap-2 ${getSeverityStyle(inc.severity)}`}>
                          <div>
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.35)] font-mono">
                              {inc.severity} Severity Inconsistency
                            </span>
                          </div>
                          <p className="text-xs text-[#F0EDE8] leading-[1.6] font-normal">{inc.description}</p>
                          <div className="flex flex-wrap gap-2 items-center text-[9px] text-[rgba(255,255,255,0.3)] border-t border-[rgba(255,255,255,0.06)] pt-2 mt-1 font-mono">
                            <span>Contradicting Pages:</span>
                            {inc.pages?.map((p, pidx) => (
                              <a key={pidx} href={p} target="_blank" rel="noreferrer" className="text-[#7B5EA7] hover:underline">
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
                  <h3 className="font-mono font-semibold text-[11px] tracking-[0.12em] text-[rgba(255,255,255,0.35)] uppercase mb-3 flex items-center gap-2">
                    <span className="w-1 h-2.5 bg-orange-500 rounded-sm"></span>
                    Staleness & Outdated Content ({kb.staleness_flags?.length || 0})
                  </h3>
                  {(!kb.staleness_flags || kb.staleness_flags.length === 0) ? (
                    <div className="p-4 border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-xs text-[#7B5EA7] rounded-[12px]">
                      No outdated dates, seasons, or stale records detected on the site.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {kb.staleness_flags.map((stale, idx) => (
                        <div key={idx} className="p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-[12px] flex flex-col gap-2">
                          <div className="flex justify-between items-start gap-2 font-mono">
                            <span className="text-[9px] text-orange-500 font-semibold uppercase">Stale Fact</span>
                            <a href={stale.source_url} target="_blank" rel="noreferrer" className="text-[9px] text-[#7B5EA7] hover:underline">
                              {stale.source_url.replace(/^https?:\/\/(www\.)?/, "")}
                            </a>
                          </div>
                          <p className="text-xs text-[rgba(255,255,255,0.4)] italic font-normal">"{stale.content}"</p>
                          <p className="text-xs text-[#F0EDE8] border-t border-[rgba(255,255,255,0.06)] pt-2 font-normal"><span className="text-orange-500 font-semibold">Reason:</span> {stale.reason}</p>
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
                  <h3 className="font-mono font-semibold text-[11px] tracking-[0.12em] text-[rgba(255,255,255,0.35)] uppercase mb-3 flex items-center gap-2">
                    <span className="w-1 h-2.5 bg-[#7B5EA7] rounded-sm"></span>
                    Identified Coverage Gaps ({kb.coverage_gaps?.length || 0})
                  </h3>
                  {(!kb.coverage_gaps || kb.coverage_gaps.length === 0) ? (
                    <p className="text-xs text-[rgba(255,255,255,0.45)] font-normal">No coverage gaps detected on the site.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {kb.coverage_gaps.map((gap, idx) => (
                        <div key={idx} className="p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-[12px] flex items-center justify-between">
                          <p className="text-xs text-[#F0EDE8] font-normal leading-[1.6]">{gap.topic}</p>
                          <span className="text-[9px] font-semibold uppercase tracking-wider font-mono text-orange-500">
                            {gap.priority} Priority Gap
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Competitor Gap Analysis */}
                <div className="mt-4">
                  <h3 className="font-mono font-semibold text-[11px] tracking-[0.12em] text-[rgba(255,255,255,0.35)] uppercase mb-3 flex items-center gap-2">
                    <span className="w-1 h-2.5 bg-[#7B5EA7] rounded-sm"></span>
                    Competitor Feature Matrix ({kb.competitor_gaps?.length || 0})
                  </h3>
                  {(!kb.competitor_gaps || kb.competitor_gaps.length === 0) ? (
                    <div className="p-4 border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-xs text-[#00E5CC] rounded-[12px]">
                      Fully competitive! No feature gaps found against analyzed competitor sites.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {kb.competitor_gaps.map((gap, idx) => (
                        <div key={idx} className="p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-[12px] flex items-center justify-between">
                          <span className="text-xs text-[#F0EDE8] font-normal">{gap.topic}</span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-[rgba(255,255,255,0.06)] bg-transparent text-[#7B5EA7] font-mono">
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
              <div className="flex flex-col gap-4 bg-transparent">
                <h3 className="font-mono font-semibold text-[11px] tracking-[0.12em] text-[rgba(255,255,255,0.35)] uppercase mb-1 flex items-center gap-2">
                  <span className="w-1 h-2.5 bg-[#7B5EA7] rounded-sm"></span>
                  Synthesized Voice Agent System Instructions
                </h3>
                <p className="text-xs text-[rgba(255,255,255,0.4)] leading-[1.6] mb-2 font-normal">
                  This system prompt was dynamically synthesized from the website's tone of voice, content, and guidelines, and is fed directly to the conversational agent:
                </p>
                <div className="p-5 border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] rounded-[12px] font-mono text-xs leading-relaxed text-[#7B5EA7] max-h-[350px] overflow-y-auto whitespace-pre-wrap select-all">
                  {kb.system_prompt}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
