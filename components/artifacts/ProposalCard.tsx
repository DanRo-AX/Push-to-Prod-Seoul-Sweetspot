"use client";

// 제안서 카드 — 컨셉/타깃/공간(존)/동선/일정/KPI/예산 개요/차별점.
// VS Code 문서 idiom + 토큰 기반(라이트/다크 무관).
import type { Proposal } from "@/lib/types";

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  return (
    <div className="ide-doc-in">
      <div className="ide-doc-head">
        <i className="codicon codicon-rocket" aria-hidden />
        <span className="ide-doc-head-title">제안서 · {proposal.title}</span>
        <span className="ide-doc-head-meta" style={{ fontFamily: "inherit" }}>
          {proposal.client}
        </span>
      </div>

      {/* 컨셉 */}
      <div className="ide-doc-callout">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--accent)]">
          컨셉
        </div>
        <p className="text-[14px] font-medium leading-relaxed text-[var(--text-1)]">{proposal.concept}</p>
      </div>

      {/* 타깃 세그먼트 */}
      {proposal.targetSegments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {proposal.targetSegments.map((s, i) => (
            <span
              key={i}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* 공간 구성(존) */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-layout" aria-hidden />
          <span className="normal-case tracking-normal">공간 구성</span>
          <span className="ide-doc-section-meta">{proposal.zones.length} 존</span>
        </div>
        {proposal.zones.map((z, i) => (
          <div className="ide-doc-row" key={i} style={{ alignItems: "flex-start" }}>
            <span className="shrink-0 font-semibold text-[var(--accent)]">{z.name}</span>
            <span className="min-w-0 text-[var(--text-2)]">
              <span className="text-[var(--text-1)]">{z.purpose}</span> — {z.experience}
            </span>
          </div>
        ))}
      </section>

      {/* 방문 동선 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-git-merge" aria-hidden />
          <span className="normal-case tracking-normal">방문 동선</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[var(--text-1)]">
          {proposal.journey.map((step, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className="rounded px-2 py-0.5"
                style={{ background: "var(--bg-2)" }}
              >
                {step}
              </span>
              {i < proposal.journey.length - 1 && (
                <i className="codicon codicon-arrow-right text-[var(--text-3)]" aria-hidden />
              )}
            </span>
          ))}
        </div>
      </section>

      {/* 일정 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-calendar" aria-hidden />
          <span className="normal-case tracking-normal">일정</span>
        </div>
        {proposal.schedule.map((s, i) => (
          <div className="ide-doc-kv" key={i}>
            <span className="ide-doc-kv-key">{s.phase}</span>
            <span className="ide-doc-kv-val ide-doc-kv-val--text">{s.period}</span>
          </div>
        ))}
      </section>

      {/* 목표 KPI */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-target" aria-hidden />
          <span className="normal-case tracking-normal">목표 KPI</span>
        </div>
        {proposal.kpis.map((k, i) => (
          <div className="ide-doc-kv" key={i}>
            <span className="ide-doc-kv-key">{k.label}</span>
            <span className="ide-doc-kv-val">{k.target}</span>
          </div>
        ))}
      </section>

      {/* 예산 개요 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-credit-card" aria-hidden />
          <span className="normal-case tracking-normal">예산 개요</span>
        </div>
        {proposal.budgetOutline.map((b, i) => (
          <div className="ide-doc-kv" key={i}>
            <span className="ide-doc-kv-key">{b.item}</span>
            <span className="ide-doc-kv-val">{b.amount}</span>
          </div>
        ))}
      </section>

      {/* 차별점 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-flame" aria-hidden />
          <span className="normal-case tracking-normal">차별점</span>
        </div>
        <ul className="ml-4 list-disc text-[13px] leading-relaxed text-[var(--text-1)]">
          {proposal.winThemes.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
