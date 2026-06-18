"use client";

// lib/def-editor-context.tsx — 정의 에디터(중앙 탭)가 무엇을 편집 중인가.
//
// 정의 패널(사이드바)에서 '워크플로 추가'나 카드 클릭 → 중앙에 DefinitionEditor 가 열린다
// (원문 열기와 같은 중앙-오버라이드 패턴). target.packId 필수, cardSlot 있으면 그 카드에 집중.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface DefEditorTarget {
  packId: string;
  cardSlot?: string;
}

interface DefEditorValue {
  target: DefEditorTarget | null;
  openPack: (packId: string) => void;
  openCard: (packId: string, cardSlot: string) => void;
  close: () => void;
}

const Ctx = createContext<DefEditorValue>({ target: null, openPack: () => {}, openCard: () => {}, close: () => {} });

export function DefEditorProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<DefEditorTarget | null>(null);
  const openPack = useCallback((packId: string) => setTarget({ packId }), []);
  const openCard = useCallback((packId: string, cardSlot: string) => setTarget({ packId, cardSlot }), []);
  const close = useCallback(() => setTarget(null), []);
  return <Ctx.Provider value={{ target, openPack, openCard, close }}>{children}</Ctx.Provider>;
}

export function useDefEditor(): DefEditorValue {
  return useContext(Ctx);
}
