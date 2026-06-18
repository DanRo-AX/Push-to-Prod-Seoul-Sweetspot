"use client";

// 추적 설정 감사 — audit_tracking_setup 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 제목 행 + 커버리지 도넛 게이지(토큰 stroke) +
// 기존 신호 칩 + 미추적 갭 리스트(우선순위 .ide-doc-pill, GTM JSON <details>).
// 색은 토큰 기반 — 도넛 stroke 도 inline style 의 var() 로 다크/흰 컨텍스트 공통.
import type { TrackingAuditReport, TrackingGap } from "@/lib/types";

const MONO = "font-[family-name:var(--font-geist-mono)]";

// 점수 → 상태 토큰. 인라인 style 의 var() 로 해석되어 스코프(다크/흰)에 맞게 색이 잡힌다.
function scoreColorVar(score: number): string {
  return score >= 80
    ? "var(--ok)"
    : score >= 50
      ? "var(--warn)"
      : "var(--danger)";
}

const PRIORITY: Record<TrackingGap["priority"], { label: string; pill: string }> = {
  critical: { label: "심각", pill: "ide-doc-pill--danger" },
  high: { label: "높음", pill: "ide-doc-pill--warn" },
  low: { label: "낮음", pill: "" },
};

// 커버리지 도넛 게이지 — 인라인 SVG. stroke 는 inline style 의 var() 토큰.
function ScoreDonut({ score }: { score: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const clamped = Math.min(100, Math.max(0, score));
  const color = scoreColorVar(clamped);
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        {/* 트랙 = 가라앉은 표면 토큰 */}
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          style={{ stroke: "var(--bg-2)" }}
          strokeWidth="8"
        />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          style={{ stroke: color }}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * C} ${C}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="num text-[22px] font-bold leading-none"
          style={{ color }}
        >
          {clamped}
        </span>
        <span
          className={`${MONO} mt-1 text-[9px] uppercase tracking-[0.14em] text-[var(--text-3)]`}
        >
          COVERAGE
        </span>
      </div>
    </div>
  );
}

// details 펼침 셰브론 — 인라인 SVG (이모지 금지)
function Chevron() {
  return (
    <svg
      viewBox="0 0 10 6"
      className="h-[7px] w-2.5 shrink-0 transition-transform duration-200 group-open:rotate-180"
      aria-hidden="true"
    >
      <path
        d="M1 1 L5 5 L9 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrackingAuditCard({ report }: { report: TrackingAuditReport }) {
  return (
    <div>
      {/* 문서 제목 행 + 렌더 경로 메타 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-shield" aria-hidden />
        <span className="ide-doc-head-title">추적 설정 감사</span>
        <span className="ide-doc-head-meta">
          {report.fetchedVia === "chrome"
            ? "Chrome 헤드리스 렌더"
            : "HTML fetch 폴백"}
        </span>
      </div>

      {/* 요약 — 도넛 게이지 + URL + 기존 추적 신호 칩 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-pie-chart" aria-hidden />
          커버리지 요약
        </div>
        <div className="flex items-center gap-5 rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-4 py-4">
          <ScoreDonut score={report.coverageScore} />
          <div className="min-w-0 flex-1">
            <p className={`${MONO} truncate text-[12px] text-[var(--text-2)]`}>
              {report.url}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--text-1)]">
              추적 커버리지 <span className="num">{report.coverageScore}</span>점 ·
              미추적 이벤트 <span className="num">{report.gaps.length}</span>건
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {report.existingSignals.length === 0 ? (
                <span className="text-[12px] text-[var(--text-3)]">
                  감지된 추적 스크립트 없음
                </span>
              ) : (
                report.existingSignals.map((s) => (
                  <span
                    key={s}
                    className="ide-doc-pill ide-doc-pill--ok"
                  >
                    {s}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 미추적 이벤트 갭 목록 — 우선순위 색 + GTM 태그 JSON 접기/펼치기 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-warning" aria-hidden />
          미추적 이벤트 — 우선순위순
          <span className="ide-doc-section-meta">{report.gaps.length}건</span>
        </div>
        {report.gaps.length === 0 ? (
          <p className="rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-4 py-8 text-center text-[13px] text-[var(--text-3)]">
            발견된 추적 갭이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {report.gaps.map((gap, i) => {
              const p = PRIORITY[gap.priority];
              return (
                <div
                  key={`${gap.recommendedEvent}-${i}`}
                  className="rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`ide-doc-pill ${p.pill}`}>{p.label}</span>
                    <span className="min-w-0 text-[13px] font-semibold text-[var(--text-1)]">
                      {gap.element}
                    </span>
                    <span
                      className={`${MONO} ml-auto rounded-[4px] bg-[var(--accent-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-bright)]`}
                    >
                      {gap.recommendedEvent}
                    </span>
                  </div>

                  {/* 권장 이벤트 파라미터 — 셀렉터/값은 모노 */}
                  {Object.keys(gap.parameters).length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {Object.entries(gap.parameters).map(([k, v]) => (
                        <span
                          key={k}
                          className={`${MONO} rounded-[4px] bg-[var(--bg-2)] px-2 py-1 text-[11px] text-[var(--text-3)]`}
                        >
                          {k}=<span className="text-[var(--text-1)]">{v}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* GTM 태그 설정 JSON — 접기/펼치기 */}
                  <details className="group mt-3">
                    <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-[12px] font-semibold text-[var(--text-3)] transition-colors hover:text-[var(--text-1)] [&::-webkit-details-marker]:hidden">
                      <Chevron />
                      GTM 태그 설정 JSON
                    </summary>
                    <pre
                      className={`${MONO} mt-2 overflow-x-auto rounded-[4px] bg-[var(--bg-2)] p-3 text-[11px] leading-relaxed text-[var(--text-2)]`}
                    >
                      {JSON.stringify(gap.gtmTagConfig, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 풋노트 — 분석 전용 안내 */}
      <p
        className={`${MONO} mt-3.5 text-[11px] font-medium leading-relaxed text-[var(--text-3)]`}
      >
        분석 전용 — 대상 사이트에 어떤 변경도 가하지 않습니다.
      </p>
    </div>
  );
}
