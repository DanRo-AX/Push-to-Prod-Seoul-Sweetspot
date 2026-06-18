"use client";

// 상단 KPI 스트립 — 최신 주차 핵심 지표 4개.
// 큰 숫자(카운트업) + 전주 대비 델타 배지 + 주차 추이 미니 스파크라인(인라인 SVG).

import type { MetricsTimeline, WeeklyMetric } from "@/lib/types";
import { CountUp } from "@/components/dashboard/CountUp";

const MONO = "font-[family-name:var(--font-geist-mono)]";

// 델타 화살표 — 인라인 SVG 삼각형 (이모지 금지)
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

// 주차 추이 미니 스파크라인 — 카드 하단 보조 시각화 (recharts 없이 가벼운 SVG)
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const W = 120;
  const H = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - 3 - ((v - min) / span) * (H - 6);
    return [x, y] as const;
  });
  const points = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-7 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

interface KpiDef {
  label: string;
  pick: (w: WeeklyMetric) => number;
  color: string; // 스파크라인 색 (globals.css 토큰 리터럴 미러 — 순백 미니멀)
}

// 스파크라인 색 — 단일 액센트 원칙에 맞춰 미니멀 4색으로 구분.
// 버밀리언(--accent #d9472a)은 핵심 지표(팔로워) 1개에만, 나머지는 딥그린·오커·중립잉크.
const KPI_DEFS: KpiDef[] = [
  { label: "팔로워", pick: (w) => w.followers, color: "#d9472a" }, // --accent
  { label: "뉴스레터 구독", pick: (w) => w.newsletterSubs, color: "#2f8f57" }, // --ok
  { label: "아웃바운드 회신", pick: (w) => w.outboundReplies, color: "#b8791f" }, // --warn
  { label: "미팅 성사", pick: (w) => w.meetings, color: "#5d5d5d" }, // --text-2 (중립 잉크)
];

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="rounded-[4px] bg-[var(--bg-3)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-3)]">
        ±0
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      // 값이 바뀔 때 anim-tick 재생 — key 리마운트 트리거
      key={delta}
      className={`anim-tick inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold ${
        up
          ? "bg-[var(--ok-dim)] text-[var(--ok)]"
          : "bg-[var(--danger-dim)] text-[var(--danger)]"
      }`}
    >
      <DeltaArrow up={up} />
      <span className="num">
        {up ? "+" : "−"}
        {Math.abs(delta).toLocaleString()}
      </span>
    </span>
  );
}

export interface KpiStripProps {
  metrics: MetricsTimeline;
  /** 라이브 아티팩트 반영 횟수 — 0 = 베이스라인, 1+ 변경 시 카드 발광 */
  liveVersion?: number;
}

export function KpiStrip({ metrics, liveVersion = 0 }: KpiStripProps) {
  const weeks = metrics.weeks;
  if (weeks.length === 0) return null;

  const latest = weeks[weeks.length - 1];
  const prev = weeks.length > 1 ? weeks[weeks.length - 2] : latest;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {KPI_DEFS.map((def) => {
        const value = def.pick(latest);
        const delta = value - def.pick(prev);
        const series = weeks.map(def.pick);
        return (
          <div
            // 라이브 갱신 시 리마운트 → anim-flash-ok 1회 발광
            key={`${def.label}-v${liveVersion}`}
            className={`surface-raised rounded-2xl border border-[var(--line-1)] bg-[var(--bg-1)] p-5 transition-colors hover:border-[var(--line-2)] ${
              liveVersion > 0 ? "anim-flash-ok" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`${MONO} text-[11px] font-semibold tracking-[0.18em] text-[var(--text-3)]`}
              >
                {def.label}
              </span>
              <DeltaBadge delta={delta} />
            </div>
            <div className="num mt-2 text-[34px] font-bold leading-none text-[var(--text-1)]">
              <CountUp value={value} />
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <span className="shrink-0 text-[11px] font-medium text-[var(--text-3)]">
                {prev === latest ? "단일 주차" : `전주(${prev.week}) 대비`}
              </span>
              <div className="w-[120px] max-w-[45%]">
                <Sparkline values={series} color={def.color} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
