"use client";

// 대시보드 로딩 스켈레톤 — 실제 레이아웃(KPI 4 + 메인 그리드 4)을 그대로 미러링한 시머 블록.
// anim-shimmer 는 prefers-reduced-motion 에서 자동 비활성화된다 (globals.css).

function Block({ className = "" }: { className?: string }) {
  return (
    <div
      className={`anim-shimmer rounded-2xl border border-[var(--line-1)] bg-[var(--bg-1)] ${className}`}
      aria-hidden="true"
    >
      {/* 카드 헤더 자리 — 내부 톤 변화로 '빈 카드'가 아니라 '로딩 중'으로 읽히게 */}
      <div className="border-b border-[var(--line-1)] px-5 py-4">
        <div className="h-2.5 w-16 rounded-full bg-[var(--bg-3)]" />
        <div className="mt-2 h-4 w-32 rounded-full bg-[var(--bg-3)]" />
      </div>
    </div>
  );
}

function KpiBlock() {
  return (
    <div
      className="anim-shimmer rounded-2xl border border-[var(--line-1)] bg-[var(--bg-1)] p-5"
      aria-hidden="true"
    >
      <div className="h-2.5 w-20 rounded-full bg-[var(--bg-3)]" />
      <div className="mt-3 h-8 w-24 rounded-[6px] bg-[var(--bg-3)]" />
      <div className="mt-3 h-2.5 w-28 rounded-full bg-[var(--bg-3)]" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="대시보드 로딩 중">
      {/* KPI 스트립 자리 */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiBlock />
        <KpiBlock />
        <KpiBlock />
        <KpiBlock />
      </div>
      {/* 메인 그리드 자리 */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Block className="h-[360px] xl:col-span-7" />
        <Block className="h-[360px] xl:col-span-5" />
        <Block className="h-[340px] xl:col-span-7" />
        <Block className="h-[340px] xl:col-span-5" />
      </div>
    </div>
  );
}
