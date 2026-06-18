"use client";

// lib/active-workflow-context.tsx — 지금 이 프로젝트(폴더)에 적용된 '워크플로 팩'.
//
// 프로젝트 = 폴더 + 워크플로. 탐색기 상단에서 워크플로를 고르면 그 팩의 슬롯·카드가 적용된다.
// 팩 목록·정의는 WorkflowStore(가변)에서 읽어, 정의 에디터의 추가/편집이 선택지에 반영된다.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { type WorkflowPack } from "@/lib/ide/workflow-packs";
import { useWorkflowStore } from "@/lib/ide/workflow-store";
import { cardSpecForSlot, type CardSpec } from "@/lib/ide/card-spec";

interface ActiveWorkflowValue {
  pack: WorkflowPack | null;  // null = 선택 안함(전체 카드 카탈로그)
  packId: string;             // "" = 선택 안함
  setPackId: (id: string) => void;
}

export const NO_WORKFLOW = "";

// 기본값 = 워크플로 없음. 사용자가 워크플로를 고르면 그때 그 하네스의 빈 카드가 보드에 깔린다.
const Ctx = createContext<ActiveWorkflowValue>({
  pack: null,
  packId: NO_WORKFLOW,
  setPackId: () => {},
});

export function ActiveWorkflowProvider({ children }: { children: ReactNode }) {
  const { getPack } = useWorkflowStore();
  const [packId, setId] = useState<string>(NO_WORKFLOW);
  const pack = packId === NO_WORKFLOW ? null : getPack(packId) ?? null;
  const setPackId = useCallback((id: string) => setId(id), []);
  return <Ctx.Provider value={{ pack, packId, setPackId }}>{children}</Ctx.Provider>;
}

export function useActiveWorkflow(): ActiveWorkflowValue {
  return useContext(Ctx);
}

// 라이브 카드용 — 전역 카드 카탈로그에서 조회(reframe: 카드는 워크플로 종속 아님 = 재사용).
// 같은 카드는 어느 보드·어느 활성 팩에서든 같은 스펙으로 렌더된다.
export function useCardSpec(slot: string): CardSpec | undefined {
  return cardSpecForSlot(slot);
}
