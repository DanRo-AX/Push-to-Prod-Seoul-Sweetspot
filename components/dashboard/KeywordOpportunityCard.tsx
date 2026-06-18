"use client";

// 키워드 기회 Top 리스트 — components/artifacts/KeywordTable.tsx 의 대시보드 콤팩트 변형.
// 기회 스코어 상위 N개를 게이지 중심으로 보여준다 (전체 테이블은 콘솔 아티팩트가 담당).

import type { KeywordReport, KeywordRow } from "@/lib/types";
import { DashCard } from "@/components/dashboard/DashCard";

const MONO = "font-[family-name:var(--font-geist-mono)]";

// 인텐트 3종 — 단일 액센트 원칙상 info(=accent) 대신 에디토리얼 상태색으로 구분한다.
// 거래(전환 직결)=딥그린, 탐색=오커, 정보=중립 잉크 칩.
const INTENT_STYLE: Record<KeywordRow["intent"], string> = {
  거래: "bg-[var(--ok-dim)] text-[var(--ok)]",
  탐색: "bg-[var(--warn-dim)] text-[var(--warn)]",
  정보: "bg-[var(--bg-2)] text-[var(--text-2)]",
};

// 순위 변동 화살표 — 인라인 SVG 삼각형 (이모지 금지)
function DeltaArrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 8 8" className="h-2 w-2 shrink-0" aria-hidden="true">
      <path
        d={up ? "M4 1 L7.5 7 L0.5 7 Z" : "M4 7 L7.5 1 L0.5 1 Z"}
        fill="currentColor"
      />
    </svg>
  );
}

const TOP_N = 6;

export interface KeywordOpportunityCardProps {
  report: KeywordReport;
  liveVersion?: number;
  className?: string;
}

export function KeywordOpportunityCard({
  report,
  liveVersion = 0,
  className,
}: KeywordOpportunityCardProps) {
  const rows = [...report.rows]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, TOP_N);

  return (
    <DashCard
      eyebrow="KEYWORDS"
      title={`키워드 기회 Top ${rows.length}`}
      meta={`${report.totalTracked.toLocaleString()}개 추적 중`}
      liveVersion={liveVersion}
      note={report.note}
      className={className}
    >
      {rows.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-3)]">
          아직 분석된 키워드가 없습니다.
        </div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r, i) => (
            <li
              key={r.keyword}
              className={`flex items-center gap-3 border-b border-[var(--line-1)] py-2.5 last:border-b-0 ${
                r.competitorGap
                  ? "border-l-[3px] border-l-[var(--accent)] pl-3"
                  : "border-l-[3px] border-l-transparent pl-3"
              }`}
            >
              <span
                className={`num w-6 shrink-0 text-[12px] ${
                  i === 0 ? "text-[var(--accent)]" : "text-[var(--text-3)]"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-semibold text-[var(--text-1)]">
                    {r.keyword}
                  </span>
                  <span
                    className={`shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold ${INTENT_STYLE[r.intent]}`}
                  >
                    {r.intent}
                  </span>
                  {r.competitorGap && (
                    <span className="shrink-0 rounded-[4px] bg-[var(--accent-tint)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                      경쟁사 갭
                    </span>
                  )}
                </div>
                <div
                  className={`mt-0.5 flex items-center gap-2 ${MONO} text-[11px] text-[var(--text-3)]`}
                >
                  <span className="num">
                    월 {r.monthlySearches.toLocaleString()}회
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="num">
                    {r.rank !== null ? `${r.rank}위` : "미노출"}
                  </span>
                  {r.rankDelta !== 0 && (
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        r.rankDelta > 0
                          ? "text-[var(--ok)]"
                          : "text-[var(--warn)]"
                      }`}
                    >
                      <DeltaArrow up={r.rankDelta > 0} />
                      {Math.abs(r.rankDelta)}
                    </span>
                  )}
                </div>
              </div>

              {/* 기회 스코어 게이지 */}
              <div className="flex shrink-0 items-center gap-2.5">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--bg-3)] sm:w-28">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${r.opportunityScore}%` }}
                  />
                </div>
                <span className="num w-7 text-right text-[14px] font-bold tabular-nums text-[var(--text-1)]">
                  {r.opportunityScore}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}
