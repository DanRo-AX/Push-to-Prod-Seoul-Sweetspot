"use client";

// lib/fs-access.ts — File System Access API 래퍼(브라우저 로컬 폴더 직접 접근).
// 디렉토리 사이드바가 실무자의 실제 폴더를 열어 트리로 보여주고, 슬롯에 지정된 파일을
// 읽어 중앙에 띄운다. Chrome/Edge 전용(showDirectoryPicker). 미지원 브라우저는 isSupported=false.
//
// 주의: 모든 접근은 사용자 제스처(폴더 열기 클릭)로 권한을 받는다. 자동 스캔/자동 표시 없음.

import { extOf } from "@/lib/ide/workflow";

// showDirectoryPicker 는 아직 lib.dom 표준 타입에 없을 수 있어 최소 선언을 둔다.
declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
  }
}

export interface FsNode {
  name: string;
  /** 루트 폴더 기준 상대 경로(예: "01_RFP/kmi.pdf") */
  path: string;
  kind: "file" | "dir";
  ext: string;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: FsNode[];
}

export function isFsAccessSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/** 폴더 선택 다이얼로그. 사용자가 취소하면 throw(AbortError). 진행 상태 저장 위해 readwrite. */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!isFsAccessSupported()) {
    throw new Error("이 브라우저는 폴더 직접 열기를 지원하지 않습니다(Chrome/Edge 권장).");
  }
  return window.showDirectoryPicker!({ mode: "readwrite" });
}

// ── .octopus/board.json — 작업 폴더에 보드 진행 상태 저장(.git/.claude 처럼) ──
const OCTOPUS_DIR = ".octopus";
const BOARD_FILE = "board.json";

/** 폴더의 .octopus/board.json 읽기. 없으면 null. */
export async function readBoardState(dir: FileSystemDirectoryHandle): Promise<unknown | null> {
  try {
    const sub = await dir.getDirectoryHandle(OCTOPUS_DIR);
    const fh = await sub.getFileHandle(BOARD_FILE);
    const text = await (await fh.getFile()).text();
    return JSON.parse(text);
  } catch {
    return null; // 없음/권한/파싱 실패
  }
}

/** 폴더의 .octopus/board.json 쓰기(베스트 에포트). */
export async function writeBoardState(dir: FileSystemDirectoryHandle, data: unknown): Promise<void> {
  try {
    const sub = await dir.getDirectoryHandle(OCTOPUS_DIR, { create: true });
    const fh = await sub.getFileHandle(BOARD_FILE, { create: true });
    const w = await (fh as unknown as { createWritable: () => Promise<{ write: (s: string) => Promise<void>; close: () => Promise<void> }> }).createWritable();
    await w.write(JSON.stringify(data, null, 2));
    await w.close();
  } catch {
    /* 권한 없음 등 — 무시 */
  }
}

type Writable = { write: (s: BufferSource | Blob | string) => Promise<void>; close: () => Promise<void> };
function asWritable(fh: FileSystemFileHandle): Promise<Writable> {
  return (fh as unknown as { createWritable: () => Promise<Writable> }).createWritable();
}

/** 폴더 루트에 텍스트 파일 쓰기(베스트 에포트). .octopus.md 산출물 내보내기용. */
export async function writeTextFileToDir(dir: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  try {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await asWritable(fh);
    await w.write(text);
    await w.close();
  } catch {
    /* 권한 없음 등 — 무시 */
  }
}

/** 폴더에 그 이름의 파일이 이미 있는지(사람 원본 덮어쓰기 방지). */
export async function dirHasFile(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * 소스 파일 핸들을 폴더 루트로 복사. 같은 이름 파일이 이미 있으면 덮어쓰지 않고 false.
 * 채팅 우선 흐름에서 RFP 등 입력 파일을 작업 폴더로 들여올 때.
 */
export async function copyFileToDir(dir: FileSystemDirectoryHandle, src: FileSystemFileHandle): Promise<boolean> {
  try {
    const file = await src.getFile();
    if (await dirHasFile(dir, file.name)) return false;
    const fh = await dir.getFileHandle(file.name, { create: true });
    const w = await asWritable(fh);
    await w.write(file);
    await w.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * 메모리 텍스트를 FileSystemFileHandle 처럼 감싼다(getFile 만 제공) — AI 초안처럼 파일 없이
 * 생성된 내용을 카드에 바인딩할 때. 폴더에 저장하면 그 내용이 .octopus.md 로 나간다.
 */
export function makeTextHandle(name: string, text: string): FileSystemFileHandle {
  return {
    name,
    kind: "file",
    getFile: async () => new File([text], name, { type: "text/markdown" }),
  } as unknown as FileSystemFileHandle;
}

/** 단일 파일 선택 — 카드 안에서 직접 파일을 불러올 때. 취소 시 null. */
export async function pickFile(): Promise<FileSystemFileHandle | null> {
  if (typeof window === "undefined" || typeof window.showOpenFilePicker !== "function") return null;
  try {
    const [handle] = await window.showOpenFilePicker({ multiple: false });
    return handle ?? null;
  } catch {
    return null; // 사용자 취소(AbortError) 등
  }
}

/** 트리에서 파일 노드를 이름(또는 경로)으로 찾는다 — 재오픈 시 바운드 핸들 부활용. */
export function findFileInTree(tree: FsNode[], nameOrPath: string): FsNode | null {
  for (const n of tree) {
    if (n.kind === "file" && (n.name === nameOrPath || n.path === nameOrPath)) return n;
    if (n.children) {
      const hit = findFileInTree(n.children, nameOrPath);
      if (hit) return hit;
    }
  }
  return null;
}

const SKIP_DIRS = new Set([".git", "node_modules", ".DS_Store", "__MACOSX"]);

/** 디렉토리 핸들을 재귀로 걸어 트리를 만든다. 깊이 제한으로 폭주 방지. */
export async function walkDirectory(
  dir: FileSystemDirectoryHandle,
  base = "",
  depth = 0,
): Promise<FsNode[]> {
  if (depth > 6) return [];
  const nodes: FsNode[] = [];
  // values() 는 AsyncIterable — 표준 타입에 없을 수 있어 any 캐스팅.
  const entries = (dir as unknown as {
    values: () => AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
  }).values();
  for await (const handle of entries) {
    if (SKIP_DIRS.has(handle.name)) continue;
    const path = base ? `${base}/${handle.name}` : handle.name;
    if (handle.kind === "directory") {
      const children = await walkDirectory(handle as FileSystemDirectoryHandle, path, depth + 1);
      nodes.push({ name: handle.name, path, kind: "dir", ext: "", handle, children });
    } else {
      nodes.push({
        name: handle.name,
        path,
        kind: "file",
        ext: extOf(handle.name),
        handle,
      });
    }
  }
  // 폴더 먼저, 그 다음 파일 — 각각 이름순.
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });
  return nodes;
}

export interface LoadedFile {
  name: string;
  ext: string;
  size: number;
  /** 텍스트류면 본문, 아니면 undefined */
  text?: string;
  /** 미리보기용 blob URL(pdf/이미지 등). 호출측이 사용 후 revoke */
  blobUrl?: string;
  mime: string;
}

const TEXT_EXTS = new Set(["txt", "md", "json", "csv", "tsv", "log", "yaml", "yml"]);

/** 슬롯에 지정된 파일을 읽는다. 텍스트류는 text, 그 외(pdf/이미지)는 blobUrl. */
export async function loadFile(handle: FileSystemFileHandle): Promise<LoadedFile> {
  const file = await handle.getFile();
  const ext = extOf(file.name);
  const base = { name: file.name, ext, size: file.size, mime: file.type };
  if (TEXT_EXTS.has(ext)) {
    return { ...base, text: await file.text() };
  }
  return { ...base, blobUrl: URL.createObjectURL(file) };
}
