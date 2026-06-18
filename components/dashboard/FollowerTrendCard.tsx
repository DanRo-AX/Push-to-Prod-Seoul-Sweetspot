"use client";

// 팔로워 성장 영역차트 — 대시보드 메인 그리드의 중심 위젯.
// 주차별 팔로워·뉴스레터 구독 추이 (recharts AreaChart) + note 정직성 라벨.

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
import type { MetricsTimeline } from "@/lib/types";
import { DashCard } from "@/components/dashboard/DashCard";
import {
  AXIS_TICK,
  COLOR,
  GRID_STROKE,
  LEGEND_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from "@/components/dashboard/chart-theme";

export interface FollowerTrendCardProps {
  metrics: MetricsTimeline;
  liveVersion?: number;
  className?: string;
}

export function FollowerTrendCard({
  metrics,
  liveVersion = 0,
  className,
}: FollowerTrendCardProps) {
  const weeks = metrics.weeks;
  const range =
    weeks.length > 0 ? `${weeks[0].week} → ${weeks[weeks.length - 1].week}` : "";

  return (
    <DashCard
      eyebrow="GROWTH"
      title="팔로워 · 구독자 성장"
      meta={range}
      liveVersion={liveVersion}
      note={metrics.note}
      className={className}
    >
      {weeks.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-3)]">
          아직 집계된 지표가 없습니다.
        </div>
      ) : (
        <div className="h-full min-h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={weeks}
              margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
            >
              <defs>
                {/* 팔로워 = 버밀리언 액센트(핵심 계열), 구독 = 딥그린 */}
                <linearGradient id="dash-followers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.accent} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={COLOR.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dash-subs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.ok} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={COLOR.ok} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="week" tick={AXIS_TICK} stroke={GRID_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
              />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Area
                type="monotone"
                dataKey="followers"
                name="팔로워"
                stroke={COLOR.accent}
                strokeWidth={2.5}
                fill="url(#dash-followers)"
                dot={{ r: 3.5, fill: COLOR.accent }}
              />
              <Area
                type="monotone"
                dataKey="newsletterSubs"
                name="뉴스레터 구독"
                stroke={COLOR.ok}
                strokeWidth={2.5}
                fill="url(#dash-subs)"
                dot={{ r: 3.5, fill: COLOR.ok }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashCard>
  );
}
