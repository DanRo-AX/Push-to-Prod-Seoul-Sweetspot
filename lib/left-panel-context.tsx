"use client";

// lib/left-panel-context.tsx — 중앙(보드)에서 좌 패널을 전환하기 위한 얇은 컨텍스트.
//
// 보드 산출물 카드에서 '페르소나와 논의'를 누르면 코멘트가 채팅 피드로 스트리밍된다.
// 그런데 채팅은 탐색기 뒤에 숨어 있을 수 있어 — 논의를 시작하면 채팅을 다시 보여줘야
// 사용자가 대화를 본다. IDEShell 이 showChat 을 제공하고, 카드가 호출한다.
// 기본값은 no-op 이라 셸 밖(테스트 등)에서도 안전하다.

import { createContext, useContext, type ReactNode } from "react";

interface LeftPanelValue {
  /** 좌 패널을 채팅으로 전환하고 펼친다. */
  showChat: () => void;
}

const Ctx = createContext<LeftPanelValue>({ showChat: () => {} });

export function LeftPanelProvider({
  value,
  children,
}: {
  value: LeftPanelValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLeftPanel(): LeftPanelValue {
  return useContext(Ctx);
}
