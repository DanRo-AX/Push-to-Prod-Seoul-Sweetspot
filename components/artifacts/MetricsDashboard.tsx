"use client";

// 지표 대시보드 — recharts 기반 주간 성과 시각화.
// VS Code 문서 idiom(.ide-doc-*): 제목 행 + KPI 스탯 그리드 + 섹션 분할 차트.
// 색은 토큰(var(--…)) 기반 — 다크 .ide-doc 스코프에선 자동 다크, 흰 컨텍스트에서도 유지.
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { MetricsDashboardProps } from "@/lib/types";

// recharts 는 SVG 속성에 var() 를 지원하지 않아 토큰 값을 리터럴로 미러링한다.
// 무채 보조(축/그리드/틱/툴팁)는 흰 컨텍스트용 리터럴이고, 다크 .ide-doc 안에서는
// globals.css 의 `.ide-doc .recharts-*` 규칙이 어두운 면 톤으로 자동 보정한다.
// 시리즈 색은 다크/라이트 공통으로 유지(브랜드 잉크 톤).
const TOOLTIP_STYLE = {
  background: "var(--bg-1)",
  border: "1px solid var(--line-1)",
  borderRadius: 6,
  color: "var(--text-1)",
  fontSize: 12,
} as const;
const TOOLTIP_LABEL_STYLE = { color: "var(--text-1)" } as const;

const AXIS_TICK = { fill: "#8e8e8e", fontSize: 12 } as const;
const GRID_STROKE = "rgba(0,0,0,0.06)";
const AXIS_STROKE = "rgba(0,0,0,0.10)";
// 시리즈 = 버밀리언/딥그린/오커 (단일 발광 없는 잉크 톤)
const SERIES_ACCENT = "#d9472a"; // accent 버밀리언
const SERIES_OK = "#2f8f57"; // ok 딥그린
const SERIES_WARN = "#b8791f"; // warn 오커

// KPI 스탯 — VS Code 문서 톤(흰 카드 대신 헤어라인 박스 + 모노 라벨 + 큰 값).
function Stat({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className="rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] px-3.5 py-3">
      <div className="font-[family-name:var(--font-geist-mono)] text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--text-3)]">
        {label}
      </div>
      <div className="num mt-1 text-[24px] font-bold leading-tight text-[var(--text-1)]">
        {value}
      </div>
      <div className="num mt-0.5 text-[11px] font-semibold text-[var(--ok)]">
        {delta}
      </div>
    </div>
  );
}

export function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const weeks = metrics.weeks;
  if (weeks.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-3)]">
        아직 집계된 지표가 없습니다.
      </div>
    );
  }

  const first = weeks[0];
  const latest = weeks[weeks.length - 1];

  return (
    <div>
      {/* 문서 제목 행 — codicon + 제목 + 우측 기간 메타 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-graph-line" aria-hidden />
        <span className="ide-doc-head-title">{metrics.brandName} 성과 지표</span>
        <span className="ide-doc-head-meta">
          {first.week} → {latest.week}
        </span>
      </div>

      {/* 핵심 수치 — 최신 주 기준 + 첫 주 대비 증가 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-dashboard" aria-hidden />
          핵심 지표
          <span className="ide-doc-section-meta">최신 주 · 첫 주 대비</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          <Stat
            label="팔로워"
            value={latest.followers.toLocaleString()}
            delta={`+${(latest.followers - first.followers).toLocaleString()}`}
          />
          <Stat
            label="뉴스레터 구독"
            value={latest.newsletterSubs.toLocaleString()}
            delta={`+${(latest.newsletterSubs - first.newsletterSubs).toLocaleString()}`}
          />
          <Stat
            label="발송 → 응답"
            value={`${latest.outboundSent} → ${latest.outboundReplies}`}
            delta={`응답 +${latest.outboundReplies - first.outboundReplies}`}
          />
          <Stat
            label="미팅 성사"
            value={latest.meetings.toLocaleString()}
            delta={`+${latest.meetings - first.meetings}`}
          />
        </div>
      </section>

      {/* 팔로워 성장 영역차트 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-pulse" aria-hidden />
          팔로워 · 구독자 성장
        </div>
        <div className="h-56 w-full rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={weeks}
              margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="octo-followers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_OK} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES_OK} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="octo-subs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_ACCENT} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={SERIES_ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="week" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="followers"
                name="팔로워"
                stroke={SERIES_OK}
                strokeWidth={3}
                fill="url(#octo-followers)"
                dot={{ r: 4, fill: SERIES_OK }}
              />
              <Area
                type="monotone"
                dataKey="newsletterSubs"
                name="구독자"
                stroke={SERIES_ACCENT}
                strokeWidth={3}
                fill="url(#octo-subs)"
                dot={{ r: 4, fill: SERIES_ACCENT }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 아웃바운드 퍼널 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-graph" aria-hidden />
          아웃바운드 퍼널 — 발송 · 응답 · 미팅
        </div>
        <div className="h-56 w-full rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={weeks}
              margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="week" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                cursor={{ fill: "rgba(127,127,127,0.10)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="outboundSent"
                name="발송"
                fill={SERIES_ACCENT}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="outboundReplies"
                name="응답"
                fill={SERIES_WARN}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="meetings"
                name="미팅"
                fill={SERIES_OK}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 정직성 라벨 — 조용한 풋노트 */}
      <p className="mt-3.5 font-[family-name:var(--font-geist-mono)] text-[11px] font-medium leading-relaxed text-[var(--warn)]">
        ⓘ 데이터 기준: {metrics.note}
      </p>
    </div>
  );
}
