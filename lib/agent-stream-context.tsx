"use client";

// 에이전트 스트림 공유 컨텍스트.
// 앱 셸 레이아웃(app/(app)/layout.tsx)이 AgentStreamProvider 로 감싸면
// useAgentStream() 상태(이벤트·아티팩트·승인·SSE 스트림)가 페이지 이동에도 유지된다.
// lib/useAgentStream.ts 자체는 수정하지 않고 그대로 한 번만 호출해 공유한다.

import { createContext, useContext, type ReactNode } from "react";
import { useAgentStream, type UseAgentStreamResult } from "@/lib/useAgentStream";

const AgentStreamContext = createContext<UseAgentStreamResult | null>(null);

export function AgentStreamProvider({ children }: { children: ReactNode }) {
  const stream = useAgentStream();
  return (
    <AgentStreamContext.Provider value={stream}>
      {children}
    </AgentStreamContext.Provider>
  );
}

export function useAgentStreamContext(): UseAgentStreamResult {
  const ctx = useContext(AgentStreamContext);
  if (ctx === null) {
    throw new Error(
      "useAgentStreamContext 는 AgentStreamProvider 내부에서만 사용할 수 있습니다 — app/(app)/layout.tsx 가 Provider 로 감싸고 있는지 확인하세요.",
    );
  }
  return ctx;
}
