"use client";

// 채널 볼륨 카드 — 주차별 활동량(콘텐츠 발행 · 아웃바운드 발송) 그룹 바 차트.
// "에이전트가 매주 얼마나 움직였나"를 산출량 관점에서 보여준다.

import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
  CURSOR_FILL,
  GRID_STROKE,
  LEGEND_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from "@/components/dashboard/chart-theme";

export interface ChannelVolumeCardProps {
  metrics: MetricsTimeline;
  liveVersion?: number;
  className?: string;
}

export function ChannelVolumeCard({
  metrics,
  liveVersion = 0,
  className,
}: ChannelVolumeCardProps) {
  const weeks = metrics.weeks;
  const totalPosts = weeks.reduce((sum, w) => sum + w.posts, 0);
  const totalSent = weeks.reduce((sum, w) => sum + w.outboundSent, 0);

  return (
    <DashCard
      eyebrow="VOLUME"
      title="채널 활동량"
      meta={`발행 ${totalPosts.toLocaleString()} · 발송 ${totalSent.toLocaleString()}`}
      liveVersion={liveVersion}
      className={className}
    >
      {weeks.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-3)]">
          아직 집계된 활동량이 없습니다.
        </div>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={weeks}
              margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="week" tick={AXIS_TICK} stroke={GRID_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} allowDecimals={false} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                cursor={{ fill: CURSOR_FILL }}
              />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Bar
                dataKey="posts"
                name="콘텐츠 발행"
                fill={COLOR.accent}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="outboundSent"
                name="아웃바운드 발송"
                fill={COLOR.ink}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashCard>
  );
}
