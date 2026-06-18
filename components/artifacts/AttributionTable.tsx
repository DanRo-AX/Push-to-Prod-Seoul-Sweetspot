"use client";

// 콘텐츠 기여 분석 — analyze_content_attribution 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 제목 행 + .ide-doc-table 기여 테이블 + 인사이트 콜아웃.
// 전환율 게이지, 1위 행 강조. 색은 토큰 기반 — 다크/흰 컨텍스트 공통.
import type { AttributionReport } from "@/lib/types";

const MONO = "font-[family-name:var(--font-geist-mono)]";

export function AttributionTable({ report }: { report: AttributionReport }) {
  const rows = report.topConverters;
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-3)]">
        아직 집계된 기여 데이터가 없습니다.
      </div>
    );
  }

  // 게이지 폭은 1위 전환율 대비 비율 — 절대 % 로는 바가 안 보여 상대화
  const maxRate = Math.max(...rows.map((r) => r.conversionRate), 0.1);

  return (
    <div>
      {/* 문서 제목 행 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-references" aria-hidden />
        <span className="ide-doc-head-title">
          {report.brandName} 콘텐츠 기여 분석
        </span>
        <span className="ide-doc-head-meta">{report.period}</span>
      </div>

      {/* 기여 테이블 — conversionRate 내림차순 전제, 1위 행 강조 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-list-unordered" aria-hidden />
          상위 기여 콘텐츠
          <span className="ide-doc-section-meta">{rows.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="ide-doc-table min-w-[560px]">
            <thead>
              <tr>
                {[
                  { h: "콘텐츠", numeric: false },
                  { h: "타겟 키워드", numeric: false },
                  { h: "세션", numeric: true },
                  { h: "문의", numeric: true },
                  { h: "전환율", numeric: true },
                ].map(({ h, numeric }) => (
                  <th key={h} className={numeric ? "ide-doc-td-num" : ""}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isTop = i === 0;
                return (
                  <tr key={r.contentId}>
                    {/* 1위 행은 좌측 액센트 보더 + 칩으로 강조 */}
                    <td
                      style={{
                        borderLeft: isTop
                          ? "3px solid var(--accent)"
                          : "3px solid transparent",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[var(--text-1)]">
                          {r.title}
                        </span>
                        {isTop && (
                          <span className="ide-doc-pill ide-doc-pill--accent">
                            1위
                          </span>
                        )}
                      </div>
                      <div className={`${MONO} mt-0.5 text-[11px] text-[var(--text-3)]`}>
                        {r.contentId}
                      </div>
                    </td>
                    <td>
                      <span className="ide-doc-pill">{r.keyword}</span>
                    </td>
                    <td className="ide-doc-td-num text-[var(--text-2)]">
                      {r.sessions.toLocaleString()}
                    </td>
                    <td className="ide-doc-td-num font-semibold text-[var(--text-1)]">
                      {r.inquiries.toLocaleString()}
                    </td>
                    <td>
                      {/* 전환율 게이지 + 숫자 — 우측 끝 정렬 */}
                      <div className="flex items-center justify-end gap-2.5">
                        <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--bg-2)]">
                          <div
                            className={`h-full rounded-full ${
                              isTop
                                ? "bg-[var(--accent)]"
                                : "bg-[var(--accent)]/55"
                            }`}
                            style={{
                              width: `${Math.max(4, (r.conversionRate / maxRate) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="num w-12 text-right text-[12.5px] font-bold tabular-nums text-[var(--text-1)]">
                          {r.conversionRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 인사이트 콜아웃 — 다음 콘텐츠 기획에 반영할 결론 */}
      <section className="ide-doc-section">
        <div className="ide-doc-callout">
          <p
            className={`${MONO} mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--accent-bright)]`}
          >
            다음 기획에 반영
          </p>
          <p className="text-[13px] leading-relaxed text-[var(--text-1)]">
            {report.insight}
          </p>
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
