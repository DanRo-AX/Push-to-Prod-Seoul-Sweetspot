"use client";

// components/ide/ExplorerView.tsx — VS Code EXPLORER 사이드바 뷰(정통 재현).
//
// 액티비티바의 "탐색기"를 선택하면 좌 패널에 표시되는 EXPLORER 뷰다.
// 열려 있는 산출물/뷰를 VS Code 파일 트리처럼 보여 준다:
//   · 사이드바 최상단 뷰 타이틀 "탐색기"(.ide-side-title, 35px, 대문자).
//   · 접을 수 있는 섹션 헤더 "OCTOPUS"(.ide-side-header, 22px, ▸/▾ chevron).
//   · 그 아래 워크스페이스 폴더 트리(폴더: octopus › artifacts/views, 파일 행).
//   · 행 = .ide-list-row (codicon 파일/폴더 아이콘, hover #2a2d2e, active #04395e).
//   · 클릭 = 해당 탭 열기/활성(onSelect), 호버 시 행 우측 닫기(×, onClose).
//
// 규칙:
//   · 색/치수는 .ide-* 클래스 + 토큰(var(--ide-*))에서만(하드코딩 금지).
//   · 아이콘은 실제 codicon(@vscode/codicons). 새 의존성 없음.
//   · 데이터는 props 로만 받는다(엔진/SSE 직접 접근 없음). 탭 상태의 단일 출처는
//     EditorArea — 이 뷰는 그 파생 모델을 받아 그리고, 콜백으로 동작을 위임한다.
//   · 자체 .ide-sidebar 크롬을 들고 온다(IDEShell 이 폭/접기만 제어, ChatPanel 과 동형).

import { useState } from "react";
import { fileCodicon, viewCodicon } from "@/components/ide/fileIcons";
import { VIEW_META, type IdeIconKey } from "@/lib/ide/views";

// ───────────────────────── 트리 항목 모델 ─────────────────────────

/**
 * 탐색기 한 행(열린 산출물/뷰). EditorArea 가 자신의 탭 모델에서 파생해 넘긴다.
 *   · id        — 탭 식별자(EditorArea 의 TabId 와 동일 문자열).
 *   · filename  — 표시 파일명(예: briefing.md, dashboard.tsx).
 *   · label     — 한국어 라벨(툴팁).
 *   · group     — 어느 폴더 아래에 둘지("artifacts" | "views").
 *   · iconKey   — 뷰 항목일 때 아이콘 키(파일 항목은 filename 확장자로 추론).
 *   · isView    — 뷰 탭이면 true(아이콘을 viewCodicon 으로).
 *   · active    — 현재 활성 탭이면 true.
 *   · dirty     — 작업 진행 중(수정점) 이면 true.
 */
export interface ExplorerItem {
  id: string;
  filename: string;
  label: string;
  group: "artifacts" | "views";
  iconKey?: IdeIconKey;
  isView: boolean;
  active: boolean;
  dirty: boolean;
}

export interface ExplorerViewProps {
  /** 열린 탭(산출물 + 뷰)에서 파생한 트리 항목들. 등장 순서 유지. */
  items: ExplorerItem[];
  /** 행 클릭 — 해당 탭 열기/활성. */
  onSelect: (id: string) => void;
  /** 행 닫기(×) — 해당 탭 닫기. */
  onClose: (id: string) => void;
}

// ───────────────────────── 행 ─────────────────────────

function ExplorerRow({
  item,
  depth,
  onSelect,
  onClose,
}: {
  item: ExplorerItem;
  depth: number;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const icon = item.isView
    ? { name: viewCodicon(item.iconKey ?? "file"), tint: "var(--ide-text-dim)" }
    : fileCodicon(item.filename);

  // 트레일링: dirty(작업 중)이고 hover 아니면 점, 아니면 hover 시 닫기(×).
  const showDot = item.dirty && !hover;

  return (
    <div
      role="treeitem"
      aria-selected={item.active}
      tabIndex={0}
      title={item.label}
      onClick={() => onSelect(item.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item.id);
        }
      }}
      className={`ide-list-row ${item.active ? "active" : ""}`}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      <i
        className={`codicon codicon-${icon.name}`}
        aria-hidden="true"
        style={{ color: icon.tint }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontFamily: "var(--ide-ui)",
          fontSize: 13,
        }}
      >
        {item.filename}
      </span>
      {showDot ? (
        <i
          className="codicon codicon-circle-filled"
          aria-hidden="true"
          style={{ fontSize: 10, color: "var(--ide-text)" }}
          title="작업 진행 중"
        />
      ) : (
        <span
          role="button"
          aria-label={`${item.label} 닫기`}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onClose(item.id);
          }}
          className="ide-icon-btn"
          style={{
            width: 18,
            height: 18,
            opacity: hover || item.active ? 1 : 0,
          }}
        >
          <i className="codicon codicon-close" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

// ───────────────────────── 폴더(접기) ─────────────────────────

function ExplorerFolder({
  name,
  open,
  depth,
  onToggle,
}: {
  name: string;
  open: boolean;
  depth: number;
  onToggle: () => void;
}) {
  return (
    <div
      role="treeitem"
      aria-expanded={open}
      aria-selected={false}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className="ide-list-row"
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      <i
        className={`codicon codicon-chevron-${open ? "down" : "right"}`}
        aria-hidden="true"
        style={{ color: "var(--ide-text)" }}
      />
      <i
        className={`codicon codicon-${open ? "folder-opened" : "folder"}`}
        aria-hidden="true"
      />
      <span
        style={{
          flex: 1,
          fontFamily: "var(--ide-ui)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {name}
      </span>
    </div>
  );
}

// ───────────────────────── 본체 ─────────────────────────

/**
 * EXPLORER 뷰 — 자체 .ide-sidebar 크롬 포함. IDEShell 의 leftPanel 슬롯에 들어간다.
 * 비어 있으면(열린 항목 없음) VS Code 의 "열린 폴더 없음" 빈 상태 안내를 보여 준다.
 */
export function ExplorerView({ items, onSelect, onClose }: ExplorerViewProps) {
  // 섹션/폴더 접힘 상태(로컬 UI).
  const [octopusOpen, setOctopusOpen] = useState(true);
  const [artifactsOpen, setArtifactsOpen] = useState(true);
  const [viewsOpen, setViewsOpen] = useState(true);

  const artifactItems = items.filter((i) => i.group === "artifacts");
  const viewItems = items.filter((i) => i.group === "views");
  const empty = items.length === 0;

  return (
    <aside className="ide-sidebar ide-sidebar--left" aria-label="탐색기">
      {/* 사이드바 최상단 뷰 타이틀 */}
      <div className="ide-side-title">
        탐색기
        <span className="ide-sidebar-actions">
          <button
            type="button"
            className="ide-icon-btn"
            title="모두 접기"
            aria-label="모두 접기"
            onClick={() => {
              setArtifactsOpen(false);
              setViewsOpen(false);
            }}
          >
            <i className="codicon codicon-collapse-all" aria-hidden="true" />
          </button>
        </span>
      </div>

      {/* 섹션 헤더 — OCTOPUS 워크스페이스 */}
      <div
        className="ide-side-header"
        role="button"
        tabIndex={0}
        aria-expanded={octopusOpen}
        onClick={() => setOctopusOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOctopusOpen((v) => !v);
          }
        }}
      >
        <i
          className={`codicon codicon-chevron-${octopusOpen ? "down" : "right"}`}
          aria-hidden="true"
        />
        OCTOPUS
      </div>

      {/* 트리 본문 */}
      <div className="ide-sidebar-body" role="tree" aria-label="워크스페이스 트리">
        {octopusOpen &&
          (empty ? (
            <div
              style={{
                padding: "12px 16px",
                color: "var(--ide-text-faint)",
                fontSize: 12,
                lineHeight: 1.6,
                fontFamily: "var(--ide-ui)",
              }}
            >
              아직 열린 산출물이 없습니다. 왼쪽 대화에서 에이전트에게 업무를
              지시하면 산출물이 여기 파일로 나타납니다.
            </div>
          ) : (
            <>
              {/* artifacts 폴더 */}
              {artifactItems.length > 0 && (
                <>
                  <ExplorerFolder
                    name="artifacts"
                    open={artifactsOpen}
                    depth={0}
                    onToggle={() => setArtifactsOpen((v) => !v)}
                  />
                  {artifactsOpen &&
                    artifactItems.map((item) => (
                      <ExplorerRow
                        key={item.id}
                        item={item}
                        depth={1}
                        onSelect={onSelect}
                        onClose={onClose}
                      />
                    ))}
                </>
              )}

              {/* views 폴더 */}
              {viewItems.length > 0 && (
                <>
                  <ExplorerFolder
                    name="views"
                    open={viewsOpen}
                    depth={0}
                    onToggle={() => setViewsOpen((v) => !v)}
                  />
                  {viewsOpen &&
                    viewItems.map((item) => (
                      <ExplorerRow
                        key={item.id}
                        item={item}
                        depth={1}
                        onSelect={onSelect}
                        onClose={onClose}
                      />
                    ))}
                </>
              )}
            </>
          ))}
      </div>
    </aside>
  );
}

/**
 * 보조 — IdeIconKey 별 한국어 라벨(필요 시 툴팁/접근성에 재사용).
 * VIEW_META 에서 뷰 라벨을 가져온다(중복 정의 방지).
 */
export function viewItemLabel(key: Exclude<IdeIconKey, "file">): string {
  switch (key) {
    case "workflow":
      return VIEW_META.workflow.label;
    case "dashboard":
      return VIEW_META.dashboard.label;
    case "content":
      return VIEW_META.content.label;
    case "outbound":
      return VIEW_META.outbound.label;
    case "settings":
      return VIEW_META.settings.label;
    case "welcome":
      return VIEW_META.welcome.label;
  }
}
