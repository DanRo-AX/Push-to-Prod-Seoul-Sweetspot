"use client";

// lib/editor-doc-context.tsx — 산출물 카드에서 '원문 열기'를 누르면 중앙 에디터(EditorArea)가
// VS Code 탭처럼 문서 원문을 연다. 카드는 허브로 가볍게 두고, 긴 원문은 중앙 패널에서 읽는다.
//
// 카드(BtlBoundDocView)가 openDoc 으로 문서를 올리고, EditorArea 가 doc 을 읽어 풀패널로
// 렌더한다. 기본값 no-op 이라 셸 밖에서도 안전.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface EditorDoc {
  /** 탭/헤더에 표기할 파일명. */
  name: string;
  /** 원문(텍스트). */
  content: string;
  /** 확장자 소문자(점 제외) — 아이콘/언어 힌트. */
  ext: string;
}

interface EditorDocValue {
  doc: EditorDoc | null;
  openDoc: (doc: EditorDoc) => void;
  closeDoc: () => void;
}

const Ctx = createContext<EditorDocValue>({ doc: null, openDoc: () => {}, closeDoc: () => {} });

export function EditorDocProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<EditorDoc | null>(null);
  const openDoc = useCallback((d: EditorDoc) => setDoc(d), []);
  const closeDoc = useCallback(() => setDoc(null), []);
  return <Ctx.Provider value={{ doc, openDoc, closeDoc }}>{children}</Ctx.Provider>;
}

export function useEditorDoc(): EditorDocValue {
  return useContext(Ctx);
}
