"use client";

// 뉴스레터 발송 성과 — analyze_newsletter_performance 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): KPI 키-값 + 오픈율/CTR 추이 라인차트(다크) +
// 발송 로그 테이블 + 차기 제목 트리거/세그먼트 callout + 인사이트. 수치는 도구 계산값 인용.
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type {
  NewsletterPerformanceReport,
  NewsletterPerformanceRow,
  SubjectVariant,
} from "@/lib/types";

const MONO = "font-[family-name:var(--ide-mono,var(--font-geist-mono))]";

// recharts 는 SVG/포털 속성에 var() 를 지원하지 않아 토큰 값을 리터럴로 미러링한다.
// .ide-doc 다크 스코프 톤(VS Code Dark Modern): bg-1 #252526 · line-1 rgba(255,255,255,.09)
// text-1 #cccccc · text-2 #9d9d9d · text-3 #6e6e6e. 무채 축/그리드는 .ide-doc 의 recharts CSS
// 가 다시 보정하므로(흰 standalone 대비) 시리즈 색만 의미값으로 둔다.
const TOOLTIP_STYLE = {
  background: "#252526",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#cccccc",
  fontSize: 13,
  boxShadow: "0 1px 2px rgba(0,0,0,.4), 0 10px 28px rgba(0,0,0,.38)",
} as const;
const TOOLTIP_LABEL_STYLE = { color: "#cccccc" } as const;
const AXIS_TICK = { fill: "#9d9d9d", fontSize: 12 } as const;
const GRID_STROKE = "rgba(255,255,255,0.10)";
const AXIS_STROKE = "rgba(255,255,255,0.12)";
const LEGEND_STYLE = { fontSize: 13, color: "#9d9d9d" } as const;
// 시리즈/상태 색 — VS Code 데코레이션 톤(어두운 면 가독).
const COLOR = { ok: "#4ec9b0", accent: "#3794ff", warn: "#cca700" } as const;

const ANGLE_LABELS: Record<SubjectVariant["angle"], string> = {
  curiosity: "호기심",
  urgency: "긴급성",
  personalization: "개인화",
  social_proof: "사회적 증거",
  direct_benefit: "직접 혜택",
};

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded border border-[var(--line-1)] bg-[var(--bg-1)] px-3.5 py-3">
      <div className={`${MONO} text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-3)]`}>
        {label}
      </div>
      <div className="num mt-1 text-[24px] font-bold text-[var(--text-1)]">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold" style={{ color: accent }}>
        {sub}
      </div>
    </div>
  );
}

// 발송 로그 행 — 오픈율/CTR + 벤치마크 플래그
function SendRow({ row, benchmark }: { row: NewsletterPerformanceRow; benchmark: number }) {
  const belowBenchmark = row.openRate < benchmark;
  return (
    <tr>
      <td>
        <div className="text-[13px] font-semibold text-[var(--text-1)]">{row.subject}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`${MONO} num text-[11px] text-[var(--text-3)]`}>{row.sentAt}</span>
          <span className="num text-[11px] text-[var(--text-3)]">
            발송 {row.delivered.toLocaleString()}
          </span>
        </div>
        {/* 벤치마크 경보 플래그 */}
        {row.flags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {row.flags.map((flag, i) => (
              <span key={`${flag}-${i}`} className="ide-doc-pill ide-doc-pill--warn">
                {flag}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="ide-doc-td-num" style={{ width: 70 }}>
        <span
          className="num text-[16px] font-bold"
          style={{ color: belowBenchmark ? COLOR.warn : COLOR.ok }}
        >
          {row.openRate}%
        </span>
        <div className={`${MONO} text-[9px] tracking-[0.04em] text-[var(--text-3)]`}>오픈율</div>
      </td>
      <td className="ide-doc-td-num" style={{ width: 60 }}>
        <span className="num text-[16px] font-bold text-[var(--text-1)]">{row.ctr}%</span>
        <div className={`${MONO} text-[9px] tracking-[0.04em] text-[var(--text-3)]`}>CTR</div>
      </td>
    </tr>
  );
}

export function NewsletterPerformance({ report }: { report: NewsletterPerformanceReport }) {
  const rows = report.rows ?? [];
  // 차트는 시간 오름차순(최신 우선 rows 를 뒤집어 추이로 본다)
  const chartData = [...rows].reverse().map((r) => ({
    sentAt: r.sentAt,
    openRate: r.openRate,
    ctr: r.ctr,
  }));
  const triggers = report.nextSubjectTriggers ?? [];
  const segments = report.recommendedSegments ?? [];

  return (
    <div className="ide-doc-in">
      {/* 문서 헤더 + period/source 메타 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-mail" aria-hidden />
        <span className="ide-doc-head-title">{report.brandName} 뉴스레터 성과</span>
        <span className="ide-doc-head-meta">
          {report.period} · {report.source}
        </span>
      </div>

      {/* KPI — 평균 오픈율(벤치마크 대비) · 평균 CTR · 추세 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-dashboard" aria-hidden />
          핵심 지표
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <StatCard
            label="평균 오픈율"
            value={`${report.avgOpenRate}%`}
            sub={`벤치마크 ${report.benchmarkOpenRate}%`}
            accent={report.avgOpenRate >= report.benchmarkOpenRate ? COLOR.ok : COLOR.warn}
          />
          <StatCard label="평균 CTR" value={`${report.avgCtr}%`} sub="발송 평균" accent={COLOR.accent} />
          <StatCard label="추세" value={report.trend} sub="직전 발송 대비" accent="#9d9d9d" />
        </div>
      </section>

      {/* 오픈율/CTR 추이 라인차트 + 벤치마크 기준선 */}
      {chartData.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-graph-line" aria-hidden />
            발송별 오픈율 · CTR 추이
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis
                  dataKey="sentAt"
                  tick={AXIS_TICK}
                  stroke={AXIS_STROKE}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} unit="%" />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <ReferenceLine
                  y={report.benchmarkOpenRate}
                  stroke={COLOR.warn}
                  strokeDasharray="4 4"
                  label={{
                    value: `벤치마크 ${report.benchmarkOpenRate}%`,
                    position: "insideTopRight",
                    fill: COLOR.warn,
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="openRate"
                  name="오픈율"
                  stroke={COLOR.ok}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: COLOR.ok }}
                />
                <Line
                  type="monotone"
                  dataKey="ctr"
                  name="CTR"
                  stroke={COLOR.accent}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: COLOR.accent }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* 발송 로그 — 최신 우선 (테이블) */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-history" aria-hidden />
          발송 로그
          <span className="ide-doc-section-meta">최신순 · {rows.length}건</span>
        </div>
        {rows.length === 0 ? (
          <div className="ide-doc-callout">아직 분석할 발송 기록이 없습니다.</div>
        ) : (
          <table className="ide-doc-table">
            <thead>
              <tr>
                <th>제목 · 발송</th>
                <th className="ide-doc-td-num">오픈율</th>
                <th className="ide-doc-td-num">CTR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <SendRow key={`${row.sentAt}-${i}`} row={row} benchmark={report.benchmarkOpenRate} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 차기 제목 트리거 + 추천 세그먼트 */}
      {(triggers.length > 0 || segments.length > 0) && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-target" aria-hidden />
            다음 액션
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {triggers.length > 0 && (
              <div>
                <div className={`${MONO} mb-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-3)]`}>
                  차기 제목 트리거
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {triggers.map((t, i) => (
                    <span key={`${t}-${i}`} className="ide-doc-pill ide-doc-pill--accent">
                      {ANGLE_LABELS[t]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {segments.length > 0 && (
              <div>
                <div className={`${MONO} mb-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-3)]`}>
                  추천 세그먼트
                </div>
                <ul className="flex flex-col gap-2">
                  {segments.map((seg, i) => (
                    <li key={`${seg.segment}-${i}`} className="text-[12px] leading-relaxed">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--text-1)]">{seg.segment}</span>
                        <span className="num text-[11px] text-[var(--text-3)]">
                          {seg.size.toLocaleString()}명
                        </span>
                      </div>
                      <p className="text-[var(--text-2)]">{seg.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 인사이트 callout — 다음 초안에 반영 (학습 루프) */}
      {report.insight && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-lightbulb" aria-hidden />
            다음 초안에 반영할 인사이트
          </div>
          <div className="ide-doc-callout ide-doc-callout--ok">
            <p className="text-[14px] font-semibold leading-relaxed text-[var(--text-1)]">
              {report.insight}
            </p>
          </div>
        </section>
      )}

      {/* 정직성 라벨 */}
      {report.note && (
        <p className="ide-doc-section mt-3 flex items-center gap-1.5 text-[11px] font-medium leading-relaxed text-[var(--warn)]">
          <i className="codicon codicon-info" aria-hidden style={{ fontSize: 13 }} />
          데이터 기준: {report.note}
        </p>
      )}
    </div>
  );
}
