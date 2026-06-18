"use client";

// 리드 여정 리포트 — analyze_lead_journey 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 제목 행 + KPI 스탯 + 패턴 콜아웃 + 핫리드 리스트.
// 이모지 금지 — 칩/게이지로 표현. 색은 토큰 기반 — 다크/흰 컨텍스트 공통.
import type { LeadJourneyReport } from "@/lib/types";

const MONO = "font-[family-name:var(--font-geist-mono)]";

// KPI 스탯 — 헤어라인 박스 + 모노 라벨 + 큰 값.
function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-3.5 py-3">
      <div
        className={`${MONO} text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--text-3)]`}
      >
        {label}
      </div>
      <div className="num mt-1 text-[24px] font-bold leading-tight text-[var(--text-1)]">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold text-[var(--text-3)]">
        {sub}
      </div>
    </div>
  );
}

// 패턴 문장 안의 숫자 강조 — 액센트 배급은 이 문장 1곳에만
function Num({ children }: { children: string }) {
  return <span className="num font-bold text-[var(--accent-bright)]">{children}</span>;
}

export function LeadJourneyCard({ report }: { report: LeadJourneyReport }) {
  const { stats, hotLeads } = report;
  const maxMinutes = Math.max(...hotLeads.map((l) => l.totalMinutes), 1);

  return (
    <div>
      {/* 문서 제목 행 + period/source 메타 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-person" aria-hidden />
        <span className="ide-doc-head-title">
          {report.brandName} 리드 여정 분석
        </span>
        <span className="ide-doc-head-meta">
          {report.period} · {report.source}
        </span>
      </div>

      {/* KPI 4장 — 전환 패턴의 핵심 숫자 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-dashboard" aria-hidden />
          전환 패턴 지표
        </div>
        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          <Stat
            label="평균 방문"
            value={`${stats.avgVisitsBeforeConversion}회`}
            sub="전환까지 누적 방문"
          />
          <Stat
            label="소요일"
            value={`${stats.avgDaysToConversion}일`}
            sub="첫 방문 → 문의"
          />
          <Stat
            label="평균 체류"
            value={`${stats.avgSessionMinutes}분`}
            sub="세션당 평균"
          />
          <Stat
            label="고관여 기준"
            value={`${stats.highEngagementThreshold}회+`}
            sub="핫리드 분류 임계치"
          />
        </div>
      </section>

      {/* 전환 유저 패턴 문장 — 이 리포트의 결론 한 줄 */}
      <section className="ide-doc-section">
        <div className="ide-doc-callout">
          <p
            className={`${MONO} mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--accent-bright)]`}
          >
            전환 유저 패턴
          </p>
          <p className="text-[13px] leading-relaxed text-[var(--text-1)]">
            전환 고객은 평균 <Num>{`${stats.avgVisitsBeforeConversion}회`}</Num>{" "}
            방문하고 세션당 <Num>{`${stats.avgSessionMinutes}분`}</Num> 머문 뒤,
            첫 방문 <Num>{`${stats.avgDaysToConversion}일`}</Num> 만에 문의합니다.
            방문 <Num>{`${stats.highEngagementThreshold}회`}</Num> 이상인 미전환
            유저가 가장 뜨거운 영업 대상입니다.
          </p>
        </div>
      </section>

      {/* 핫리드 리스트 — 임계치 이상 방문했지만 아직 미전환 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-flame" aria-hidden />
          핫리드 — 고관여 기준 이상, 미전환
          <span className="ide-doc-section-meta">{hotLeads.length}명</span>
        </div>
        {hotLeads.length === 0 ? (
          <p className="rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-4 py-8 text-center text-[13px] text-[var(--text-3)]">
            현재 기준을 넘는 미전환 리드가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {hotLeads.map((l) => (
              <li
                key={l.userId}
                className="rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-3.5 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`${MONO} truncate text-[12px] text-[var(--text-2)]`}
                    >
                      {l.userId}
                    </span>
                    <span className="ide-doc-pill ide-doc-pill--warn">
                      미전환 고관여
                    </span>
                  </div>
                  <span className="num shrink-0 text-[11px] text-[var(--text-3)]">
                    방문 {l.visits}회 · 경과 {l.daysToConversion}일
                  </span>
                </div>
                {/* 누적 체류분 게이지 — 핫리드 중 최대값 대비 */}
                <div className="mt-2 flex items-center gap-2.5">
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-2)]">
                    <div
                      className="h-full rounded-full bg-[var(--warn)]"
                      style={{
                        width: `${Math.max(4, (l.totalMinutes / maxMinutes) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="num shrink-0 text-[12px] font-bold text-[var(--text-1)]">
                    누적 {l.totalMinutes}분
                  </span>
                </div>
                <p
                  className={`${MONO} mt-1.5 truncate text-[11px] text-[var(--text-3)]`}
                >
                  최근 방문 {l.lastPath}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 정직성 라벨 — 조용한 풋노트 */}
      <p
        className={`${MONO} mt-3.5 text-[11px] font-medium leading-relaxed text-[var(--warn)]`}
      >
        ⓘ 데이터 기준: {report.note}
      </p>
    </div>
  );
}
