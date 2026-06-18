// components/ide/fileIcons.tsx — 확장자/뷰 → 실제 codicon 글리프 이름 매핑.
//
// VS Code 탭/탐색기 행은 파일 종류별 아이콘을 보여 준다. 새 의존성 없이
// 이미 설치된 @vscode/codicons(public/codicon.ttf + import 된 codicon.css)의
// 실제 글리프 클래스명을 그대로 쓴다(.codicon.codicon-<name>).
//
// 규칙:
//  · 색은 토큰(var(--ide-*))으로만. 여기서는 글리프 "이름"과 틴트 토큰만 고른다.
//  · 이 모듈은 순수(JSX 최소) — EditorArea/ExplorerView 가 공유해 탭/트리 아이콘을
//    동일하게 그린다(불일치 방지).

import type { IdeIconKey } from "@/lib/ide/views";

/** 파일명에서 확장자(소문자, 점 제외)를 뽑는다. */
function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/**
 * 확장자별 codicon 이름 + 틴트 토큰.
 *   · md/mdx  → codicon-markdown (그린 틴트)
 *   · json    → codicon-json (앰버 틴트)
 *   · ts/tsx  → codicon-file-code (인포 블루 틴트)
 *   · csv     → codicon-graph-line (그린 틴트)
 *   · 기타    → codicon-file (흐린 틴트)
 * VS Code 처럼 파일 종류가 한눈에 구분되게 한다.
 */
export function fileCodicon(filename: string): {
  name: string;
  tint: string;
} {
  switch (extOf(filename)) {
    case "md":
    case "mdx":
      return { name: "markdown", tint: "var(--ide-ok)" };
    case "json":
      return { name: "json", tint: "var(--ide-warn)" };
    case "ts":
    case "tsx":
      return { name: "file-code", tint: "var(--ide-info)" };
    case "csv":
      return { name: "graph-line", tint: "var(--ide-ok-fg)" };
    default:
      return { name: "file", tint: "var(--ide-text-dim)" };
  }
}

/** 뷰 탭 아이콘 키 → codicon 이름(대시보드/콘텐츠/아웃바운드/설정/웰컴). */
export function viewCodicon(icon: IdeIconKey): string {
  switch (icon) {
    case "workflow":
      return "list-tree";
    case "dashboard":
      return "graph";
    case "content":
      return "device-camera";
    case "outbound":
      return "send";
    case "settings":
      return "settings-gear";
    case "welcome":
      return "star-empty";
    case "file":
    default:
      return "file";
  }
}

/**
 * 작은 codicon 글리프 — 탭/트리/브레드크럼 공용 16px 슬롯.
 * 색을 직접 줄 수도 있고(틴트), 안 주면 부모 color 를 따른다.
 */
export function Codicon({
  name,
  tint,
  className,
  title,
}: {
  name: string;
  tint?: string;
  className?: string;
  title?: string;
}) {
  return (
    <i
      className={`codicon codicon-${name}${className ? ` ${className}` : ""}`}
      style={tint ? { color: tint } : undefined}
      aria-hidden="true"
      title={title}
    />
  );
}
