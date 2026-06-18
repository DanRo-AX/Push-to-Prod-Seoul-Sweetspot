"use client";

// components/ide/IdeViewHost.tsx — IDE 에디터 탭 안에서 "페이지형 뷰"를 VS Code 다크로 렌더.
//
// 대시보드/콘텐츠/아웃바운드/설정은 흰 라우트(/dashboard …) 단독 페이지가 따로 있다.
// IDE 안에서는 같은 데이터/기능을 "VS Code 에디터/뷰 idiom"(뷰 툴바·섹션 구분선·리스트/
// 트리·키-값·칩)으로 다시 그린 전용 뷰 컴포넌트(components/ide/views/*)를 띄운다.
//   · 흰 페이지를 .ide-view 로 다크 리맵만 하던 단계를 넘어, 레이아웃/컴포넌트를 VS Code
//     어휘로 재구성한 별도 뷰를 쓴다 → IDE 내부는 정통 다크 VS Code, 흰 라우트는 무영향.
//   · 데이터/스트림 소스는 동일(useAgentStreamContext + /api/workspace · /api/settings) —
//     기능 100% 보존(SSE/승인/라이브 아티팩트 반영).
//
// 규칙: 새 의존성 금지. .ide-view 래퍼는 토큰 다크 리맵 + 탭 전환 1회 페이드를 유지한다.

import type { IdeViewKind } from "@/lib/ide/views";
import DashboardView from "@/components/ide/views/DashboardView";
import ContentView from "@/components/ide/views/ContentView";
import OutboundView from "@/components/ide/views/OutboundView";
import SettingsView from "@/components/ide/views/SettingsView";
import WorkflowView from "@/components/ide/views/WorkflowView";

/** IdeViewKind → VS Code 뷰 컴포넌트(welcome 은 EditorArea 가 따로 처리). */
const VIEW_COMPONENT: Record<
  Exclude<IdeViewKind, "welcome">,
  React.ComponentType
> = {
  workflow: WorkflowView,
  dashboard: DashboardView,
  content: ContentView,
  outbound: OutboundView,
  settings: SettingsView,
};

/**
 * 뷰 호스트 — 해당 종류의 VS Code 뷰 컴포넌트를 .ide-view 다크 스코프로 감싸 렌더.
 * 탭 전환 시 1회 페이드(.ide-view-in, reduced-motion 가드됨). 뷰는 자체 .ide-viewbar/
 * .ide-section 크롬을 들고 와 "IDE 패널"처럼 보인다.
 *
 * 톤 일관성(아티팩트 문서뷰의 .ide-doc 와의 관계):
 * - 아티팩트 미리보기는 EditorArea 에서 .ide-doc(에디터 면 #1f1f1f 기준 "문서" 스코프)로
 *   감싼다. 뷰(대시보드 등)는 여기서 .ide-view(사이드/패널 면 기준 "뷰" 스코프)를 쓴다.
 * - 둘 다 같은 VS Code Dark Modern 어휘(--bg/--text/--accent)지만 면 톤이 다르고, 토큰을
 *   각자 리맵한다. 그러므로 .ide-view 위에 .ide-doc 를 겹치지 않는다(중복 오버라이드 →
 *   토큰 충돌). .ide-view 한 겹이 단일 진실 — 뷰는 이미 정통 다크라 추가 래핑 불필요.
 */
export function IdeViewHost({ kind }: { kind: Exclude<IdeViewKind, "welcome"> }) {
  const View = VIEW_COMPONENT[kind];
  return (
    <div className="ide-view ide-view-in flex h-full min-h-0 flex-col" data-view={kind}>
      <View />
    </div>
  );
}
