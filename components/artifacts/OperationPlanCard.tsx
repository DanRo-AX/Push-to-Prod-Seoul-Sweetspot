"use client";

// 운영안 카드 — 현장 운영의 인력·동선·안전·일정(+운영시간/목표/비상대응).
// VS Code 문서 idiom(.ide-doc-*) + 토큰 기반(라이트/다크 무관).
import type { OperationPlan } from "@/lib/types";

export function OperationPlanCard({ plan }: { plan: OperationPlan }) {
  const totalStaff = plan.staffing.reduce((s, r) => s + (Number(r.count) || 0), 0);
  return (
    <div className="ide-doc-in">
      <div className="ide-doc-head">
        <i className="codicon codicon-organization" aria-hidden />
        <span className="ide-doc-head-title">운영안 · {plan.title}</span>
        <span className="ide-doc-head-meta" style={{ fontFamily: "inherit" }}>
          {plan.client}
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-[var(--text-2)]">{plan.summary}</p>

      <div className="mt-3">
        <div className="ide-doc-kv">
          <span className="ide-doc-kv-key">운영 시간</span>
          <span className="ide-doc-kv-val ide-doc-kv-val--text">{plan.hours}</span>
        </div>
        <div className="ide-doc-kv">
          <span className="ide-doc-kv-key">일 운영 목표</span>
          <span className="ide-doc-kv-val ide-doc-kv-val--text">{plan.dailyTarget}</span>
        </div>
      </div>

      {/* 인력 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-person" aria-hidden />
          <span className="normal-case tracking-normal">인력</span>
          <span className="ide-doc-section-meta">총 {totalStaff}명</span>
        </div>
        {plan.staffing.map((r, i) => (
          <div className="ide-doc-row" key={i} style={{ alignItems: "flex-start" }}>
            <span className="shrink-0 font-semibold text-[var(--text-1)]">
              {r.role}
              <span className="ml-1 text-[var(--accent)]">×{r.count}</span>
            </span>
            <span className="min-w-0 text-[var(--text-2)]">
              <span className="text-[var(--text-3)]">{r.shift}</span> — {r.duty}
            </span>
          </div>
        ))}
      </section>

      {/* 동선·혼잡 관리 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-git-merge" aria-hidden />
          <span className="normal-case tracking-normal">동선 · 혼잡 관리</span>
        </div>
        {plan.flow.map((f, i) => (
          <div className="ide-doc-row" key={i} style={{ alignItems: "flex-start" }}>
            <span className="shrink-0 font-semibold text-[var(--accent)]">{f.zone}</span>
            <span className="min-w-0 text-[var(--text-2)]">
              <span className="text-[var(--text-1)]">{f.action}</span>
              {f.capacity ? <span className="text-[var(--text-3)]"> · {f.capacity}</span> : null}
            </span>
          </div>
        ))}
      </section>

      {/* 안전 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-shield" aria-hidden />
          <span className="normal-case tracking-normal">안전</span>
        </div>
        {plan.safety.map((s, i) => (
          <div className="ide-doc-callout ide-doc-callout--warn mt-1.5" key={i}>
            <span className="font-semibold text-[var(--warn)]">{s.hazard}</span>
            <span className="text-[var(--text-1)]"> → {s.control}</span>
            {s.owner ? (
              <span className="ml-1 text-[var(--text-3)]">({s.owner})</span>
            ) : null}
          </div>
        ))}
      </section>

      {/* 일정 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-calendar" aria-hidden />
          <span className="normal-case tracking-normal">일정</span>
        </div>
        {plan.schedule.map((s, i) => (
          <div className="ide-doc-row" key={i} style={{ alignItems: "flex-start" }}>
            <span className="shrink-0 font-semibold text-[var(--text-1)]">{s.phase}</span>
            <span className="min-w-0 text-[var(--text-2)]">
              <span className="text-[var(--text-3)]">{s.period}</span> — {s.detail}
            </span>
          </div>
        ))}
      </section>

      {/* 비상 대응 */}
      {plan.contingencies.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-warning" aria-hidden />
            <span className="normal-case tracking-normal">비상 · 우천 · 혼잡 대응</span>
          </div>
          <ul className="ml-4 list-disc text-[12.5px] leading-relaxed text-[var(--text-1)]">
            {plan.contingencies.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
