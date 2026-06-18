"use client";

// components/ide/views/ViewChrome.tsx — IDE 뷰 공용 크롬/원자.
//
// 대시보드/콘텐츠/아웃바운드/설정 뷰가 공유하는 VS Code 에디터/뷰 idiom 골격을 모은다.
//   · ViewChrome  — 뷰 상단 .ide-viewbar(제목+codicon 액션) + 스크롤 본문 컨테이너.
//   · ViewSection — .ide-section(11px 대문자 헤더 + 보더) 한 묶음.
//   · Pill        — .ide-pill 상태 칩(톤 변형).
//   · IconBtn     — .ide-icon-btn (뷰 툴바 액션 — refresh/filter 등).
//   · ViewEmpty / ViewSkeleton — 빈/로딩 상태(다크 톤).
//
// 스타일은 전부 globals.css 의 .ide 스코프 클래스(.ide-viewbar/.ide-section/.ide-pill …)에서만
// 가져온다(파일 무수정). 색은 var(--ide-*) 직접. 이모지 금지(codicon). prefers-reduced-motion
// 은 globals.css 의 공용 가드가 처리한다.

import type { ReactNode } from "react";

// ── 뷰 툴바 액션 버튼(아이콘만) — .ide-icon-btn 재사용. ──
export function IconBtn({
  icon,
  label,
  onClick,
  active,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className="ide-icon-btn"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <i className={`codicon codicon-${icon}`} aria-hidden />
    </button>
  );
}

// ── 상태 칩 — .ide-pill(+톤). ──
export function Pill({
  tone,
  icon,
  children,
}: {
  tone?: "accent" | "ok" | "warn" | "danger";
  icon?: string;
  children: ReactNode;
}) {
  const cls = tone ? `ide-pill ide-pill--${tone}` : "ide-pill";
  return (
    <span className={cls}>
      {icon && <i className={`codicon codicon-${icon}`} aria-hidden />}
      {children}
    </span>
  );
}

// ── 라이브 펄스 칩 — 실행/갱신 중 표시(.ide-pill--accent + 점). ──
export function LivePill({ label }: { label: string }) {
  return (
    <span className="ide-pill ide-pill--accent">
      <span
        className="persona-status-dot"
        style={{
          width: 6,
          height: 6,
          borderRadius: 9999,
          background: "#4ea0ff",
          display: "inline-block",
        }}
        aria-hidden
      />
      {label}
    </span>
  );
}

// ── 섹션 — .ide-section + 헤더(codicon + 대문자 라벨 + 우측 메타). ──
export function ViewSection({
  icon,
  title,
  meta,
  children,
}: {
  icon: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ide-section">
      <div className="ide-section-head">
        <i className={`codicon codicon-${icon}`} aria-hidden />
        <span>{title}</span>
        {meta != null && <span className="ide-section-meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

// ── 뷰 크롬 — 상단 툴바 + 스크롤 본문. ──
export function ViewChrome({
  icon,
  title,
  sub,
  actions,
  children,
}: {
  icon: string;
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ide-view-in flex h-full min-h-0 flex-col">
      {/* 뷰 상단 툴바 — 제목(아이콘+라벨) + 보조(경로/카운트) + 우측 액션. */}
      <div className="ide-viewbar">
        <span className="ide-viewbar-title">
          <i className={`codicon codicon-${icon}`} aria-hidden />
          {title}
        </span>
        {sub != null && <span className="ide-viewbar-sub">{sub}</span>}
        {actions != null && <span className="ide-viewbar-actions">{actions}</span>}
      </div>
      {/* 본문 — 섹션이 쌓이는 스크롤 영역. */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

// ── 빈/오류 상태 — 다크 톤 안내. ──
export function ViewEmpty({
  icon,
  title,
  hint,
}: {
  icon: string;
  title: string;
  hint?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
      style={{ color: "var(--ide-text-dim)" }}
    >
      <i
        className={`codicon codicon-${icon}`}
        aria-hidden
        style={{ fontSize: 28, color: "var(--ide-text-faint)" }}
      />
      <p style={{ fontSize: 13, color: "var(--ide-text)" }}>{title}</p>
      {hint && <p style={{ fontSize: 11.5 }}>{hint}</p>}
    </div>
  );
}

// ── 로딩 스켈레톤 — 섹션 골격 시머(다크). ──
export function ViewSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 84 : 120,
            borderRadius: 8,
            background: "var(--ide-elevated)",
            border: "1px solid var(--ide-border-strong)",
          }}
        />
      ))}
    </div>
  );
}
