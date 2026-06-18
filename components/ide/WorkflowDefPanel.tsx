"use client";

// components/ide/WorkflowDefPanel.tsx — 좌 사이드패널 '워크플로'.
//
// 워크플로 '선택' + 그 워크플로의 '카드 추가'(보드에). 정의(워크플로·카드 스펙) '편집'은
// 여기서 진입만 하고 실제 편집 화면은 중앙 패널(DefinitionEditor)에서 연다.
//   · 중앙 패널이 열리는 트리거 = 워크플로 ✎ / 새 워크플로(+) / 카드 ✎.

import { useWorkflowStore } from "@/lib/ide/workflow-store";
import { useDefEditor } from "@/lib/def-editor-context";
import { useActiveWorkflow, NO_WORKFLOW } from "@/lib/active-workflow-context";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import { useWorkflowLoader } from "@/lib/use-workflow-loader";
import { CARD_CATALOG, CARD_DND } from "@/lib/ide/card-spec";

export function WorkflowDefPanel() {
  const { addPack } = useWorkflowStore();
  const { openPack, openCard } = useDefEditor();
  const { pack: activePack } = useActiveWorkflow();
  const ctx = useAgentStreamContext();
  // 워크플로 선택+빈 카드 시드는 공유 훅(채팅 컴포저와 동일 동작 — 포용성).
  const { packs, packId, loadWorkflow: pickWorkflow } = useWorkflowLoader();
  const paletteCards = activePack ? activePack.cards : CARD_CATALOG;

  return (
    <div className="ide-sidebar ide-sidebar--left">
      <div className="ide-side-title">
        <span>워크플로</span>
        <span className="ide-sidebar-actions">
          <i className="codicon codicon-add" title="새 워크플로(중앙에서 편집)"
            style={{ cursor: "pointer", color: "var(--ide-text-dim)" }}
            onClick={() => openPack(addPack())} aria-hidden />
        </span>
      </div>

      {/* 활성 워크플로 선택 + 편집(중앙) */}
      <div className="px-3 pt-2 pb-2" style={{ borderBottom: "1px solid var(--ide-border)" }}>
        <label className="ide-mono mb-1 block text-[9px] tracking-[0.14em]" style={{ color: "var(--ide-text-faint)" }}>이 프로젝트의 워크플로</label>
        <div className="flex items-center gap-1.5">
          <div className="wf-pick" style={{ flex: 1 }}>
            <i className="codicon codicon-symbol-structure" aria-hidden />
            <select className="wf-pick-select" value={packId} onChange={(e) => pickWorkflow(e.target.value)}>
              {packs.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.available}>{p.label}{p.available ? "" : " · 곧"}</option>
              ))}
              <option value={NO_WORKFLOW}>선택 안함 — 전체 카드</option>
            </select>
            <i className="codicon codicon-chevron-down wf-pick-caret" aria-hidden />
          </div>
          {activePack && (
            <button type="button" className="wf-edit-btn" title="워크플로 정의 편집(중앙)" onClick={() => openPack(activePack.id)}>
              <i className="codicon codicon-edit" aria-hidden />
            </button>
          )}
        </div>
        <p className="ide-mono mt-1 text-[9px] leading-snug" style={{ color: "var(--ide-text-faint)" }}>
          {activePack ? activePack.description : "워크플로 없이 모든 카드를 쓸 수 있습니다."}
        </p>
      </div>

      {/* 카드 추가 — 활성 워크플로 카드를 보드에. 클릭/드래그. 각 카드 ✎ = 중앙에서 스펙 편집. */}
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        <div className="ide-mono mb-1.5 px-1 text-[9.5px] tracking-[0.14em]" style={{ color: "var(--ide-text-faint)" }}>
          카드 추가 — 클릭/드래그로 보드에 · ✎ 정의 편집
        </div>
        <div className="flex flex-col gap-1">
          {paletteCards.map((card) => (
            <div
              key={card.slot}
              className="wf-card"
              style={{ background: "var(--ide-bg-alt)", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, cursor: "grab" }}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData(CARD_DND, card.slot); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => ctx.addArtifact({ kind: "btl_doc_file", slotId: card.slot, name: card.header.title, ext: "" })}
              title={`보드에 ${card.header.title} 카드 추가`}
            >
              <i className={`codicon codicon-${card.header.icon}`} style={{ fontSize: 14, color: "var(--ide-text-dim)" }} aria-hidden />
              <span className="ide-mono text-[12px] font-semibold" style={{ color: "var(--ide-text)" }}>{card.header.title}</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {activePack && (
                  <i className="codicon codicon-edit" title="카드 정의 편집(중앙)"
                    style={{ fontSize: 12, color: "var(--ide-text-faint)" }}
                    onClick={(e) => { e.stopPropagation(); openCard(activePack.id, card.slot); }} aria-hidden />
                )}
                <i className="codicon codicon-add" style={{ fontSize: 13, color: "var(--ide-text-faint)" }} aria-hidden />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
