"use client";

// lib/active-card-context.tsx — 보드에서 '지금 보고 있는 산출물 카드'의 슬롯을 공유한다.
//
// 카드를 클릭하면 그 카드의 워크플로 슬롯(rfp/proposal/quote)이 active 가 되고, 우측 패널
// 검토팀이 그 슬롯 담당(personasForSlot)을 하이라이트한다. 즉 "이 문서엔 이 팀원들" 을
// 카드 안 목록이 아니라 우측 팀에서 보여준다. 기본 no-op 으로 셸 밖에서도 안전.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ActiveCardValue {
  activeSlot: string | null;
  setActiveSlot: (slot: string | null) => void;
}

const Ctx = createContext<ActiveCardValue>({ activeSlot: null, setActiveSlot: () => {} });

export function ActiveCardProvider({ children }: { children: ReactNode }) {
  const [activeSlot, setSlot] = useState<string | null>(null);
  const setActiveSlot = useCallback((slot: string | null) => setSlot(slot), []);
  return <Ctx.Provider value={{ activeSlot, setActiveSlot }}>{children}</Ctx.Provider>;
}

export function useActiveCard(): ActiveCardValue {
  return useContext(Ctx);
}
