"use client";

// 채널 성장 시계열 — track_follower_growth 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 제목 행 + KPI 스탯 + recharts 2시리즈 영역차트.
// 색은 토큰 기반 — 다크 .ide-doc 스코프에선 자동 다크, 흰 컨텍스트에서도 유지.
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { FollowerGrowthReport } from "@/lib/types";

const MONO = "font-[family-name:var(--font-geist-mono)]";

// recharts 는 SVG 속성에 var() 를 지원하지 않아 토큰 값을 리터럴로 미러링한다.
// 무채 보조(축/그리드/틱/툴팁)는 흰 컨텍스트용 리터럴이고, 다크 .ide-doc 안에서는
// globals.css 의 `.ide-doc .recharts-*` 규칙이 어두운 면 톤으로 자동 보정한다.
const TOOLTIP_STYLE = {
  background: "var(--bg-1)",
  border: "1px solid var(--line-1)",
  borderRadius: 6,
  color: "var(--text-1)",
  fontSize: 12,
} as const;
const TOOLTIP_LABEL_STYLE = { color: "var(--text-1)" } as const;
const AXIS_TICK = { fill: "#8e8e8e", fontSize: 12 } as const;
const GRID_STROKE = "rgba(0,0,0,0.06)"; // 그리드 = 잉크 헤어라인
const AXIS_STROKE = "rgba(0,0,0,0.10)"; // 축 = 잉크 헤어라인
const LEGEND_STYLE = { fontSize: 12 } as const;
// 시리즈 = 딥그린(인스타) · 버밀리언(뉴스레터)
const COLOR = { ok: "#2f8f57", accent: "#d9472a" } as const;

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
      <div className="num mt-0.5 text-[11px] font-semibold text-[var(--ok)]">
        {sub}
      </div>
    </div>
  );
}

export function FollowerGrowthChart({ report }: { report: FollowerGrowthReport }) {
  const snaps = report.snapshots;
  if (snaps.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-3)]">
        아직 집계된 채널 성장 데이터가 없습니다.
      </div>
    );
  }

  const first = snaps[0];
  const latest = snaps[snaps.length - 1];
  const growth = report.weeklyGrowthRatePct;

  return (
    <div>
      {/* 문서 제목 행 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-graph-line" aria-hidden />
        <span className="ide-doc-head-title">{report.brandName} 채널 성장</span>
        <span className="ide-doc-head-meta">
          {first.date} → {latest.date}
        </span>
      </div>

      {/* KPI — 채널별 현재값 + 주간 성장률 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-dashboard" aria-hidden />
          채널 지표
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Stat
            label="인스타 팔로워"
            value={latest.instagram.toLocaleString()}
            sub={`기간 +${(latest.instagram - first.instagram).toLocaleString()}`}
          />
          <Stat
            label="뉴스레터 구독"
            value={latest.newsletterSubs.toLocaleString()}
            sub={`기간 +${(latest.newsletterSubs - first.newsletterSubs).toLocaleString()}`}
          />
          <Stat
            label="주간 성장률"
            value={`${growth > 0 ? "+" : ""}${growth}%`}
            sub="두 채널 합산 주간 평균"
          />
        </div>
      </section>

      {/* 2시리즈 영역차트 — 인스타(딥그린) · 뉴스레터(버밀리언) */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-pulse" aria-hidden />
          팔로워 · 구독자 추이
        </div>
        <div className="h-56 w-full rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-1)] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={snaps}
              margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fg-insta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.ok} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={COLOR.ok} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fg-subs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.accent} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={COLOR.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK}
                stroke={AXIS_STROKE}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
              />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Area
                type="monotone"
                dataKey="instagram"
                name="인스타 팔로워"
                stroke={COLOR.ok}
                strokeWidth={3}
                fill="url(#fg-insta)"
                dot={{ r: 3, fill: COLOR.ok }}
              />
              <Area
                type="monotone"
                dataKey="newsletterSubs"
                name="뉴스레터 구독"
                stroke={COLOR.accent}
                strokeWidth={3}
                fill="url(#fg-subs)"
                dot={{ r: 3, fill: COLOR.accent }}
              />
            </AreaChart>
          </ResponsiveContainer>
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
