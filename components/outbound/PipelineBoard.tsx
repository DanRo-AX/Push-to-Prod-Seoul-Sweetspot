"use client";

// CRM 파이프라인 칸반 — stage 5컬럼(신규/컨택/회신/미팅/성사).
// 리드 카드: 이름 · 회사 · 스코어 게이지 · 마지막 접촉 D+N. 드래그 없음(데모) — hover 리프트만.
import { useEffect, useRef, useState } from "react";
import type { CrmLead } from "@/lib/types";
import { STAGE_LABELS } from "@/components/outbound/followups";

const MONO = "font-[family-name:var(--font-geist-mono)]";

// IO 1회 발화 필인 — 첫 가시화 시점에 스코어 게이지를 scaleX(0)→1 로 채운다.
// reduced-motion 은 게이지의 motion-reduce: 클래스가 CSS 레벨에서 즉시 완성 폭을 보장.
function useFillOnVisible<T extends HTMLElement>() {
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
  }, [filled]);
  return { ref, filled };
}

// 게이지 필인 공통 클래스 — origin-left scaleX 트랜지션 (이징은 리포 표준 cubic-bezier 통일)
const FILL_BAR =
  "h-full origin-left rounded-full transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:scale-x-100";

// 컬럼 헤더 점 색 — 단계가 진행될수록 중립 잉크 → 따뜻해지며 성사(ok)로 수렴한다.
// 단일 액센트 원칙: 버밀리언(--accent)은 전환 임박 단계(미팅) 1곳에만 배급.
const STAGES: { id: CrmLead["stage"]; dot: string }[] = [
  { id: "new", dot: "var(--text-3)" },
  { id: "contacted", dot: "var(--text-2)" },
  { id: "replied", dot: "var(--warn)" },
  { id: "meeting", dot: "var(--accent)" },
  { id: "won", dot: "var(--ok)" },
];

function daysSince(iso: string, asOf: Date): number {
  return Math.max(0, Math.floor((asOf.getTime() - new Date(iso).getTime()) / 86400000));
}

// 스코어 게이지 채움 색 — 75+ 딥그린(유망) / 55+ 버밀리언(주목) / 그 외 중립 잉크
function scoreColor(score: number): string {
  if (score >= 75) return "var(--ok)";
  if (score >= 55) return "var(--accent)";
  return "var(--text-3)";
}

export function PipelineBoard({ leads, asOf }: { leads: CrmLead[]; asOf: Date }) {
  const { ref: fillRef, filled } = useFillOnVisible<HTMLDivElement>();
  return (
    <section className="flex flex-col gap-4">
      {/* 섹션 헤더 — 공통 idiom: 모노 eyebrow 위 + 한국어 타이틀 아래 + 우측 메타 */}
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={`${MONO} text-[11px] font-semibold tracking-[0.18em] text-[var(--text-3)]`}>
            PIPELINE
          </div>
          <h2 className="mt-1 truncate text-xl font-bold text-[var(--text-1)]">
            CRM 파이프라인
          </h2>
        </div>
        <span className="shrink-0 text-[12px] text-[var(--text-3)]">
          리드 <span className="num font-semibold text-[var(--text-2)]">{leads.length}</span>건
          · 스코어 순 정렬
        </span>
      </header>

      {/* xl 미만은 가로 스크롤 보드, xl 부터 5컬럼 그리드 */}
      <div
        ref={fillRef}
        className="flex items-stretch gap-3 overflow-x-auto pb-1 xl:grid xl:grid-cols-5 xl:overflow-visible xl:pb-0"
      >
        {STAGES.map((stage) => {
          const items = leads
            .filter((l) => l.stage === stage.id)
            .sort((a, b) => b.score - a.score);

          return (
            <div
              key={stage.id}
              className="surface-raised flex w-[260px] shrink-0 flex-col rounded-2xl border border-[var(--line-1)] bg-[var(--bg-1)] xl:w-auto"
            >
              {/* 컬럼 헤더 — 점 + 한국어 라벨 + 카운트 */}
              <div className="flex items-center gap-2 border-b border-[var(--line-1)] px-4 py-3">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: stage.dot }}
                />
                <span className="text-[13.5px] font-semibold text-[var(--text-1)]">
                  {STAGE_LABELS[stage.id]}
                </span>
                <span className={`num ml-auto text-[12px] text-[var(--text-3)] ${MONO}`}>
                  {items.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2.5 p-3">
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--line-1)] px-3 py-6 text-center text-[12px] text-[var(--text-3)]">
                    리드 없음
                  </div>
                ) : (
                  items.map((lead, i) => (
                    <article
                      key={lead.email}
                      className="btn-lift anim-rise rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)] px-4 py-3.5"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[15px] font-bold text-[var(--text-1)]">
                          {lead.name}
                        </span>
                        <span
                          className={`num shrink-0 text-[11px] text-[var(--text-3)] ${MONO}`}
                          title={`마지막 접촉 ${lead.lastTouch}`}
                        >
                          D+{daysSince(lead.lastTouch, asOf)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-[var(--text-3)]">
                        {lead.company}
                      </div>
                      {/* 스코어 게이지 — IO 발화 시 scaleX(0)→1 필인 (카드 anim-rise 와 같은 60ms 스태거) */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-inset)]">
                          <div
                            className={`${FILL_BAR} ${
                              filled ? "scale-x-100" : "scale-x-0"
                            }`}
                            style={{
                              width: `${lead.score}%`,
                              background: scoreColor(lead.score),
                              transitionDelay: `${i * 60}ms`,
                            }}
                          />
                        </div>
                        <span className="num shrink-0 text-[11px] font-semibold text-[var(--text-2)]">
                          {lead.score}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
