"use client";

// 멀티터치 이메일 시퀀스 — plan_email_sequence 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 대상 callout + 메일별 섹션(Day · 프레임워크 · 목표 ·
// 제목 · 본문 개요 · CTA · 카덴스 경고). 발송 없음, 계획만 표시.
import type { EmailSequencePlan, EmailSequenceStep } from "@/lib/types";

const MONO = "font-[family-name:var(--ide-mono,var(--font-geist-mono))]";

const TYPE_LABEL: Record<EmailSequencePlan["type"], string> = {
  cold: "콜드 아웃바운드",
  nurture: "옵트인 너처",
};

const FRAMEWORK_LABEL: Record<EmailSequenceStep["framework"], string> = {
  AIDA: "AIDA",
  PAS: "PAS",
  BAB: "BAB",
  PPPP: "PPPP",
};

export function EmailSequence({ sequence }: { sequence: EmailSequencePlan }) {
  const steps = sequence.steps ?? [];

  return (
    <div className="ide-doc-in">
      {/* 문서 헤더 + 타입/기간 메타 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-list-ordered" aria-hidden />
        <span className="ide-doc-head-title">이메일 시퀀스</span>
        <span className="ide-doc-head-meta">
          {TYPE_LABEL[sequence.type]} · 총 {sequence.totalDays}일
        </span>
      </div>

      {/* 대상 callout */}
      {sequence.audience && (
        <div className="ide-doc-callout flex gap-2">
          <i className="codicon codicon-organization shrink-0" aria-hidden style={{ marginTop: 2 }} />
          <span>
            <span className={`${MONO} mr-2 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-3)]`}>
              대상
            </span>
            {sequence.audience}
          </span>
        </div>
      )}

      {/* 메일 타임라인 — dayOffset 오름차순, 각 단계를 섹션으로 */}
      {steps.length === 0 ? (
        <div className="ide-doc-section ide-doc-callout">
          아직 설계된 시퀀스 단계가 없습니다.
        </div>
      ) : (
        steps.map((step, i) => (
          <section key={`${step.dayOffset}-${i}`} className="ide-doc-section">
            <div className="ide-doc-section-head">
              <i className="codicon codicon-watch" aria-hidden />
              <span className="normal-case tracking-normal text-[var(--text-1)]">
                DAY <span className="num">{step.dayOffset}</span>
              </span>
              <span className="ide-doc-section-meta flex items-center gap-1.5">
                <span className="ide-doc-pill ide-doc-pill--accent">
                  {FRAMEWORK_LABEL[step.framework]}
                </span>
                <span className="num">{step.wordCount}단어</span>
              </span>
            </div>

            {/* 제목 */}
            <h3 className="text-[14px] font-semibold leading-snug text-[var(--text-1)]">
              {step.subject}
            </h3>
            {/* 목표 + 본문 개요 */}
            <p className="mt-1 text-[12px] font-medium text-[var(--text-2)]">
              {step.objective}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">
              {step.bodyOutline}
            </p>

            {/* CTA + 카덴스 경고 */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="ide-doc-pill">
                <i className="codicon codicon-link" aria-hidden />
                CTA · {step.cta}
              </span>
              {step.cadenceWarning && (
                <span className="ide-doc-pill ide-doc-pill--warn">
                  <i className="codicon codicon-warning" aria-hidden />
                  {step.cadenceWarning}
                </span>
              )}
            </div>
          </section>
        ))
      )}

      {/* 정직성 라벨 */}
      {sequence.note && (
        <p className="ide-doc-section mt-3 flex items-center gap-1.5 text-[11px] font-medium leading-relaxed text-[var(--warn)]">
          <i className="codicon codicon-info" aria-hidden style={{ fontSize: 13 }} />
          {sequence.note}
        </p>
      )}
    </div>
  );
}
