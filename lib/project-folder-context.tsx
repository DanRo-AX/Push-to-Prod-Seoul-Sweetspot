"use client";

// lib/project-folder-context.tsx — 현재 열린 작업 폴더 핸들을 앱 전역에 공유.
//
// 탐색기(FolderPanel)가 폴더를 열거나 '폴더에 저장'으로 구체화하면 여기에 핸들을 올린다.
// 카드 섹션(예: 기획안 개선 루프)이 채택본을 `{라벨}.octopus.md` 로 바로 내보낼 때
// 이 핸들을 쓴다 — 사람 입력 파일은 절대 건드리지 않고 octopus 출력만 쓴다.
//   · 폴더가 없으면(채팅 우선 메모리 보드) writeOutput 은 false 반환 → 호출측이 안내.

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { writeTextFileToDir } from "@/lib/fs-access";

interface ProjectFolderValue {
  /** 현재 작업 폴더 이름(없으면 null). */
  folderName: string | null;
  /** 폴더 열림 여부. */
  hasFolder: boolean;
  /** 탐색기가 호출 — 현재 폴더 핸들 등록(없으면 null 로 해제). */
  setFolder: (dir: FileSystemDirectoryHandle | null) => void;
  /** 산출물 파일 쓰기. 폴더 없으면 false. */
  writeOutput: (filename: string, text: string) => Promise<boolean>;
}

const Ctx = createContext<ProjectFolderValue | null>(null);

export function ProjectFolderProvider({ children }: { children: ReactNode }) {
  const dirRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);

  const setFolder = useCallback((dir: FileSystemDirectoryHandle | null) => {
    dirRef.current = dir;
    setFolderName(dir?.name ?? null);
  }, []);

  const writeOutput = useCallback(async (filename: string, text: string) => {
    if (!dirRef.current) return false;
    await writeTextFileToDir(dirRef.current, filename, text);
    return true;
  }, []);

  return (
    <Ctx.Provider value={{ folderName, hasFolder: folderName != null, setFolder, writeOutput }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProjectFolder(): ProjectFolderValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjectFolder 는 ProjectFolderProvider 내부에서만");
  return ctx;
}
