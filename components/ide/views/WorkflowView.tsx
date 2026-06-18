"use client";

// components/ide/views/WorkflowView.tsx — "워크플로 폴더" 뷰.
//
// 철학(사용자 정의): 자동화를 들어내도 단계마다 필요한 문서는 동일하다. 실무자는 자기
// 폴더 하나로 일하고, 그 폴더의 특정 파일을 워크플로 슬롯(RFP·기획제안서·견적서)에 **수동
// 지정**한다. 자동 감지/자동 표시 없음 — 슬롯에 바인딩된 파일만 떠서 작업 대상이 된다.
//
// 구성: [폴더 열기] → 좌측 실제 폴더 트리(File System Access) + 우측 워크플로 슬롯(드래그
// 또는 클릭으로 파일 지정) + 하단 선택 파일 프리뷰(텍스트/ PDF/이미지). 출처(에이전트/사람)
// 무관 — 슬롯이 단일 척추. Chrome/Edge 전용(미지원 시 안내).

import { useCallback, useMemo, useState } from "react";
import {
  isFsAccessSupported,
  pickDirectory,
  walkDirectory,
  loadFile,
  type FsNode,
  type LoadedFile,
} from "@/lib/fs-access";
import { BTL_WORKFLOW, type WorkflowSlotId } from "@/lib/ide/workflow";
import { personasForSlot } from "@/lib/agent/btl-personas";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import { useBoardDocs } from "@/lib/board-docs-context";
import type { RfpDocument } from "@/lib/types";

const DND_PATH = "application/x-octopus-fspath";

function flatten(nodes: FsNode[], into: Map<string, FsNode>) {
  for (const n of nodes) {
    into.set(n.path, n);
    if (n.children) flatten(n.children, into);
  }
}

function FileTree({
  nodes,
  depth,
  selectedPath,
  onPick,
}: {
  nodes: FsNode[];
  depth: number;
  selectedPath: string | null;
  onPick: (n: FsNode) => void;
}) {
  return (
    <ul className="m-0 list-none p-0">
      {nodes.map((n) => (
        <TreeRow
          key={n.path}
          node={n}
          depth={depth}
          selectedPath={selectedPath}
          onPick={onPick}
        />
      ))}
    </ul>
  );
}

function TreeRow({
  node,
  depth,
  selectedPath,
  onPick,
}: {
  node: FsNode;
  depth: number;
  selectedPath: string | null;
  onPick: (n: FsNode) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isDir = node.kind === "dir";
  const active = selectedPath === node.path;
  return (
    <li>
      <div
        className="ide-list-row flex items-center gap-1.5"
        style={{
          paddingLeft: 8 + depth * 12,
          cursor: "pointer",
          background: active ? "var(--ide-active, #04395e)" : undefined,
        }}
        draggable={!isDir}
        onDragStart={(e) => {
          if (!isDir) e.dataTransfer.setData(DND_PATH, node.path);
        }}
        onClick={() => (isDir ? setOpen((v) => !v) : onPick(node))}
      >
        <i
          className={`codicon ${
            isDir
              ? open
                ? "codicon-chevron-down"
                : "codicon-chevron-right"
              : "codicon-file"
          }`}
          style={{ fontSize: 13, color: "var(--ide-text-dim)" }}
          aria-hidden
        />
        <span className="ide-mono text-[12px]" style={{ color: "var(--ide-text)" }}>
          {node.name}
        </span>
      </div>
      {isDir && open && node.children && node.children.length > 0 && (
        <FileTree
          nodes={node.children}
          depth={depth + 1}
          selectedPath={selectedPath}
          onPick={onPick}
        />
      )}
    </li>
  );
}

function Preview({ loaded }: { loaded: LoadedFile }) {
  if (loaded.text != null) {
    return (
      <pre
        className="ide-mono m-0 overflow-auto p-3 text-[12px]"
        style={{ color: "var(--ide-text)", whiteSpace: "pre-wrap", maxHeight: "100%" }}
      >
        {loaded.ext === "json" ? prettyJson(loaded.text) : loaded.text}
      </pre>
    );
  }
  if (loaded.blobUrl && loaded.ext === "pdf") {
    return <iframe src={loaded.blobUrl} title={loaded.name} className="h-full w-full" style={{ border: 0 }} />;
  }
  if (loaded.blobUrl && ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(loaded.ext)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={loaded.blobUrl} alt={loaded.name} style={{ maxWidth: "100%", display: "block", margin: "0 auto" }} />;
  }
  return (
    <div className="ide-mono p-4 text-[12px]" style={{ color: "var(--ide-text-dim)" }}>
      <p>{loaded.name}</p>
      <p>{(loaded.size / 1024).toFixed(0)} KB · {loaded.mime || loaded.ext || "파일"}</p>
      <p style={{ marginTop: 8 }}>이 형식은 인라인 미리보기를 지원하지 않습니다(슬롯 지정은 가능).</p>
    </div>
  );
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export default function WorkflowView() {
  const supported = isFsAccessSupported();
  const [folderName, setFolderName] = useState<string | null>(null);
  const [tree, setTree] = useState<FsNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bindings, setBindings] = useState<Record<WorkflowSlotId, FsNode | null>>({
    rfp: null,
    proposal: null,
    quote: null,
    operation: null,
    proposal_doc: null,
    contract: null,
  });
  const [selected, setSelected] = useState<FsNode | null>(null);
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [pendingSlot, setPendingSlot] = useState<WorkflowSlotId | null>(null);
  const [starting, setStarting] = useState(false);

  const ctx = useAgentStreamContext();

  // RFP 슬롯에 지정된 파일로 BTL 흐름 시작 — 타입은 '어느 슬롯이냐'로 사람이 선언한 것.
  // 자동 분류 없음: RFP 슬롯에 넣었으니 RFP 로 분석한다.
  // 내가 쓰던 문서(슬롯 바인딩)를 그 슬롯 담당 페르소나들과 논의 — 문서 생성이 아니라
  // 지금 이 파일에 대한 피드백을 채팅 피드에 이름표로 받는다.
  const discussSlot = useCallback(
    async (slotId: WorkflowSlotId, node: FsNode) => {
      if (ctx.running) return;
      setError(null);
      try {
        const file = await (node.handle as FileSystemFileHandle).getFile();
        await ctx.discuss(file, slotId, node.name);
      } catch (e) {
        setError(e instanceof Error ? e.message : "논의 시작 중 오류가 발생했습니다.");
      }
    },
    [ctx],
  );

  const startFlowFromRfp = useCallback(
    async (node: FsNode) => {
      if (ctx.running || starting) return;
      setError(null);
      setStarting(true);
      try {
        const file = await (node.handle as FileSystemFileHandle).getFile();
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/btl/extract-rfp", { method: "POST", body: fd });
        const data = (await res.json()) as { rfp?: unknown; error?: string };
        if (!res.ok || !data.rfp) throw new Error(data.error ?? `RFP 분석 실패 (${res.status})`);
        await ctx.start(`워크플로 RFP "${node.name}" 로 기획안과 견적서를 작성해줘`, {
          rfp: data.rfp,
          scenarioId: "C-btl",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "흐름 시작 중 오류가 발생했습니다.");
      } finally {
        setStarting(false);
      }
    },
    [ctx, starting],
  );

  const nodeByPath = useMemo(() => {
    const m = new Map<string, FsNode>();
    flatten(tree, m);
    return m;
  }, [tree]);

  const openFolder = useCallback(async () => {
    setError(null);
    try {
      const dir = await pickDirectory();
      const nodes = await walkDirectory(dir);
      setFolderName(dir.name);
      setTree(nodes);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // 사용자 취소
      setError(e instanceof Error ? e.message : "폴더를 열지 못했습니다.");
    }
  }, []);

  const preview = useCallback(async (node: FsNode) => {
    if (node.kind !== "file") return;
    setSelected(node);
    setLoaded(null);
    try {
      const lf = await loadFile(node.handle as FileSystemFileHandle);
      setLoaded(lf);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
    }
  }, []);

  const { bindDoc, clearDoc } = useBoardDocs();

  // 문서타입 지정 시 보드에 산출물 카드 추가. RFP 는 추출해 btl_rfp 카드(BtlRfpView)로.
  const addBoardCard = useCallback(
    async (slotId: WorkflowSlotId, node: FsNode) => {
      if (slotId !== "rfp") return; // 제안서/견적/계약은 생성 단계에서 카드화(후속)
      try {
        const file = await (node.handle as FileSystemFileHandle).getFile();
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/btl/extract-rfp", { method: "POST", body: fd });
        const data = (await res.json()) as { rfp?: unknown; error?: string };
        if (res.ok && data.rfp) {
          ctx.addArtifact({ kind: "btl_rfp", rfp: data.rfp as RfpDocument });
        }
      } catch {
        /* 카드 추가 실패는 조용히 무시(슬롯 바인딩은 유지) */
      }
    },
    [ctx],
  );

  const pickForTree = useCallback(
    (node: FsNode) => {
      // 슬롯 지정 대기 중이면 그 슬롯에 바인딩(작업 보드 카드 등록), 아니면 단순 프리뷰.
      if (pendingSlot) {
        setBindings((b) => ({ ...b, [pendingSlot]: node }));
        bindDoc({ slotId: pendingSlot, name: node.name, ext: node.ext });
        void addBoardCard(pendingSlot, node);
        setPendingSlot(null);
      }
      void preview(node);
    },
    [pendingSlot, preview, bindDoc, addBoardCard],
  );

  const bindToSlot = useCallback(
    (slotId: WorkflowSlotId, node: FsNode) => {
      setBindings((b) => ({ ...b, [slotId]: node }));
      bindDoc({ slotId, name: node.name, ext: node.ext });
      void addBoardCard(slotId, node);
      void preview(node);
    },
    [preview, bindDoc, addBoardCard],
  );

  if (!supported) {
    return (
      <div className="ide-mono p-5 text-[12.5px]" style={{ color: "var(--ide-text-dim)" }}>
        이 브라우저는 폴더 직접 열기(File System Access API)를 지원하지 않습니다.
        <br />
        Chrome 또는 Edge 에서 사용하세요.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 상단 — 폴더 열기 */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid var(--ide-border)" }}
      >
        <button
          type="button"
          className="ide-mono inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px]"
          style={{ border: "1px solid var(--ide-border)", color: "var(--ide-text)", cursor: "pointer" }}
          onClick={() => void openFolder()}
        >
          <i className="codicon codicon-folder-opened" style={{ fontSize: 13 }} aria-hidden />
          폴더 열기
        </button>
        {folderName && (
          <span className="ide-mono text-[11px]" style={{ color: "var(--ide-text-dim)" }}>
            {folderName}
          </span>
        )}
        {pendingSlot && (
          <span className="ide-mono text-[11px]" style={{ color: "var(--ide-accent-bright)" }}>
            ← 트리에서 「{BTL_WORKFLOW.find((s) => s.id === pendingSlot)?.label}」에 지정할 파일 클릭
          </span>
        )}
      </div>

      {error && (
        <p className="ide-mono px-3 py-1.5 text-[11px]" style={{ color: "var(--ide-danger)" }}>
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        {/* 좌 — 폴더 트리 */}
        <div
          className="min-h-0 w-[240px] shrink-0 overflow-auto py-1"
          style={{ borderRight: "1px solid var(--ide-border)" }}
        >
          {tree.length === 0 ? (
            <p className="ide-mono px-3 py-2 text-[11px]" style={{ color: "var(--ide-text-faint)" }}>
              폴더를 열면 파일이 여기 표시됩니다.
            </p>
          ) : (
            <FileTree nodes={tree} depth={0} selectedPath={selected?.path ?? null} onPick={pickForTree} />
          )}
        </div>

        {/* 중 — 워크플로 슬롯 */}
        <div
          className="min-h-0 w-[280px] shrink-0 overflow-auto p-3"
          style={{ borderRight: "1px solid var(--ide-border)" }}
        >
          <div className="ide-mono mb-2 text-[10px] tracking-[0.16em]" style={{ color: "var(--ide-text-faint)" }}>
            워크플로 슬롯 — 파일을 드래그하거나 「지정」으로 연결
          </div>
          <div className="flex flex-col gap-2">
            {BTL_WORKFLOW.map((slot) => {
              const bound = bindings[slot.id];
              return (
                <div
                  key={slot.id}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes(DND_PATH)) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    const p = e.dataTransfer.getData(DND_PATH);
                    const node = p ? nodeByPath.get(p) : undefined;
                    if (node && node.kind === "file") {
                      e.preventDefault();
                      bindToSlot(slot.id, node);
                    }
                  }}
                  className="rounded p-2.5"
                  style={{
                    border: `1px solid ${bound ? "var(--ide-accent)" : "var(--ide-border)"}`,
                    background: bound ? "var(--ide-progress-dim)" : "transparent",
                  }}
                >
                  <div className="flex items-baseline gap-1.5">
                    {slot.upstream && (
                      <i className="codicon codicon-arrow-down" style={{ fontSize: 11, color: "var(--ide-text-faint)" }} aria-hidden />
                    )}
                    <span className="ide-mono text-[12px] font-semibold" style={{ color: "var(--ide-text)" }}>
                      {slot.order}. {slot.label}
                    </span>
                  </div>
                  <div className="ide-mono mt-0.5 text-[10.5px]" style={{ color: "var(--ide-text-faint)" }}>
                    {slot.hint}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {bound ? (
                      <>
                        <i className="codicon codicon-file" style={{ fontSize: 12, color: "var(--ide-accent-bright)" }} aria-hidden />
                        <button
                          type="button"
                          className="ide-mono text-[11px]"
                          style={{ color: "var(--ide-accent-bright)", background: "none", border: 0, cursor: "pointer", padding: 0, textAlign: "left" }}
                          onClick={() => void preview(bound)}
                          title={bound.path}
                        >
                          {bound.name}
                        </button>
                        <button
                          type="button"
                          className="ide-mono ml-auto text-[10px]"
                          style={{ color: "var(--ide-text-faint)", background: "none", border: 0, cursor: "pointer" }}
                          onClick={() => { setBindings((b) => ({ ...b, [slot.id]: null })); clearDoc(slot.id); }}
                        >
                          지우기
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="ide-mono text-[11px]"
                        style={{
                          color: pendingSlot === slot.id ? "var(--ide-accent-bright)" : "var(--ide-text-dim)",
                          background: "none",
                          border: 0,
                          cursor: "pointer",
                          padding: 0,
                        }}
                        onClick={() => setPendingSlot((s) => (s === slot.id ? null : slot.id))}
                      >
                        {pendingSlot === slot.id ? "트리에서 파일 클릭…" : "+ 파일 지정"}
                      </button>
                    )}
                  </div>

                  {/* RFP 슬롯에 파일이 지정되면 그 RFP 로 흐름 시작(타입=슬롯이 선언). */}
                  {bound && slot.id === "rfp" && (
                    <button
                      type="button"
                      className="ide-mono mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px]"
                      style={{
                        background: ctx.running || starting ? "var(--ide-progress-dim)" : "var(--ide-accent)",
                        color: ctx.running || starting ? "var(--ide-text-dim)" : "#ffffff",
                        border: 0,
                        cursor: ctx.running || starting ? "default" : "pointer",
                      }}
                      disabled={ctx.running || starting}
                      onClick={() => void startFlowFromRfp(bound)}
                    >
                      <i
                        className={`codicon ${starting ? "codicon-loading codicon-modifier-spin" : "codicon-run-all"}`}
                        style={{ fontSize: 12 }}
                        aria-hidden
                      />
                      {starting ? "RFP 분석 중…" : "이 RFP로 기획안·견적서 생성"}
                    </button>
                  )}

                  {/* 핵심 — 이 문서를 슬롯 담당 페르소나들과 논의(이름표 달린 피드백). */}
                  {bound && personasForSlot(slot.id).length > 0 && (
                    <div className="mt-2">
                      <div className="mb-1 flex flex-wrap gap-1">
                        {personasForSlot(slot.id).map((p) => (
                          <span
                            key={p.id}
                            className="ide-mono inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px]"
                            style={{ border: "1px solid var(--ide-border)", color: "var(--ide-text-dim)" }}
                            title={`${p.title} — ${p.lens}\n출처: ${p.dataSource}`}
                          >
                            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.accent }} aria-hidden />
                            {p.name}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="ide-mono inline-flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px]"
                        style={{
                          border: `1px solid ${ctx.running ? "var(--ide-border)" : "var(--ide-accent)"}`,
                          color: ctx.running ? "var(--ide-text-dim)" : "var(--ide-accent-bright)",
                          background: "transparent",
                          cursor: ctx.running ? "default" : "pointer",
                        }}
                        disabled={ctx.running}
                        onClick={() => void discussSlot(slot.id, bound)}
                      >
                        <i className="codicon codicon-comment-discussion" style={{ fontSize: 12 }} aria-hidden />
                        이 문서, 관련 페르소나와 논의
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 우 — 선택/지정 파일 프리뷰 */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {selected && loaded ? (
            <Preview loaded={loaded} />
          ) : selected ? (
            <p className="ide-mono p-4 text-[12px]" style={{ color: "var(--ide-text-faint)" }}>
              읽는 중…
            </p>
          ) : (
            <p className="ide-mono p-4 text-[12px]" style={{ color: "var(--ide-text-faint)" }}>
              슬롯에 지정했거나 트리에서 클릭한 파일이 여기 표시됩니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
