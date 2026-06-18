"use client";

// lib/ide/workflow-store.tsx — 워크플로 팩의 '가변 저장소'(런타임 상태 + 파일 영속화).
//
// WORKFLOW_PACKS(정적 시드)를 상태로 올려, 정의 에디터의 추가/편집이 picker·정의패널·선택에
// 즉시 반영되게 한다. 마운트 시 data/workflow-packs.json 을 불러오고(있으면), 변경 시 디바운스
// 저장한다(/api/workflow-packs). 파일 없으면 시드 사용.

import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { WORKFLOW_PACKS, type WorkflowPack } from "@/lib/ide/workflow-packs";
import type { CardSpec } from "@/lib/ide/card-spec";
import type { PackSlot } from "@/lib/ide/workflow-packs";

interface WorkflowStoreValue {
  packs: WorkflowPack[];
  getPack: (id: string) => WorkflowPack | undefined;
  addPack: () => string;
  updatePackMeta: (id: string, patch: Partial<Pick<WorkflowPack, "label" | "description" | "available">>) => void;
  addCard: (packId: string, slot: string) => void;
  updateCard: (packId: string, slot: string, patch: Partial<CardSpec>) => void;
  removeCard: (packId: string, slot: string) => void;
  addSlot: (packId: string) => void;
  updateSlot: (packId: string, slotId: string, patch: Partial<PackSlot>) => void;
  removeSlot: (packId: string, slotId: string) => void;
}

const Ctx = createContext<WorkflowStoreValue | null>(null);

function seed(): WorkflowPack[] {
  return WORKFLOW_PACKS.map((p) => ({ ...p, slots: p.slots.map((s) => ({ ...s })), cards: p.cards.map((c) => ({ ...c })) }));
}

export function WorkflowStoreProvider({ children }: { children: ReactNode }) {
  const [packs, setPacks] = useState<WorkflowPack[]>(seed);
  const seq = useRef(1);
  const loaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 마운트 시 저장본 로드(있으면 시드 대체).
  useEffect(() => {
    let alive = true;
    fetch("/api/workflow-packs")
      .then((r) => r.json())
      .then((d: { packs?: WorkflowPack[] | null }) => {
        if (alive && Array.isArray(d.packs) && d.packs.length > 0) setPacks(d.packs);
      })
      .catch(() => {})
      .finally(() => { loaded.current = true; });
    return () => { alive = false; };
  }, []);

  // 변경 시 디바운스 저장(초기 로드 전엔 저장 안 함 — 시드로 덮어쓰기 방지).
  useEffect(() => {
    if (!loaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch("/api/workflow-packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packs }),
      }).catch(() => {});
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [packs]);

  const getPack = useCallback((id: string) => packs.find((p) => p.id === id), [packs]);

  const addPack = useCallback(() => {
    const id = `pack-${seq.current++}`;
    setPacks((ps) => [...ps, { id, label: "새 워크플로", description: "설명을 입력하세요", available: true, shape: "loop" as const, slots: [], cards: [] }]);
    return id;
  }, []);

  const updatePackMeta: WorkflowStoreValue["updatePackMeta"] = useCallback((id, patch) => {
    setPacks((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const addCard = useCallback((packId: string, slot: string) => {
    setPacks((ps) => ps.map((p) => {
      if (p.id !== packId || p.cards.some((c) => c.slot === slot)) return p;
      const card: CardSpec = { slot, source: "bound_file", header: { title: slot, icon: "file" }, sections: ["raw_open", "review_points"] };
      return { ...p, cards: [...p.cards, card] };
    }));
  }, []);

  const updateCard: WorkflowStoreValue["updateCard"] = useCallback((packId, slot, patch) => {
    setPacks((ps) => ps.map((p) =>
      p.id !== packId ? p : { ...p, cards: p.cards.map((c) => (c.slot === slot ? { ...c, ...patch } : c)) },
    ));
  }, []);

  const removeCard = useCallback((packId: string, slot: string) => {
    setPacks((ps) => ps.map((p) => (p.id !== packId ? p : { ...p, cards: p.cards.filter((c) => c.slot !== slot) })));
  }, []);

  const addSlot = useCallback((packId: string) => {
    setPacks((ps) => ps.map((p) => {
      if (p.id !== packId) return p;
      // 빈 슬롯 번호 충돌 회피.
      let n = p.slots.length + 1;
      while (p.slots.some((s) => s.id === `slot-${n}`)) n++;
      const id = `slot-${n}`;
      const order = p.slots.length + 1;
      // 슬롯 추가 = 그 단계 카드도 함께(슬롯 ⇒ 카드 1:1 기본). 필요 없으면 카드만 삭제 가능.
      const card: CardSpec = { slot: id, source: "bound_file", header: { title: "새 단계", icon: "file" }, sections: ["raw_open", "review_points"] };
      return { ...p, slots: [...p.slots, { id, label: "새 단계", order, hint: "" }], cards: [...p.cards, card] };
    }));
  }, []);

  const updateSlot: WorkflowStoreValue["updateSlot"] = useCallback((packId, slotId, patch) => {
    setPacks((ps) => ps.map((p) =>
      p.id !== packId ? p : { ...p, slots: p.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)) },
    ));
  }, []);

  const removeSlot = useCallback((packId: string, slotId: string) => {
    // 슬롯 삭제 = 그 카드도 삭제(슬롯 ⇒ 카드 연동).
    setPacks((ps) => ps.map((p) => (p.id !== packId ? p
      : { ...p, slots: p.slots.filter((s) => s.id !== slotId), cards: p.cards.filter((c) => c.slot !== slotId) })));
  }, []);

  return (
    <Ctx.Provider value={{ packs, getPack, addPack, updatePackMeta, addCard, updateCard, removeCard, addSlot, updateSlot, removeSlot }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorkflowStore(): WorkflowStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkflowStore 는 WorkflowStoreProvider 내부에서만 사용");
  return ctx;
}
