"use client";

// 콘텐츠 D+1/D+7 성과 리포트 — track_content_performance 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 게시물별 섹션(저장률 강조 + D+1/D+7 비교 테이블) +
// 상위 성과 패턴(topPattern) callout. D+7 미집계 게시물은 별도 분기.
import type { ContentPerformanceProps, PostMetricsSnapshot } from "@/lib/types";

const METRIC_COLUMNS: { key: keyof PostMetricsSnapshot; label: string }[] = [
  { key: "reach", label: "도달" },
  { key: "likes", label: "좋아요" },
  { key: "saves", label: "저장" },
  { key: "profileVisits", label: "프로필" },
  { key: "linkClicks", label: "링크" },
];

export function ContentPerformance({ report }: ContentPerformanceProps) {
  const posts = report.posts;
  if (posts.length === 0) {
    return (
      <div className="ide-doc-in">
        <div className="ide-doc-callout">아직 추적 중인 게시물이 없습니다.</div>
      </div>
    );
  }

  // posts 는 saveRateD7 내림차순 — D+7 보유 첫 게시물이 TOP
  const topId = posts.find((p) => p.saveRateD7 !== null)?.postId;

  return (
    <div className="ide-doc-in">
      {/* 문서 헤더 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-graph-line" aria-hidden />
        <span className="ide-doc-head-title">{report.brandName} 콘텐츠 성과</span>
        <span className="ide-doc-head-meta">D+1 / D+7 비교</span>
      </div>

      {/* 게시물별 섹션 */}
      {posts.map((p) => {
        const isTop = p.postId === topId;
        return (
          <section key={p.postId} className="ide-doc-section">
            <div className="ide-doc-section-head">
              <i className="codicon codicon-device-camera" aria-hidden />
              <span className="min-w-0 truncate normal-case tracking-normal text-[var(--text-1)]">
                {p.concept}
              </span>
              {isTop && (
                <span className="ide-doc-pill ide-doc-pill--accent shrink-0">TOP</span>
              )}
              <span className="ide-doc-section-meta">
                {p.saveRateD7 !== null ? (
                  <span className="flex items-center gap-1.5">
                    <span className="num text-[16px] font-bold text-[var(--ok)]">
                      {p.saveRateD7}%
                    </span>
                    <span>D+7 저장률</span>
                  </span>
                ) : (
                  <span className="ide-doc-pill">D+7 집계 전</span>
                )}
              </span>
            </div>

            {/* 메타 키-값 */}
            <div className="ide-doc-kv">
              <span className="ide-doc-kv-key">포맷 · 발행</span>
              <span className="ide-doc-kv-val">
                {p.format} · {p.publishedAt}
              </span>
            </div>

            {/* D+1 vs D+7 지표 비교 테이블 */}
            <div className="mt-2 overflow-x-auto">
              <table className="ide-doc-table" style={{ minWidth: 340 }}>
                <thead>
                  <tr>
                    <th />
                    {METRIC_COLUMNS.map((m) => (
                      <th key={m.key} className="ide-doc-td-num">
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="num text-[var(--text-3)]">D+1</td>
                    {METRIC_COLUMNS.map((m) => (
                      <td
                        key={m.key}
                        className={`ide-doc-td-num ${
                          m.key === "saves" ? "font-bold text-[var(--text-1)]" : ""
                        }`}
                      >
                        {p.metricsD1[m.key].toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="num text-[var(--text-3)]">D+7</td>
                    {METRIC_COLUMNS.map((m) => (
                      <td
                        key={m.key}
                        className={`ide-doc-td-num ${
                          p.metricsD7 === null
                            ? "text-[var(--text-3)]"
                            : m.key === "saves"
                              ? "font-bold text-[var(--ok)]"
                              : ""
                        }`}
                      >
                        {p.metricsD7 ? p.metricsD7[m.key].toLocaleString() : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* topPattern callout — 다음 초안에 반영할 학습 루프의 핵심 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-lightbulb" aria-hidden />
          다음 초안에 반영할 패턴
        </div>
        <div className="ide-doc-callout ide-doc-callout--ok">
          <p className="text-[14px] font-semibold leading-relaxed text-[var(--text-1)]">
            {report.topPattern}
          </p>
        </div>
      </section>

      {/* 정직성 라벨 */}
      <p className="ide-doc-section mt-3 flex items-center gap-1.5 text-[11px] font-medium leading-relaxed text-[var(--warn)]">
        <i className="codicon codicon-info" aria-hidden style={{ fontSize: 13 }} />
        데이터 기준: {report.note}
      </p>
    </div>
  );
}
