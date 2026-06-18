"use client";

// 전환 퍼널 카드 — components/artifacts/FunnelChart.tsx 의 대시보드 그리드 변형.
// (원본은 자체 h2 헤더·note 박스를 포함해 카드 셸과 중복 — 여기서는 DashCard 가 담당)
// 단계 막대(폭 비율) + 단계 간 전환율 + 병목 구간 warn 강조 + 하단 병목 요약.

import { useEffect, useRef, useState } from "react";
import type { FunnelReport } from "@/lib/types";
import { DashCard } from "@/components/dashboard/DashCard";

// IO 1회 발화 필인 — 첫 가시화 시점에 막대를 scaleX(0)→1 로 채운다.
// reduced-motion 은 막대의 motion-reduce: 클래스가 CSS 레벨에서 즉시 완성 폭을 보장.
// rebindKey: DashCard 가 liveVersion 으로 key 리마운트되면 관찰 대상이 교체되므로 재관찰.
function useFillOnVisible<T extends HTMLElement>(rebindKey = 0) {
  const ref = useRef<T | null>(null);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (filled) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setFilled(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setFilled(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filled, rebindKey]);
  return { ref, filled };
}

// 막대 필인 공통 클래스 — origin-left scaleX 트랜지션 (이징은 리포 표준 cubic-bezier 통일)
const FILL_BAR =
  "h-full origin-left rounded-full transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:scale-x-100";

// 단계 사이 하향 화살표 — 인라인 SVG (이모지 금지)
function DownArrow() {
  return (
    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 shrink-0" aria-hidden="true">
      <path d="M5 9 L1 3 H9 Z" fill="currentColor" />
    </svg>
  );
}

export interface FunnelCardProps {
  report: FunnelReport;
  liveVersion?: number;
  className?: string;
}

export function FunnelCard({
  report,
  liveVersion = 0,
  className,
}: FunnelCardProps) {
  const stages = report.stages;
  const maxCount = stages.length > 0 ? Math.max(...stages.map((s) => s.count)) : 1;
  const { ref: fillRef, filled } = useFillOnVisible<HTMLDivElement>(liveVersion);

  return (
    <DashCard
      eyebrow="FUNNEL"
      title="전환 퍼널"
      meta={report.period}
      liveVersion={liveVersion}
      note={report.note}
      className={className}
    >
      {stages.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-3)]">
          아직 집계된 퍼널 데이터가 없습니다.
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div ref={fillRef} className="flex flex-col gap-1">
            {stages.map((s, i) => {
              const isBottleneck = s.stage === report.bottleneckStage;
              return (
                <div key={s.stage}>
                  {/* 직전 단계 대비 전환율 */}
                  {s.conversionFromPrev !== null && (
                    <div
                      className={`my-1 flex items-center gap-1.5 pl-3 text-[11px] font-semibold ${
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
                    className={`rounded-xl border bg-[var(--bg-2)] px-3.5 py-2.5 transition-colors ${
                      isBottleneck
                        ? "border-[var(--warn)]/60"
                        : "border-[var(--line-1)] hover:border-[var(--line-2)]"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="num shrink-0 text-[12px] text-[var(--text-3)]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate text-[14px] font-semibold text-[var(--text-1)]">
                          {s.stage}
                        </span>
                        {isBottleneck && (
                          <span className="shrink-0 rounded-[4px] bg-[var(--warn-dim)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--warn)]">
                            병목
                          </span>
                        )}
                      </div>
                      <span className="num shrink-0 text-[17px] font-bold text-[var(--text-1)]">
                        {s.count.toLocaleString()}
                      </span>
                    </div>
                    {/* 카운트 폭 비율 막대 — IO 발화 시 scaleX(0)→1 필인 (단계별 60ms 스태거) */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-3)]">
                      <div
                        className={`${FILL_BAR} ${
                          filled ? "scale-x-100" : "scale-x-0"
                        } ${
                          isBottleneck ? "bg-[var(--warn)]" : "bg-[var(--accent)]"
                        }`}
                        style={{
                          width: `${Math.max(2, (s.count / maxCount) * 100)}%`,
                          transitionDelay: `${i * 60}ms`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 병목 요약 — 카드 하단 고정 */}
          <div className="mt-auto pt-3">
            <div className="rounded-xl border border-[var(--warn)]/30 bg-[var(--warn-dim)] px-3.5 py-2 text-[12px] font-semibold text-[var(--warn)]">
              최대 이탈 구간 — {report.bottleneckStage}
            </div>
          </div>
        </div>
      )}
    </DashCard>
  );
}
