"use client";

// D+1/D+7 성과 섹션 — 요약 스탯 밴드(저장률 큰 숫자) + 게시물별 비교(ContentPerformance 재사용).
// report 가 null 이면 로딩 스켈레톤.

import type { ContentPerformanceReport } from "@/lib/types";
import { ContentPerformance } from "@/components/artifacts/ContentPerformance";

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="anim-shimmer h-[88px] rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)]"
          />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="anim-shimmer h-[140px] rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)]"
        />
      ))}
    </div>
  );
}

export function PerformanceSection({
  report,
}: {
  report: ContentPerformanceReport | null;
}) {
  if (report === null) return <Skeleton />;

  // 요약 스탯 — 최신 스냅샷(D+7 우선, 미집계는 D+1) 합산
  const snapshots = report.posts.map((p) => p.metricsD7 ?? p.metricsD1);
  const totalReach = snapshots.reduce((acc, m) => acc + m.reach, 0);
  const totalSaves = snapshots.reduce((acc, m) => acc + m.saves, 0);
  const bestSaveRate = report.posts.reduce<number | null>(
    (best, p) =>
      p.saveRateD7 !== null && (best === null || p.saveRateD7 > best)
        ? p.saveRateD7
        : best,
    null,
  );

  const stats = [
    {
      label: "최고 저장률 (D+7)",
      value: bestSaveRate !== null ? `${bestSaveRate}%` : "—",
      accent: true,
    },
    { label: "누적 도달", value: totalReach.toLocaleString(), accent: false },
    { label: "누적 저장", value: totalSaves.toLocaleString(), accent: false },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 스탯 밴드 — 큰 숫자 3개 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="anim-rise rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)] px-4 py-3.5"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div
              className={`num text-[30px] font-bold leading-tight ${
                s.accent ? "text-[var(--accent)]" : "text-[var(--text-1)]"
              }`}
            >
              {s.value}
            </div>
            <div className="mt-0.5 text-[12px] text-[var(--text-3)]">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* 게시물별 D+1/D+7 비교 + TOP 배지 + topPattern 콜아웃 — 아티팩트 렌더러 재사용 */}
      <ContentPerformance report={report} />
    </div>
  );
}
