"use client";

// 카피 자체 점검 — critique_copy 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 통과 점수 도넛 + 한 줄 평결 callout + 위반 목록(심각도 callout).
// 모든 점수/위반은 도구가 결정론 룰셋으로 계산한 값을 그대로 표시(인용).
import type { CopyCritiqueReport, CopyIssue } from "@/lib/types";

const MONO = "font-[family-name:var(--ide-mono,var(--font-geist-mono))]";

const TARGET_LABEL: Record<CopyCritiqueReport["target"], string> = {
  newsletter: "뉴스레터",
  cold_email: "콜드메일",
  instagram: "인스타그램 캡션",
};

const SEVERITY_STYLE: Record<
  CopyIssue["severity"],
  { label: string; pill: string; callout: string; icon: string }
> = {
  critical: {
    label: "심각",
    pill: "ide-doc-pill--danger",
    callout: "ide-doc-callout--danger",
    icon: "error",
  },
  warning: {
    label: "주의",
    pill: "ide-doc-pill--warn",
    callout: "ide-doc-callout--warn",
    icon: "warning",
  },
  info: {
    label: "참고",
    pill: "",
    callout: "",
    icon: "info",
  },
};

// 통과 점수 색 — 딥그린(80+)/오커(50+)/브릭. SVG stroke 는 var() 미지원이라
// .ide-doc 다크 토큰을 리터럴 미러링(ok #4ec9b0 · warn #cca700 · danger #f14c4c).
// 흰 standalone 에선 트랙이 약간 진하게 보이지만 점수/색은 동일 의미를 유지.
function scoreColor(score: number): string {
  return score >= 80 ? "#4ec9b0" : score >= 50 ? "#cca700" : "#f14c4c";
}
const DONUT_TRACK = "rgba(255,255,255,0.10)";

function PassDonut({ score }: { score: number }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const clamped = Math.min(100, Math.max(0, score));
  const color = scoreColor(clamped);
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" stroke={DONUT_TRACK} strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * C} ${C}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-[20px] font-bold leading-none" style={{ color }}>
          {clamped}
        </span>
        <span className={`${MONO} mt-0.5 text-[8px] tracking-[0.1em] text-[var(--text-3)]`}>
          PASS
        </span>
      </div>
    </div>
  );
}

export function CopyCritique({ report }: { report: CopyCritiqueReport }) {
  const issues = report.issues ?? [];
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="ide-doc-in">
      {/* 문서 헤더 + 점검 대상 메타 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-checklist" aria-hidden />
        <span className="ide-doc-head-title">카피 점검</span>
        <span className="ide-doc-head-meta">대상 · {TARGET_LABEL[report.target]}</span>
      </div>

      {/* 요약 — 도넛 게이지 + 한 줄 평결 + 위반 카운트 pill */}
      <div className="ide-doc-callout flex items-center gap-4">
        <PassDonut score={report.passScore} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-relaxed text-[var(--text-1)]">
            {report.summary}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="ide-doc-pill ide-doc-pill--danger">
              심각 <span className="num">{criticalCount}</span>
            </span>
            <span className="ide-doc-pill ide-doc-pill--warn">
              주의 <span className="num">{warningCount}</span>
            </span>
            <span className="ide-doc-pill">
              전체 <span className="num">{issues.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 위반 목록 — severity 우선순위 정렬 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-list-flat" aria-hidden />
          점검 항목
          <span className="ide-doc-section-meta">심각도순 · {issues.length}건</span>
        </div>
        {issues.length === 0 ? (
          <div className="ide-doc-callout ide-doc-callout--ok flex items-center gap-2.5">
            <i className="codicon codicon-pass-filled text-[var(--ok)]" aria-hidden style={{ fontSize: 18 }} />
            <p className="text-[13px] font-semibold text-[var(--ok)]">
              모든 룰셋 점검을 통과했습니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {issues.map((issue, i) => {
              const s = SEVERITY_STYLE[issue.severity];
              return (
                <div key={`${issue.rule}-${i}`} className={`ide-doc-callout ${s.callout}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`ide-doc-pill ${s.pill}`}>
                      <i className={`codicon codicon-${s.icon}`} aria-hidden />
                      {s.label}
                    </span>
                    <span className="text-[13px] font-semibold text-[var(--text-1)]">
                      {issue.rule}
                    </span>
                  </div>
                  {/* 근거 — 감지된 문구/패턴 (모노 인셋) */}
                  {issue.evidence && (
                    <p className={`${MONO} mt-2 rounded bg-[var(--bg-inset)] px-3 py-2 text-[12px] leading-relaxed text-[var(--text-2)]`}>
                      {issue.evidence}
                    </p>
                  )}
                  {/* 수정 제안 */}
                  {issue.suggestion && (
                    <p className="mt-2 flex gap-2 text-[13px] leading-relaxed text-[var(--text-2)]">
                      <span className="shrink-0 font-semibold text-[var(--accent-bright)]">
                        제안
                      </span>
                      <span>{issue.suggestion}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 정직성 라벨 */}
      {report.note && (
        <p className="ide-doc-section mt-3 flex items-center gap-1.5 text-[11px] font-medium leading-relaxed text-[var(--warn)]">
          <i className="codicon codicon-info" aria-hidden style={{ fontSize: 13 }} />
          {report.note}
        </p>
      )}
    </div>
  );
}
