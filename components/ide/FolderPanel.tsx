"use client";

// components/ide/FolderPanel.tsx — 좌 사이드패널 '탐색기'(폴더 전용).
//
// 작업 폴더 열기(트리 브라우즈) + 진행 상태(보드) 저장·복원(.octopus/board.json).
// 카드 추가·워크플로 선택은 '워크플로' 탭이 담당(탐색기는 파일시스템만).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isFsAccessSupported,
  pickDirectory,
  walkDirectory,
  readBoardState,
  writeBoardState,
  writeTextFileToDir,
  copyFileToDir,
  findFileInTree,
  type FsNode,
} from "@/lib/fs-access";
import { useActiveWorkflow } from "@/lib/active-workflow-context";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import { useBoardDocs } from "@/lib/board-docs-context";
import { useProjectFolder } from "@/lib/project-folder-context";
import { boardToMarkdownDocs } from "@/lib/ide/export-md";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { DEMO_FOLDER_NAME, DEMO_TREE, DEMO_ARTIFACTS, DEMO_PROPOSAL_FILE, demoProposalHandle } from "@/lib/demo/demo-fixtures";
import type { Artifact } from "@/lib/types";

function TreeRow({ node, depth }: { node: FsNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const isDir = node.kind === "dir";
  return (
    <li>
      <div
        className="ide-list-row flex items-center gap-1.5"
        style={{ paddingLeft: 8 + depth * 12, cursor: isDir ? "pointer" : "default" }}
        onClick={() => isDir && setOpen((v) => !v)}
      >
        <i
          className={`codicon ${isDir ? (open ? "codicon-chevron-down" : "codicon-chevron-right") : "codicon-file"}`}
          style={{ fontSize: 13, color: "var(--ide-text-dim)" }}
          aria-hidden
        />
        <span className="ide-mono truncate text-[12px]" style={{ color: "var(--ide-text)" }}>{node.name}</span>
      </div>
      {isDir && open && node.children?.map((c) => (
        <ul key={c.path} className="m-0 list-none p-0">
          <TreeRow node={c} depth={depth + 1} />
        </ul>
      ))}
    </li>
  );
}

export function FolderPanel() {
  const [supported, setSupported] = useState(true);
  // SSR-safe 브라우저 능력 감지: window 는 서버에서 undefined 이므로 마운트 후 1회만 갱신한다.
  // (lazy initializer 는 SSR/CSR 하이드레이션 불일치를 유발하므로 의도적으로 effect 를 사용.)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSupported(isFsAccessSupported()); }, []);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [tree, setTree] = useState<FsNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ctx = useAgentStreamContext();
  const { packId, setPackId } = useActiveWorkflow();
  const { docs, bindDoc } = useBoardDocs();
  const { setFolder } = useProjectFolder();

  // 작업 폴더 핸들 — .octopus/board.json 으로 보드 진행 상태 저장/복원.
  const dirRef = useRef<FileSystemDirectoryHandle | null>(null);
  const loadedRef = useRef(false); // 로드 완료 전엔 저장 안 함(빈 보드로 덮어쓰기 방지)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openFolder = useCallback(async () => {
    setError(null);
    // 시연 모드 — 네이티브 폴더창 우회, 번들 보드/트리/바인딩 주입.
    if (isDemoMode()) {
      setFolderName(DEMO_FOLDER_NAME);
      setTree(DEMO_TREE);
      setPackId("btl");
      ctx.loadArtifacts(DEMO_ARTIFACTS);
      bindDoc({ slotId: "proposal", name: DEMO_PROPOSAL_FILE, ext: "md", handle: demoProposalHandle() });
      return;
    }
    try {
      const dir = await pickDirectory();
      dirRef.current = dir;
      setFolder(dir);
      setFolderName(dir.name);
      const t = await walkDirectory(dir);
      setTree(t);
      // 진행 상태 복원 — .octopus/board.json: 보드·워크플로 + 파일 바인딩(핸들은 트리에서 부활).
      const saved = (await readBoardState(dir)) as
        | { packId?: string; artifacts?: Artifact[]; docs?: { slotId: string; name: string; ext: string }[] }
        | null;
      if (saved?.artifacts) {
        if (typeof saved.packId === "string") setPackId(saved.packId);
        ctx.loadArtifacts(saved.artifacts);
        // 파일형 카드 핸들 부활 — 폴더 트리에서 이름으로 재해결(있는 것만).
        for (const d of saved.docs ?? []) {
          const node = findFileInTree(t, d.name);
          if (node && node.kind === "file") {
            bindDoc({ slotId: d.slotId, name: d.name, ext: d.ext, handle: node.handle as FileSystemFileHandle });
          }
        }
      }
      loadedRef.current = true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "폴더를 열지 못했습니다.");
    }
  }, [ctx, setPackId, bindDoc, setFolder]);

  // 보드/워크플로/파일바인딩 변경 시 폴더에 디바운스 저장(폴더 연 뒤·로드 완료 후에만).
  // .octopus/board.json(진행 상태) + 산출물 카드 → `{라벨}.octopus.md`(사람 가독)를 함께 쓴다.
  useEffect(() => {
    if (!dirRef.current || !loadedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const dir = dirRef.current;
    const snapshot = { packId, artifacts: ctx.artifacts, docs: docs.map((d) => ({ slotId: d.slotId, name: d.name, ext: d.ext })) };
    saveTimer.current = setTimeout(() => {
      void writeBoardState(dir, { ...snapshot, savedAt: new Date().toISOString() });
      for (const doc of boardToMarkdownDocs(ctx.artifacts)) {
        void writeTextFileToDir(dir, doc.filename, doc.markdown);
      }
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [ctx.artifacts, packId, docs]);

  // ③ 채팅 우선 '폴더에 저장' — 폴더 없이 시작한 보드(메모리)를 고른 폴더에 구체화.
  //    board.json + 산출물 .octopus.md 내보내고, 바인딩된 입력 파일(RFP 등)을 폴더로 복사한다.
  //    이후 dirRef 가 잡혀 변경분이 자동 저장된다.
  const saveToFolder = useCallback(async () => {
    setError(null);
    try {
      const dir = await pickDirectory();
      // 이미 octopus 프로젝트인 폴더면 — 현재 메모리 보드로 덮어쓰기 전에 확인(기존 보드 보호).
      const existing = (await readBoardState(dir)) as { artifacts?: unknown[]; savedAt?: string } | null;
      if (existing?.artifacts?.length) {
        const ok = typeof window !== "undefined" && window.confirm(
          `이 폴더엔 이미 octopus 보드가 있습니다(저장: ${existing.savedAt ?? "?"}).\n현재 보드로 덮어쓸까요? 기존 진행 상태가 대체됩니다.`,
        );
        if (!ok) { setError("저장을 취소했습니다 — 기존 보드를 지키려면 그 폴더를 ‘작업 폴더 열기’로 여세요."); return; }
      }
      dirRef.current = dir;
      setFolder(dir);
      setFolderName(dir.name);
      // 입력 파일(바운드 핸들 있는 것)을 폴더 루트로 복사 — 같은 이름 있으면 건드리지 않음.
      for (const d of docs) {
        if (d.handle) await copyFileToDir(dir, d.handle);
      }
      await writeBoardState(dir, {
        packId,
        artifacts: ctx.artifacts,
        docs: docs.map((d) => ({ slotId: d.slotId, name: d.name, ext: d.ext })),
        savedAt: new Date().toISOString(),
      });
      for (const doc of boardToMarkdownDocs(ctx.artifacts)) {
        await writeTextFileToDir(dir, doc.filename, doc.markdown);
      }
      setTree(await walkDirectory(dir));
      loadedRef.current = true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "폴더에 저장하지 못했습니다.");
    }
  }, [ctx.artifacts, packId, docs, setFolder]);

  const hasBoard = ctx.artifacts.length > 0;

  return (
    <div className="ide-sidebar ide-sidebar--left">
      <div className="ide-side-title"><span>탐색기</span></div>

      {/* 폴더 열기 */}
      <div className="ide-side-header">
        <i className="codicon codicon-folder-opened" aria-hidden />
        <button
          type="button"
          className="ide-mono text-[11px]"
          style={{ color: "var(--ide-text)", background: "none", border: 0, cursor: "pointer" }}
          onClick={() => void openFolder()}
          disabled={!supported}
        >
          {folderName ? folderName : "작업 폴더 열기"}
        </button>
        {/* 폴더 없이 시작한 보드 → 폴더에 저장(구체화). 폴더 연 뒤엔 자동 저장이라 숨김. */}
        {!folderName && hasBoard && (
          <button
            type="button"
            className="ide-mono text-[11px]"
            style={{ marginLeft: "auto", color: "var(--ide-accent)", background: "none", border: 0, cursor: "pointer" }}
            onClick={() => void saveToFolder()}
            disabled={!supported}
            title="현재 보드를 폴더에 저장(입력 파일 복사 + 산출물 .octopus.md 내보내기)"
          >
            폴더에 저장
          </button>
        )}
      </div>
      {!supported && (
        <p className="ide-mono px-3 py-2 text-[10.5px]" style={{ color: "var(--ide-text-dim)" }}>
          폴더 열기는 Chrome/Edge 에서만 됩니다.
        </p>
      )}
      {error && <p className="ide-mono px-3 py-1.5 text-[10.5px]" style={{ color: "var(--ide-danger)" }}>{error}</p>}

      {/* 파일 트리(브라우즈) — 패널 전체 채움 */}
      {tree.length > 0 && (
        <div className="min-h-0 flex-1 overflow-auto py-1">
          <ul className="m-0 list-none p-0">
            {tree.map((n) => <TreeRow key={n.path} node={n} depth={0} />)}
          </ul>
        </div>
      )}

      {tree.length === 0 && (
        <p className="ide-mono px-3 py-2 text-[10.5px] leading-relaxed" style={{ color: "var(--ide-text-faint)" }}>
          작업 폴더를 열면 파일 트리와 진행 상태(보드)가 복원됩니다. 카드 추가는 ‘워크플로’ 탭에서.
        </p>
      )}
    </div>
  );
}
