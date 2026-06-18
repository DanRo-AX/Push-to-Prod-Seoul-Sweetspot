"use client";

// lib/use-workflow-loader.ts — '워크플로 로드' 공유 훅(워크플로 탭·채팅 컴포저가 같이 쓴다).
//
// 워크플로 선택 = 그 하네스의 필요한 빈 카드를 보드에 까는 것(없는 것만). 사람이 채우거나
// 오케스트레이터에게 시키면 그 위에서 진행된다. 포용성: 손(워크플로 탭)으로든 채팅으로든 같은 동작.

import { useCallback } from "react";
import { useWorkflowStore } from "@/lib/ide/workflow-store";
import { useActiveWorkflow, NO_WORKFLOW } from "@/lib/active-workflow-context";
import { useAgentStreamContext } from "@/lib/agent-stream-context";

export function useWorkflowLoader() {
  const { packs } = useWorkflowStore();
  const { packId, setPackId } = useActiveWorkflow();
  const ctx = useAgentStreamContext();

  const loadWorkflow = useCallback((id: string) => {
    setPackId(id);
    if (id === NO_WORKFLOW) return;
    const pack = packs.find((p) => p.id === id);
    if (!pack) return;
    for (const card of pack.cards) {
      const present = ctx.artifacts.some(
        (a) => ("slotId" in a && a.slotId === card.slot) || (card.slot === "rfp" && a.kind === "btl_rfp"),
      );
      if (!present) ctx.addArtifact({ kind: "btl_doc_file", slotId: card.slot, name: card.header.title, ext: "" });
    }
  }, [packs, setPackId, ctx]);

  return { packs, packId, loadWorkflow };
}
