"use client";

// RFP 분석 카드 — 들어온 제안요청서를 요건/평가배점/적합도/리스크/수주전략으로 구조화.
// VS Code 문서 idiom(.ide-doc-*) + 토큰 기반이라 라이트/다크 어느 스코프에서도 안 깨진다.
import type { RfpAnalysis } from "@/lib/types";

const PRIORITY_LABEL: Record<RfpRequirementPriority, string> = {
  must: "필수",
  should: "권장",
  nice: "가점",
};
type RfpRequirementPriority = "must" | "should" | "nice";
const PRIORITY_TONE: Record<RfpRequirementPriority, string> = {
  must: "var(--danger)",
  should: "var(--accent)",
  nice: "var(--text-3)",
};

export function RfpAnalysisCard({ analysis }: { analysis: RfpAnalysis }) {
  const fit = Math.max(0, Math.min(100, Math.round(analysis.fitScore)));
  return (
    <div className="ide-doc-in">
      <div className="ide-doc-head">
        <i className="codicon codicon-search" aria-hidden />
        <span className="ide-doc-head-title">RFP 분석 · {analysis.title}</span>
        <span className="ide-doc-head-meta" style={{ fontFamily: "inherit" }}>
          {analysis.client}
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-[var(--text-2)]">{analysis.summary}</p>

      {/* 개요 키-값 */}
      <div className="mt-3">
        <div className="ide-doc-kv">
          <span className="ide-doc-kv-key">운영 기간</span>
          <span className="ide-doc-kv-val ide-doc-kv-val--text">{analysis.period}</span>
        </div>
        <div className="ide-doc-kv">
          <span className="ide-doc-kv-key">장소·규모</span>
          <span className="ide-doc-kv-val ide-doc-kv-val--text">{analysis.venue}</span>
        </div>
        <div className="ide-doc-kv">
          <span className="ide-doc-kv-key">예산</span>
          <span className="ide-doc-kv-val">{analysis.budget}</span>
        </div>
      </div>

      {/* 적합도 게이지 */}
      <div className="ide-doc-callout mt-3" style={{ borderColor: "var(--line-1)" }}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--text-2)]">
            자사 적합도
          </span>
          <span className="text-[15px] font-bold text-[var(--accent)]">{fit}</span>
        </div>
        <div
          aria-hidden
          style={{ height: 6, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden" }}
        >
          <span style={{ display: "block", height: "100%", width: `${fit}%`, background: "var(--accent)" }} />
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-2)]">{analysis.fitRationale}</p>
      </div>

      {/* 핵심 요건 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-checklist" aria-hidden />
          <span className="normal-case tracking-normal">핵심 요건</span>
          <span className="ide-doc-section-meta">{analysis.requirements.length}건</span>
        </div>
        <div className="ide-doc-list">
          {analysis.requirements.map((r, i) => (
            <div className="ide-doc-row" key={i} style={{ alignItems: "flex-start" }}>
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                style={{ color: PRIORITY_TONE[r.priority], border: `1px solid ${PRIORITY_TONE[r.priority]}` }}
              >
                {PRIORITY_LABEL[r.priority]}
              </span>
              <span className="min-w-0">
                <span className="font-semibold text-[var(--text-1)]">{r.label}</span>
                <span className="text-[var(--text-2)]"> — {r.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 평가 기준 + 배점 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-graph" aria-hidden />
          <span className="normal-case tracking-normal">평가 기준 · 배점</span>
        </div>
        {analysis.evalCriteria.map((c, i) => (
          <div className="ide-doc-kv" key={i}>
            <span className="ide-doc-kv-key">{c.label}</span>
            <span className="ide-doc-kv-val">{c.weight}%</span>
          </div>
        ))}
      </section>

      {/* 리스크 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-warning" aria-hidden />
          <span className="normal-case tracking-normal">리스크 · 대응</span>
        </div>
        {analysis.risks.map((r, i) => (
          <div className="ide-doc-callout ide-doc-callout--warn mt-1.5" key={i}>
            <span className="font-semibold text-[var(--warn)]">{r.label}</span>
            <span className="text-[var(--text-1)]"> → {r.mitigation}</span>
          </div>
        ))}
      </section>

      {/* 수주 전략 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-flame" aria-hidden />
          <span className="normal-case tracking-normal">수주 전략</span>
        </div>
        <ul className="ml-4 list-disc text-[13px] leading-relaxed text-[var(--text-1)]">
          {analysis.winThemes.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
