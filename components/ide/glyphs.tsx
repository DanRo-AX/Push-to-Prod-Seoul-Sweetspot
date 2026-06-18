// components/ide/glyphs.tsx — IDE 전용 인라인 SVG 글리프 모음.
//
// 새 의존성(아이콘 패키지) 금지 규칙에 따라 모든 아이콘은 인라인 SVG 로 그린다.
// stroke 계열은 currentColor 를 따르므로 .ide-* 클래스의 color 토큰으로 색이 결정된다.
// 24x24 뷰박스(액티비티바·탭 24px), 작은 곳은 16px(트리/상태바)로 클래스가 축소.

import type { ReactNode } from "react";

const STROKE = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

// ── 액티비티바 아이콘 (24px) ──────────────────────────────────────────

/** 챗 — 말풍선(Claude Code 대화). */
export function ChatIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path
        {...STROKE}
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5v-3.5H6.5A2.5 2.5 0 0 1 4 13.5z"
      />
    </Svg>
  );
}

/** 탐색기 — 파일 두 장. */
export function ExplorerIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path {...STROKE} d="M13 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8.5z" />
      <path {...STROKE} d="M13 3v5.5h5.5" />
    </Svg>
  );
}

/** 에이전트(페르소나) — 사람 두 명(멀티 에이전트). */
export function AgentsIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle {...STROKE} cx="9" cy="8" r="3" />
      <path {...STROKE} d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path {...STROKE} d="M16 5.2a3 3 0 0 1 0 5.6M17.5 13.6A5.5 5.5 0 0 1 20.5 18.5" />
    </Svg>
  );
}

/** 지표 — 막대 그래프. */
export function MetricsIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path {...STROKE} d="M4 20h16" />
      <path {...STROKE} d="M7 20v-6M12 20V8M17 20v-9" />
    </Svg>
  );
}

/** 설정 — 톱니(기어). */
export function SettingsIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle {...STROKE} cx="12" cy="12" r="3" />
      <path
        {...STROKE}
        d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"
      />
    </Svg>
  );
}

// ── 탭/트리 아이콘 (16px) ─────────────────────────────────────────────

/** 산출물(문서) 탭 아이콘. */
export function DocIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path {...STROKE} d="M13.5 3H7A1.5 1.5 0 0 0 5.5 4.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path {...STROKE} d="M13.5 3v5h5" />
      <path {...STROKE} d="M8.5 12.5h7M8.5 15.5h7M8.5 9.5h2.5" />
    </Svg>
  );
}

/** 작업뷰(웰컴) 탭 아이콘 — 별/스파크. */
export function WelcomeIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path {...STROKE} d="M12 3.5l1.9 4.8 4.8 1.9-4.8 1.9L12 16.9l-1.9-4.8-4.8-1.9 4.8-1.9z" />
    </Svg>
  );
}

/** 닫기(×) — 탭/패널. */
export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 폴더(열림/닫힘) — 탐색기 트리. */
export function FolderIcon({ open, className }: { open?: boolean; className?: string }) {
  return (
    <Svg className={className}>
      {open ? (
        <path {...STROKE} d="M4 19l1.8-7h14l-1.8 7zM4 19V6.5A1.5 1.5 0 0 1 5.5 5h4l2 2.5h6A1.5 1.5 0 0 1 19 9v3" />
      ) : (
        <path {...STROKE} d="M4 6.5A1.5 1.5 0 0 1 5.5 5h4l2 2.5h7A1.5 1.5 0 0 1 20 9v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      )}
    </Svg>
  );
}

/** 체브런(접기/펼치기) — 우향(닫힘) 기준, 사용처가 회전. */
export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 완료 체크 — 페르소나/터미널/탭 공용. */
export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M3.5 8.5L6.5 11.5 12.5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 재생(▶) — 골든런 리플레이. */
export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M5 3.5l8 4.5-8 4.5z" fill="currentColor" />
    </svg>
  );
}

/** 전송 화살표(↑) — 챗 컴포저. */
export function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M8 13 L8 4 M8 4 L4.5 7.5 M8 4 L11.5 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 분기(소스 컨트롤 풍) — 상태바 시나리오. */
export function BranchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <circle cx="4.5" cy="3.5" r="1.6" {...STROKE} />
      <circle cx="4.5" cy="12.5" r="1.6" {...STROKE} />
      <circle cx="11.5" cy="6" r="1.6" {...STROKE} />
      <path {...STROKE} d="M4.5 5.1v5.8M4.5 9c0-2.5 1.8-3 3-3" />
    </svg>
  );
}

/** 경고 삼각 — 상태바 승인 대기. */
export function WarnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path {...STROKE} d="M8 2.5l6 11H2zM8 6.5v3.2M8 11.6v.1" />
    </svg>
  );
}

/** 메일/발송 — 상태바·터미널. */
export function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1.2" {...STROKE} />
      <path {...STROKE} d="M2.5 4.5L8 8.5l5.5-4" />
    </svg>
  );
}

// ── 뷰 탭/액티비티 아이콘 (24px) — 대시보드/콘텐츠/아웃바운드 ──────────

/** 콘텐츠 — 카메라(인스타/콘텐츠 표면). TopNav 글리프와 동일 어휘. */
export function ContentIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect {...STROKE} x="4" y="4" width="16" height="16" rx="5" />
      <circle {...STROKE} cx="12" cy="12" r="3.4" />
      <circle cx="16.5" cy="7.5" r="1" fill="currentColor" />
    </Svg>
  );
}

/** 아웃바운드 — 종이비행기. TopNav 글리프와 동일 어휘. */
export function OutboundIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path {...STROKE} d="M20.5 4L3.5 11l6.5 2.2L12.5 20l3-7z" />
      <path {...STROKE} d="M10 13.2L20.5 4" />
    </Svg>
  );
}

/** 스튜디오 — 펜/편집. TopNav 글리프와 동일 어휘. */
export function StudioIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path {...STROKE} d="M5 19l1-4 9-9 3 3-9 9z" />
      <path {...STROKE} d="M13.5 6.5l3 3" />
    </Svg>
  );
}

// ── 소스/미리보기 토글 글리프 (16px) ─────────────────────────────────

/** 소스 — 코드 꺾쇠(< >). 에디터 [소스] 토글. */
export function SourceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M6 4.5L2.5 8 6 11.5M10 4.5L13.5 8 10 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 미리보기 — 눈(렌더 미리보기). 에디터 [미리보기] 토글. */
export function PreviewIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        {...STROKE}
        d="M1.5 8S3.8 3.8 8 3.8 14.5 8 14.5 8 12.2 12.2 8 12.2 1.5 8 1.5 8Z"
      />
      <circle cx="8" cy="8" r="2" {...STROKE} />
    </svg>
  );
}

// ── 아이콘 키 → 컴포넌트 매핑 (lib/ide/views.ts 의 IdeIconKey) ────────
// VIEW_META.icon (키) 를 받아 통일 탭에 SVG 를 그린다. 16px 슬롯 공용.
import type { IdeIconKey } from "@/lib/ide/views";

/** IdeIconKey → 인라인 SVG 매핑(탭/액티비티바 공용). */
export function IdeIcon({
  icon,
  className,
}: {
  icon: IdeIconKey;
  className?: string;
}) {
  switch (icon) {
    case "welcome":
      return <WelcomeIcon className={className} />;
    case "dashboard":
      return <MetricsIcon className={className} />;
    case "content":
      return <ContentIcon className={className} />;
    case "outbound":
      return <OutboundIcon className={className} />;
    case "settings":
      return <SettingsIcon className={className} />;
    case "file":
    default:
      return <DocIcon className={className} />;
  }
}
