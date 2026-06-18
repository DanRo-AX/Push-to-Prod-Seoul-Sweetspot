"use client";

// lib/use-card-drafter.ts — 'AI 초안으로 카드 채우기' 공유 훅(카드 버튼·오케스트레이터 공용).
//
// 카드 전용 로직 없음 — CardSpec.draftGuide 가 있는 카드면 무엇이든 RFP 기반 초안을 만들어
// 그 카드 내용으로 바인딩한다(파일 없이 텍스트 핸들). 초안은 before — 이후 군집이 깎고 사람이 확정.
//   · draftCard(slot)  — 한 카드 채우기.
//   · draftAll()       — 활성 워크플로의 비어있는 초안가능 카드 전부(기획안 먼저, 견적·운영은 참조).

import { useCallback, useState } from "react";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import { useBoardDocs } from "@/lib/board-docs-context";
import { useActiveWorkflow } from "@/lib/active-workflow-context";
import { cardSpecForSlot } from "@/lib/ide/card-spec";
import { artifactToMarkdown } from "@/lib/ide/export-md";
import { makeTextHandle } from "@/lib/fs-access";

// 초안 순서 — 상위 산출물 먼저(견적·운영이 기획안을 참조).
const DRAFT_ORDER: Record<string, number> = { proposal: 0, quote: 1, operation: 1 };

export function useCardDrafter() {
  const ctx = useAgentStreamContext();
  const { pack } = useActiveWorkflow();
  const { docs, bindDoc } = useBoardDocs();
  const [drafting, setDrafting] = useState<string | null>(null); // 작업 중 슬롯

  const rfpText = useCallback((): string | null => {
    const rfp = ctx.artifacts.find((a) => a.kind === "btl_rfp");
    if (!rfp) return null;
    return artifactToMarkdown(rfp)?.markdown ?? null;
  }, [ctx.artifacts]);

  const rfpId = useCallback((): string => {
    const rfp = ctx.artifacts.find((a) => a.kind === "btl_rfp");
    return rfp && rfp.kind === "btl_rfp" ? rfp.rfp.rfp_id : "";
  }, [ctx.artifacts]);

  // 이미 채워진 상위 산출물(바운드 텍스트)을 참고용으로 — 견적/운영이 기획안과 정렬되게.
  const gatherPriors = useCallback(async (selfSlot: string) => {
    const priors: { label: string; text: string }[] = [];
    for (const d of docs) {
      if (d.slotId === selfSlot || !d.handle) continue;
      try {
        const text = await (await d.handle.getFile()).text();
        priors.push({ label: cardSpecForSlot(d.slotId)?.header.title ?? d.slotId, text });
      } catch { /* skip */ }
    }
    return priors;
  }, [docs]);

  const draftCard = useCallback(async (slot: string): Promise<{ ok: boolean; error?: string }> => {
    const spec = cardSpecForSlot(slot);
    if (!spec?.draftGuide) return { ok: false, error: "이 카드는 AI 초안을 지원하지 않습니다." };
    const rfp = rfpText();
    // 콘텐츠 카드는 RFP 없이도 가능(브랜드 브리프 근거). 그 외(기획안·견적·운영)는 RFP 필요.
    if (!rfp && slot !== "content") return { ok: false, error: "먼저 RFP를 분석하세요(채팅 '첨부' 또는 RFP 카드)." };
    setDrafting(slot);
    const startedAt = Date.now();
    try {
      const priors = await gatherPriors(slot);
      const res = await fetch("/api/btl/draft-card", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, rfpText: rfp, rfpId: rfpId(), priors }),
      });
      const data = (await res.json()) as { markdown?: string; error?: string; cached?: boolean };
      if (!res.ok || !data.markdown) return { ok: false, error: data.error ?? "초안 생성 실패" };
      // 캐시 히트라 너무 빨리 끝나면 — LLM 돌 때와 같은 로딩을 최소 1초 보여주고 띄운다.
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
      const name = `${spec.header.title}.octopus.md`;
      bindDoc({ slotId: slot, name, ext: "md", handle: makeTextHandle(name, data.markdown) });
      return { ok: true };
    } catch {
      return { ok: false, error: "초안 생성 연결 실패" };
    } finally {
      setDrafting(null);
    }
  }, [rfpText, rfpId, gatherPriors, bindDoc]);

  // 활성 워크플로의 '초안가능 + 아직 안 채워진' 카드 전부를 순서대로.
  const draftAll = useCallback(async (): Promise<{ filled: string[]; error?: string }> => {
    if (!rfpText()) return { filled: [], error: "먼저 RFP를 분석하세요." };
    const cards = (pack?.cards ?? []).filter((c) => cardSpecForSlot(c.slot)?.draftGuide);
    const empty = cards.filter((c) => !docs.some((d) => d.slotId === c.slot && d.handle));
    empty.sort((a, b) => (DRAFT_ORDER[a.slot] ?? 9) - (DRAFT_ORDER[b.slot] ?? 9));
    const filled: string[] = [];
    for (const c of empty) {
      const r = await draftCard(c.slot);
      if (r.ok) filled.push(cardSpecForSlot(c.slot)?.header.title ?? c.slot);
    }
    return { filled };
  }, [pack, docs, rfpText, draftCard]);

  return { draftCard, draftAll, drafting };
}
