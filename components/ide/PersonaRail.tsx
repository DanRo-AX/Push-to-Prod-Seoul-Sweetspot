"use client";

// components/ide/PersonaRail.tsx — IDE 우측 사이드패널: 방문객 군집(OASIS).
//
// 군집을 '특정 카드'로 끌어다 놓으면 그 카드의 '검토 포인트'를 인지한 채 방문객 시점으로 검토한다
// (보드 전체가 아니라 카드 단위 — CanvasBoard 카드 onDrop → discuss). 검토 포인트(공간 조성·진입
// 장벽·공유 유인 등)는 카드가 선언하고, 군집은 그 관점에서 1인칭으로 반응한다. 여러 군집을 ○로
// 골라 한 번에 끌어다 놓을 수 있다(드래그 고스트에 인원수 표시). 데이터/색은 @/lib/oasis.

import { useState } from "react";
import { OASIS, samplesByType, archetypeColor, type OasisType } from "@/lib/oasis";
import { PERSONA_DND } from "@/lib/agent/personas";
import { ArchetypeCard, SampleCard } from "@/components/ide/PersonaCard";
import { SchedulePanel } from "@/components/ide/SchedulePanel";

const oasisPersonaId = (type: OasisType) => `oasis-${type.toLowerCase()}`;

export interface PersonaRailProps {
  onRun?: (prompt: string) => void;
  running?: boolean;
}

export function PersonaRail({ onRun, running }: PersonaRailProps) {
  const [openType, setOpenType] = useState<OasisType | null>("P3");
  const [openSamples, setOpenSamples] = useState<Set<string>>(() => new Set());
  // 다중 선택 — 페르소나 id 기준(군집·전문가 통합). 여러 명을 한 카드에 한 번에.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggleType = (type: OasisType) => setOpenType((cur) => (cur === type ? null : type));
  const toggleSample = (id: string) =>
    setOpenSamples((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleSelect = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // 드래그 페이로드 — 이 페르소나가 선택돼 있으면 선택된 전원, 아니면 이 한 명.
  const dragIdsFor = (id: string): string[] =>
    selected.size > 0 && selected.has(id) ? [...selected] : [id];

  // 드래그 시작 — 페이로드 + (여럿이면) 인원수 고스트.
  const startDrag = (e: React.DragEvent, id: string, label: string) => {
    const ids = dragIdsFor(id);
    e.dataTransfer.setData(PERSONA_DND, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.className = "persona-drag-ghost";
    ghost.textContent = ids.length > 1 ? `${label} 외 ${ids.length - 1}명 · ${ids.length}명 투입` : `${label} 투입`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 12, 12);
    setTimeout(() => ghost.remove(), 0);
  };

  const totalSel = selected.size;

  return (
    <aside className="ide-sidebar ide-sidebar--right" aria-label="방문객 군집 · OASIS">
      <div className="ide-side-title">
        <span>방문객 군집 · OASIS</span>
        <span className="ide-sidebar-actions">
          <i className="codicon codicon-organization" style={{ fontSize: 14, color: "var(--ide-text-faint)" }} aria-hidden />
        </span>
      </div>

      <div className="persona-draghint">
        <i className="codicon codicon-move" aria-hidden />
        <span className="persona-draghint-text">
          군집을 <b>특정 카드</b>로 끌어다 놓으면 그 카드의 <b>검토 포인트</b>를 방문객 시점으로 짚습니다.
          ○로 <b>여러 군집을 한 번에</b> 끌어다 놓을 수 있습니다.
          {totalSel > 0 && (
            <span style={{ display: "block", marginTop: 4, color: "var(--ide-accent)" }}>
              {totalSel}개 선택됨 — 카드에 끌어다 놓기
            </span>
          )}
        </span>
      </div>

      <SchedulePanel onRun={onRun} running={running} />

      <div className="ide-side-header">
        <i className="codicon codicon-chevron-down" aria-hidden />
        <span>방문객 군집 ({OASIS.archetypes.length})</span>
        <span className="ide-sidebar-actions"><span className="ide-badge">분포</span></span>
      </div>

      <div className="ide-sidebar-body">
        {OASIS.archetypes.map((a) => {
          const open = openType === a.type;
          const samples = open ? samplesByType(a.type) : [];
          const id = oasisPersonaId(a.type);
          const sel = selected.has(id);
          const color = archetypeColor(a.type);
          return (
            <div key={a.type}>
              <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
                <button
                  type="button"
                  onClick={() => toggleSelect(id)}
                  title={sel ? "선택 해제" : "선택 — 여러 명을 한 카드로 함께"}
                  aria-pressed={sel}
                  style={{
                    display: "flex", alignItems: "center", padding: "0 7px",
                    border: 0, background: "none", cursor: "pointer",
                    color: sel ? color : "var(--ide-text-faint)",
                  }}
                >
                  <i className={`codicon ${sel ? "codicon-pass-filled" : "codicon-circle-large-outline"}`} style={{ fontSize: 16 }} aria-hidden />
                </button>
                <div
                  className="persona-agent-drag"
                  style={{ flex: 1, minWidth: 0, boxShadow: sel ? `inset 0 0 0 1.5px ${color}` : undefined, borderRadius: sel ? 8 : undefined }}
                  draggable
                  onDragStart={(e) => startDrag(e, id, a.label)}
                  title="카드로 끌어다 놓기"
                >
                  <ArchetypeCard archetype={a} expanded={open} onToggle={() => toggleType(a.type)} />
                </div>
              </div>
              {open && (
                <div className="persona-detail" style={{ ["--arch" as string]: `var(--oasis-${a.type.toLowerCase()})` }}>
                  <div className="persona-detail-head">
                    <i className="codicon codicon-list-unordered" aria-hidden />
                    표본 프로필 {samples.length}
                  </div>
                  {samples.map((p) => (
                    <SampleCard key={p.id} persona={p} expanded={openSamples.has(p.id)} onToggle={() => toggleSample(p.id)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <p className="ide-mono mt-2 px-3 pb-3 text-[10px] leading-relaxed" style={{ color: "var(--ide-text-faint)" }}>
          군집을 특정 카드로 끌어다 놓으면 그 카드의 검토 포인트(공간 조성·진입 장벽·공유 유인 등)를
          방문객 1인칭 시점으로 짚습니다.
        </p>
      </div>
    </aside>
  );
}
