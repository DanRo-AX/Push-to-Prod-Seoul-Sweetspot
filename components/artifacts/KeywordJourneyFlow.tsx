"use client";

// 키워드 탐색 경로 — analyze_keyword_journey 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 제목 행 + 시드 콜아웃 + 세로 플로우(좌측 레일) + 분기 신호 섹션.
// 전이는 전이율 % 바, B2B/B2C 신호는 칩. 이모지 금지 — SVG 화살표. 색은 토큰 기반.
import type { KeywordJourneyReport } from "@/lib/types";

const MONO = "font-[family-name:var(--font-geist-mono)]";

// 다음 검색어로의 흐름 화살표 — 인라인 SVG (이모지 금지)
function FlowArrow() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3 w-3 shrink-0 text-[var(--text-3)]"
      aria-hidden="true"
    >
      <path
        d="M2 6 H9 M6.5 3 L9.5 6 L6.5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SignalChip({ kind }: { kind: "b2b" | "b2c" }) {
  // B2B = 액센트(문의 전환 신호), B2C = warn(차분한 대비)
  return kind === "b2b" ? (
    <span className="ide-doc-pill ide-doc-pill--accent">B2B 신호</span>
  ) : (
    <span className="ide-doc-pill ide-doc-pill--warn">B2C</span>
  );
}

export function KeywordJourneyFlow({ report }: { report: KeywordJourneyReport }) {
  if (report.nodes.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-3)]">
        아직 분석된 탐색 경로가 없습니다.
      </div>
    );
  }

  const signalOf = (kw: string): "b2b" | "b2c" | null =>
    report.b2bSignals.includes(kw)
      ? "b2b"
      : report.b2cSignals.includes(kw)
        ? "b2c"
        : null;

  return (
    <div>
      {/* 문서 제목 행 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-type-hierarchy" aria-hidden />
        <span className="ide-doc-head-title">
          {report.brandName} 키워드 탐색 경로
        </span>
        <span className="ide-doc-head-meta">시드 — {report.seedKeyword}</span>
      </div>

      {/* 시드 키워드 출발점 — 액센트 콜아웃 */}
      <section className="ide-doc-section">
        <div className="ide-doc-callout">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span
              className={`${MONO} text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--accent-bright)]`}
            >
              SEED
            </span>
            <span className="text-[15px] font-bold text-[var(--text-1)]">
              {report.seedKeyword}
            </span>
            <span className="text-[11px] text-[var(--text-3)]">
              검색 이후의 다음 검색어 흐름
            </span>
          </div>
        </div>
      </section>

      {/* 세로 플로우 — 좌측 레일 + 단계 노드 (경로감) */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-git-merge" aria-hidden />
          탐색 흐름
          <span className="ide-doc-section-meta">{report.nodes.length}노드</span>
        </div>
        <div className="ml-1 border-l border-[var(--line-strong)] pl-5">
          {report.nodes.map((node, i) => {
            const nodeSignal = signalOf(node.keyword);
            return (
              <div key={node.keyword} className="relative pb-3 last:pb-0">
                {/* 레일 위 단계 점 — 보더 라인 중앙에 겹친다 */}
                <span className="absolute -left-[26px] top-[15px] h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-0)] bg-[var(--accent)]" />
                <div className="rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`${MONO} text-[11px] text-[var(--text-3)]`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[13px] font-semibold text-[var(--text-1)]">
                      {node.keyword}
                    </span>
                    {nodeSignal && <SignalChip kind={nodeSignal} />}
                  </div>

                  {/* 다음 검색어 전이 — 전이율 % 바 (내림차순 전제) */}
                  <div className="mt-3 flex flex-col gap-2">
                    {node.next.map((t) => {
                      const sig = signalOf(t.keyword);
                      return (
                        <div
                          key={t.keyword}
                          className="flex items-center gap-2.5"
                        >
                          <FlowArrow />
                          <span className="flex min-w-0 basis-2/5 items-center gap-1.5">
                            <span className="truncate text-[12.5px] font-medium text-[var(--text-2)]">
                              {t.keyword}
                            </span>
                            {sig && <SignalChip kind={sig} />}
                          </span>
                          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-2)]">
                            <div
                              className={`h-full rounded-full ${
                                sig === "b2b"
                                  ? "bg-[var(--accent)]"
                                  : "bg-[var(--accent)]/55"
                              }`}
                              style={{
                                width: `${Math.min(100, Math.max(3, t.rate))}%`,
                              }}
                            />
                          </div>
                          <span className="num w-10 shrink-0 text-right text-[12px] font-bold text-[var(--text-1)]">
                            {t.rate}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 경로 신호 요약 — B2B/B2C 로 갈라지는 분기 키워드 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-symbol-keyword" aria-hidden />
          분기 신호
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-3.5 py-3">
            <p
              className={`${MONO} text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--accent-bright)]`}
            >
              B2B 분기 신호
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {report.b2bSignals.length === 0 ? (
                <span className="text-[12px] text-[var(--text-3)]">
                  감지된 신호 없음
                </span>
              ) : (
                report.b2bSignals.map((kw) => (
                  <span key={kw} className="ide-doc-pill ide-doc-pill--accent">
                    {kw}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-3.5 py-3">
            <p
              className={`${MONO} text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--warn)]`}
            >
              B2C 분기 신호
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {report.b2cSignals.length === 0 ? (
                <span className="text-[12px] text-[var(--text-3)]">
                  감지된 신호 없음
                </span>
              ) : (
                report.b2cSignals.map((kw) => (
                  <span key={kw} className="ide-doc-pill ide-doc-pill--warn">
                    {kw}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 정직성 라벨 */}
      <p
        className={`${MONO} mt-3.5 text-[11px] font-medium leading-relaxed text-[var(--warn)]`}
      >
        ⓘ 데이터 기준: {report.note}
      </p>
    </div>
  );
}
