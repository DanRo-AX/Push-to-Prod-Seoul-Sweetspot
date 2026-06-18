"use client";

// lib/board-docs-context.tsx — 워크플로 폴더에서 '문서타입 지정(슬롯 바인딩)'한 문서를
// 작업 보드(중앙 에디터 홈)에 산출물 카드로 띄우기 위한 공유 상태.
//
// 워크플로 폴더(WorkflowView)가 파일을 슬롯에 지정하면 bindDoc 으로 등록 → 작업 보드
// (EditorArea)가 읽어 산출물 카드로 렌더. 파일 핸들은 들고 다니지 않고 표시 메타만.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface BoundDoc {
  slotId: string;         // 문서타입 슬롯 id(워크플로 팩마다 다름 — 문자열)
  name: string;           // 파일명
  ext: string;            // 확장자
  // 보드 카드에서 '페르소나와 논의'를 누를 때 원본 파일을 읽기 위한 핸들(클라이언트 전용,
  // 직렬화 안 함). 폴더에서 지정한 파일 그대로 — 다시 고르지 않아도 논의 가능.
  handle?: FileSystemFileHandle;
}

interface BoardDocsValue {
  docs: BoundDoc[];
  bindDoc: (doc: BoundDoc) => void;
  clearDoc: (slotId: string) => void;
}

const Ctx = createContext<BoardDocsValue | null>(null);

export function BoardDocsProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<BoundDoc[]>([]);

  const bindDoc = useCallback((doc: BoundDoc) => {
    setDocs((prev) => [...prev.filter((d) => d.slotId !== doc.slotId), doc]);
  }, []);

  const clearDoc = useCallback((slotId: string) => {
    setDocs((prev) => prev.filter((d) => d.slotId !== slotId));
  }, []);

  return <Ctx.Provider value={{ docs, bindDoc, clearDoc }}>{children}</Ctx.Provider>;
}

export function useBoardDocs(): BoardDocsValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useBoardDocs 는 BoardDocsProvider 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
}
