"use client";

// 키워드 기회 리포트 — analyze_keywords 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 제목 행 + KPI 스탯 + .ide-doc-table 기회 테이블.
// 화살표는 인라인 SVG(이모지 금지). 색은 토큰 기반 — 다크/흰 컨텍스트 공통.
import type { KeywordTableProps, KeywordRow } from "@/lib/types";

// 인텐트 3분류 — 거래=ok(전환 임박) · 탐색=warn(검토 단계) · 정보=중립
const INTENT_PILL: Record<KeywordRow["intent"], string> = {
  거래: "ide-doc-pill--ok",
  탐색: "ide-doc-pill--warn",
  정보: "",
};

// 검색 주체 축 — B2B(문의 전환 의도)는 액센트, B2C 는 차분하게
const AUDIENCE_PILL: Record<KeywordRow["audience"], string> = {
  B2B: "ide-doc-pill--accent",
  B2C: "",
};

// 순위 변동 화살표 — CSS/SVG 삼각형 (이모지 사용 금지)
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

// KPI 스탯 — 흰 카드 대신 헤어라인 박스 + 모노 라벨.
function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  // .num(모노)은 숫자형 값 전용 — 한글 문자열 값에 모노를 걸면 자간이 어색해진다.
  const isNumeric = /^[\d.,\s%+\-—]+[가-힣]{0,2}$/.test(value);
  return (
    <div className="rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-3.5 py-3">
      <div className="font-[family-name:var(--font-geist-mono)] text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--text-3)]">
        {label}
      </div>
      <div
        className={`mt-1 truncate text-[24px] leading-tight text-[var(--text-1)] ${
          isNumeric ? "num font-bold" : "font-semibold tracking-[-0.01em]"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold text-[var(--text-2)]">
        {sub}
      </div>
    </div>
  );
}

export function KeywordTable({ report }: KeywordTableProps) {
  const rows = report.rows;
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-3)]">
        아직 분석된 키워드가 없습니다.
      </div>
    );
  }

  const gapCount = rows.filter((r) => r.competitorGap).length;
  const topRiser = rows.reduce<KeywordRow | null>(
    (best, r) =>
      r.rankDelta > 0 && (!best || r.rankDelta > best.rankDelta) ? r : best,
    null,
  );

  return (
    <div>
      {/* 문서 제목 행 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-search" aria-hidden />
        <span className="ide-doc-head-title">
          {report.brandName} 키워드 기회 리포트
        </span>
        <span className="ide-doc-head-meta">{report.capturedAt} 기준</span>
      </div>

      {/* KPI 스트립 — "6,700개를 보고 있다"가 여기서 크게 보인다 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-dashboard" aria-hidden />
          기회 요약
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Stat
            label="추적 키워드"
            value={report.totalTracked.toLocaleString()}
            sub={`기회 상위 ${rows.length}개 표시`}
          />
          <Stat
            label="경쟁사 갭"
            value={`${gapCount}건`}
            sub="경쟁사 상위 · 우리 미점유"
          />
          <Stat
            label="최고 상승"
            value={topRiser ? topRiser.keyword : "—"}
            sub={topRiser ? `전주 대비 +${topRiser.rankDelta}계단` : "변동 없음"}
          />
        </div>
      </section>

      {/* 기회 테이블 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-list-unordered" aria-hidden />
          기회 테이블
          <span className="ide-doc-section-meta">{rows.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="ide-doc-table min-w-[620px]">
            <thead>
              <tr>
                {/* 숫자 컬럼(월 검색량·기회 스코어)은 우측 정렬 */}
                {[
                  { h: "키워드", numeric: false },
                  { h: "월 검색량", numeric: true },
                  { h: "순위", numeric: false },
                  { h: "인텐트", numeric: false },
                  { h: "주체", numeric: false },
                  { h: "기회 스코어", numeric: true },
                ].map(({ h, numeric }) => (
                  <th key={h} className={numeric ? "ide-doc-td-num" : ""}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.keyword}>
                  {/* competitorGap 행은 좌측 보더로 강조 */}
                  <td
                    style={
                      r.competitorGap
                        ? { borderLeft: "3px solid var(--accent)" }
                        : { borderLeft: "3px solid transparent" }
                    }
                  >
                    <div className="text-[13px] font-semibold text-[var(--text-1)]">
                      {r.keyword}
                    </div>
                    {r.competitorGap && (
                      <div className="mt-0.5 text-[11px] font-medium text-[var(--accent-bright)]">
                        경쟁사 갭
                      </div>
                    )}
                  </td>
                  <td className="ide-doc-td-num text-[var(--text-2)]">
                    {r.monthlySearches.toLocaleString()}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="num text-[12.5px] font-semibold text-[var(--text-1)]">
                        {r.rank !== null ? `${r.rank}위` : "미노출"}
                      </span>
                      {r.rankDelta !== 0 && (
                        <span
                          className={`ide-doc-pill ${
                            r.rankDelta > 0
                              ? "ide-doc-pill--ok"
                              : "ide-doc-pill--warn"
                          }`}
                        >
                          <DeltaArrow up={r.rankDelta > 0} />
                          {Math.abs(r.rankDelta)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`ide-doc-pill ${INTENT_PILL[r.intent]}`}>
                      {r.intent}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`ide-doc-pill ${AUDIENCE_PILL[r.audience]}`}
                    >
                      {r.audience}
                    </span>
                  </td>
                  <td>
                    {/* 바+숫자 그룹을 우측 끝에 정렬 */}
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--bg-2)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${r.opportunityScore}%` }}
                        />
                      </div>
                      <span className="num w-7 text-right text-[12.5px] font-bold tabular-nums text-[var(--text-1)]">
                        {r.opportunityScore}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 정직성 라벨 — 조용한 풋노트 */}
      <p className="mt-3.5 font-[family-name:var(--font-geist-mono)] text-[11px] font-medium leading-relaxed text-[var(--warn)]">
        ⓘ 데이터 기준: {report.note}
      </p>
    </div>
  );
}
