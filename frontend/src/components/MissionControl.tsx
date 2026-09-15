import React from "react";

interface MissionControlProps {
  kb: any;
  onOpenChat: () => void;
  onOpenKb: () => void;
  onOpenDeploy: () => void;
}

const clampScore = (score: number) => Math.max(0, Math.min(99, Math.round(score)));

export const MissionControl: React.FC<MissionControlProps> = ({
  kb,
  onOpenChat,
  onOpenKb,
  onOpenDeploy,
}) => {
  const articleCount = kb?.kb_articles?.length || 0;
  const qaCount = kb?.qa_pairs?.length || 0;
  const gaps = kb?.coverage_gaps?.length || 0;
  const inconsistencies = kb?.inconsistencies?.length || 0;
  const staleFlags = kb?.staleness_flags?.length || 0;
  const competitorGaps = kb?.competitor_gaps?.length || 0;
  const sourceCount = new Set(
    (kb?.kb_articles || []).flatMap((article: any) => article.source_urls || [])
  ).size;

  const coverageScore = clampScore(58 + articleCount * 4 + qaCount * 2 - gaps * 5);
  const trustScore = clampScore(96 - inconsistencies * 10 - staleFlags * 6);
  const deployScore = clampScore((coverageScore + trustScore + 88) / 3);

  const rings = [
    { label: "Coverage", value: coverageScore, color: "#00E5CC" },
    { label: "Trust", value: trustScore, color: "#7B5EA7" },
    { label: "Deploy", value: deployScore, color: "#F0EDE8" },
  ];

  const lanes = [
    { label: "Source Pages", value: sourceCount || articleCount, tone: "cyan" },
    { label: "Knowledge Articles", value: articleCount, tone: "violet" },
    { label: "Q&A Pairs", value: qaCount, tone: "cyan" },
    { label: "Market Gaps", value: competitorGaps + gaps, tone: "violet" },
  ];

  const actions = [
    {
      title: "Question Console",
      body: "Pressure-test the grounded agent against real support questions.",
      button: "Open Chat",
      onClick: onOpenChat,
    },
    {
      title: "Knowledge Lab",
      body: "Inspect sources, gaps, contradictions, and synthesized instructions.",
      button: "Review KB",
      onClick: onOpenKb,
    },
    {
      title: "Voice Launchpad",
      body: "Run a phone-style simulation or prepare the agent for deployment.",
      button: "Deploy",
      onClick: onOpenDeploy,
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] min-h-[650px] font-sans">
      <div className="absolute inset-0 mission-grid opacity-70 pointer-events-none"></div>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00E5CC] to-transparent opacity-50"></div>

      <div className="relative z-10 p-6 md:p-8 flex flex-col gap-8">
        <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch">
          <div className="flex flex-col justify-between gap-8 min-h-[360px]">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC] animate-statusPulse"></span>
                <span className="text-[10px] font-mono font-semibold tracking-[0.22em] uppercase text-[#00E5CC]">
                  Agent Mission Control
                </span>
              </div>

              <h1 className="font-display font-bold text-[34px] md:text-[52px] leading-[1.03] tracking-tight text-[#F0EDE8] max-w-[760px]">
                Your site has become an operational support system.
              </h1>

              <p className="mt-5 max-w-[640px] text-[14px] leading-[1.8] text-[rgba(255,255,255,0.46)]">
                Crawl intelligence, local knowledge, audit signals, and deployment tools are now connected in one live workspace.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {lanes.map((lane, idx) => (
                <div
                  key={lane.label}
                  className="mission-tile rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] p-4 overflow-hidden"
                  style={{ animationDelay: `${idx * 90}ms` }}
                >
                  <span className="block text-[9px] font-mono uppercase tracking-[0.16em] text-[rgba(255,255,255,0.35)]">
                    {lane.label}
                  </span>
                  <span className={`mt-2 block font-mono text-[26px] font-bold ${lane.tone === "cyan" ? "text-[#00E5CC]" : "text-[#7B5EA7]"}`}>
                    {lane.value}
                  </span>
                  <span className="mt-3 block h-1 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
                    <span
                      className={`block h-full rounded-full ${lane.tone === "cyan" ? "bg-[#00E5CC]" : "bg-[#7B5EA7]"} mission-bar`}
                      style={{ animationDelay: `${idx * 120 + 180}ms` }}
                    ></span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[rgba(6,6,8,0.58)] p-5 min-h-[360px] overflow-hidden">
            <div className="absolute inset-0 mission-scan pointer-events-none"></div>
            <div className="relative z-10 flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[rgba(255,255,255,0.35)]">
                  Readiness Matrix
                </span>
                <h2 className="mt-1 font-display font-bold text-[20px] text-[#F0EDE8]">
                  Agent health
                </h2>
              </div>
              <span className="rounded-full border border-[rgba(0,229,204,0.25)] bg-[rgba(0,229,204,0.08)] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-[#00E5CC]">
                Ready
              </span>
            </div>

            <div className="relative z-10 grid grid-cols-3 gap-3">
              {rings.map((ring, idx) => {
                const bg = `conic-gradient(${ring.color} ${ring.value * 3.6}deg, rgba(255,255,255,0.07) 0deg)`;
                return (
                  <div key={ring.label} className="flex flex-col items-center gap-3">
                    <div className="mission-ring rounded-full p-[1px]" style={{ background: bg, animationDelay: `${idx * 120}ms` }}>
                      <div className="w-[86px] h-[86px] md:w-[112px] md:h-[112px] rounded-full bg-[#060608] flex flex-col items-center justify-center border border-[rgba(255,255,255,0.05)]">
                        <span className="font-mono text-[24px] md:text-[30px] font-bold text-[#F0EDE8]">
                          {ring.value}
                        </span>
                        <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[rgba(255,255,255,0.34)]">
                          score
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[rgba(255,255,255,0.45)]">
                      {ring.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="relative z-10 mt-7 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] p-4">
                <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-[rgba(255,255,255,0.35)]">Audit Load</span>
                <p className="mt-2 text-[13px] leading-[1.6] text-[rgba(255,255,255,0.55)]">
                  {inconsistencies + staleFlags === 0
                    ? "No contradictions or stale content are currently flagged."
                    : `${inconsistencies + staleFlags} items need review before a high-confidence launch.`}
                </p>
              </div>
              <div className="rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] p-4">
                <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-[rgba(255,255,255,0.35)]">Business Type</span>
                <p className="mt-2 text-[13px] leading-[1.6] text-[rgba(255,255,255,0.55)]">
                  {(kb?.business_type || "website").replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {actions.map((action, idx) => (
            <button
              key={action.title}
              onClick={action.onClick}
              className="group text-left rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] p-5 min-h-[170px] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(0,229,204,0.25)] hover:bg-[rgba(255,255,255,0.04)] cursor-pointer mission-action"
              style={{ animationDelay: `${idx * 110}ms` }}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-display text-[17px] font-bold text-[#F0EDE8]">{action.title}</span>
                <span className="w-8 h-8 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] flex items-center justify-center text-[#00E5CC] transition-transform duration-300 group-hover:translate-x-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <p className="mt-4 text-[13px] leading-[1.7] text-[rgba(255,255,255,0.45)]">{action.body}</p>
              <span className="mt-6 inline-flex text-[10px] font-mono uppercase tracking-[0.16em] text-[#7B5EA7]">
                {action.button}
              </span>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
};
