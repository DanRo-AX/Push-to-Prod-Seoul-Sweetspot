"use client";

// 전환 퍼널 리포트 — analyze_funnel 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 제목 행 + 단계 리스트(폭 비율 막대 + 전환율 라벨).
// 병목 구간은 warn 톤으로 강조. 색은 토큰 기반 — 다크/흰 컨텍스트 공통.
import type { FunnelChartProps } from "@/lib/types";

// 단계 사이 하향 화살표 — 인라인 SVG (이모지 금지)
function DownArrow() {
  return (
    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 shrink-0" aria-hidden="true">
      <path d="M5 9 L1 3 H9 Z" fill="currentColor" />
    </svg>
  );
}

export function FunnelChart({ report }: FunnelChartProps) {
  const stages = report.stages;
  if (stages.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-3)]">
        아직 집계된 퍼널 데이터가 없습니다.
      </div>
    );
  }

  const maxCount = Math.max(...stages.map((s) => s.count));

  return (
    <div>
      {/* 문서 제목 행 + period/source 메타 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-filter" aria-hidden />
        <span className="ide-doc-head-title">{report.brandName} 전환 퍼널</span>
        <span className="ide-doc-head-meta">
          {report.period} · {report.source}
        </span>
      </div>

      {/* 단계 리스트 — 병목 단계는 warn 톤 + 칩 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-list-ordered" aria-hidden />
          단계별 전환
          <span className="ide-doc-section-meta">{stages.length}단계</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {stages.map((s, i) => {
            const isBottleneck = s.stage === report.bottleneckStage;
            return (
              <div key={s.stage}>
                {/* 직전 단계 대비 전환율 라벨 */}
                {s.conversionFromPrev !== null && (
                  <div
                    className={`mb-1.5 flex items-center gap-1.5 pl-3.5 text-[11px] font-semibold ${
                      isBottleneck
                        ? "text-[var(--warn)]"
                        : "text-[var(--text-3)]"
                    }`}
                  >
                    <DownArrow />
                    <span className="num">전환 {s.conversionFromPrev}%</span>
                  </div>
                )}
                <div
                  className="rounded-[4px] border bg-[var(--bg-1)] px-3.5 py-3"
                  style={{
                    borderColor: isBottleneck
                      ? "var(--warn)"
                      : "var(--line-1)",
                  }}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="num shrink-0 text-[12px] text-[var(--text-3)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[13px] font-semibold text-[var(--text-1)]">
                        {s.stage}
                      </span>
                      {isBottleneck && (
                        <span className="ide-doc-pill ide-doc-pill--warn">
                          병목
                        </span>
                      )}
                    </div>
                    <span className="num shrink-0 text-[17px] font-bold text-[var(--text-1)]">
                      {s.count.toLocaleString()}
                    </span>
                  </div>
                  {/* 카운트 폭 비율 막대 */}
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-2)]">
                    <div
                      className={`h-full rounded-full ${
                        isBottleneck
                          ? "bg-[var(--warn)]"
                          : "bg-[var(--accent)]"
                      }`}
                      style={{
                        width: `${Math.max(2, (s.count / maxCount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 정직성 라벨 — 조용한 풋노트 */}
      <p className="mt-3.5 font-[family-name:var(--font-geist-mono)] text-[11px] font-medium leading-relaxed text-[var(--warn)]">
        ⓘ 데이터 기준: {report.note}
      </p>
    </div>
  );
}
