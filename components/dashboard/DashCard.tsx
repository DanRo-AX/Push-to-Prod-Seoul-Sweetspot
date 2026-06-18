"use client";

// 대시보드 공용 카드 셸 — 모노 eyebrow + 한국어 타이틀 + 우측 메타/LIVE 칩 + 정직성 라벨 푸터.
// liveVersion 이 0보다 크면(라이브 아티팩트 반영) key 리마운트로 anim-flash-ok 1회 발광.

import type { ReactNode } from "react";

const MONO = "font-[family-name:var(--font-geist-mono)]";

export interface DashCardProps {
  eyebrow: string;        // 모노 섹션 라벨 (예: "GROWTH")
  title: string;          // 한국어 타이틀
  meta?: string;          // 우측 모노 메타 텍스트
  /** 라이브 아티팩트 반영 횟수 — 0 = 베이스라인, 1+ = 라이브(갱신 시 발광) */
  liveVersion?: number;
  note?: string;          // 정직성 라벨 (푸터)
  className?: string;
  children: ReactNode;
}

export function DashCard({
  eyebrow,
  title,
  meta,
  liveVersion = 0,
  note,
  className = "",
  children,
}: DashCardProps) {
  const live = liveVersion > 0;
  return (
    <div
      // 라이브 갱신마다 key 변경 → 리마운트로 anim-flash-ok 재생
      key={`v${liveVersion}`}
      className={`surface-raised flex h-full min-w-0 flex-col rounded-2xl border border-[var(--line-1)] bg-[var(--bg-1)] ${
        live ? "anim-flash-ok" : ""
      } ${className}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--line-1)] px-5 py-4">
        <div className="min-w-0">
          <p
            className={`${MONO} text-[10px] font-semibold tracking-[0.18em] text-[var(--text-3)]`}
          >
            {eyebrow}
          </p>
          <h2 className="mt-1 truncate text-[17px] font-bold text-[var(--text-1)]">
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {live && (
            <span
              className={`flex items-center gap-1.5 rounded-full border border-[var(--ok)]/40 bg-[var(--ok-dim)] px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-[var(--ok)] ${MONO}`}
            >
              <span className="anim-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
              LIVE
            </span>
          )}
          {meta && (
            <span className={`${MONO} text-[11px] text-[var(--text-3)]`}>
              {meta}
            </span>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 p-5">{children}</div>

      {note && (
        <div className="border-t border-[var(--line-1)] px-5 py-2.5">
          <span className={`${MONO} text-[11px] font-medium text-[var(--warn)]`}>
            ⓘ 데이터 기준: {note}
          </span>
        </div>
      )}
    </div>
  );
}
