"use client";

// components/ide/EditorArea.tsx — 중앙 영역: 자유 배치 작업 보드 + (선택) 풀캔버스 뷰.
//
// "하나의 캔버스" — 파일 탭/.md·.json 파일명/소스(코드)뷰를 모두 걷어내고, 산출물을
// 줌·팬 보드(CanvasBoard) 위 카드로 자유 배치한다. 액티비티바에서 뷰(대시보드/콘텐츠/
// 아웃바운드/설정)를 열면 보드 대신 그 뷰를 풀캔버스로 보여 주고, 상단 바의 "작업 보드"
// 로 돌아온다(탭 없음 — 보드가 홈, 뷰는 일시 오버레이).
//
// 규칙: 상태는 props(events/artifacts/running/openView)에서만 파생. 엔진/SSE 직접 접근 없음.

import { useState } from "react";
import type { AgentEvent, Artifact } from "@/lib/types";
import { CanvasBoard } from "@/components/ide/CanvasBoard";
import { IdeViewHost } from "@/components/ide/IdeViewHost";
import { viewCodicon } from "@/components/ide/fileIcons";
import { VIEW_META, type IdeViewKind } from "@/lib/ide/views";
import { useEditorDoc } from "@/lib/editor-doc-context";
import { useDefEditor } from "@/lib/def-editor-context";
import { useWorkflowStore } from "@/lib/ide/workflow-store";
import { DefinitionEditor } from "@/components/ide/DefinitionEditor";

type ViewKind = Exclude<IdeViewKind, "welcome">;

export interface EditorAreaProps {
  events: AgentEvent[];
  artifacts: Artifact[];
  running: boolean;
  /**
   * 액티비티바 "뷰 열기" 신호. kind = 열 뷰, nonce = 같은 뷰 재클릭 시에도 활성화되도록 증가.
   */
  openView?: { kind: ViewKind; nonce: number } | null;
}

/**
 * 중앙 에디터 — 기본은 작업 보드(CanvasBoard). 액티비티바로 뷰를 열면 풀캔버스 뷰 +
 * 상단 "작업 보드" 복귀 바. 산출물은 보드 카드로만 표현(파일/코드뷰 없음).
 */
export function EditorArea({
  events,
  artifacts,
  running,
  openView = null,
}: EditorAreaProps) {
  // 현재 풀캔버스 뷰(null = 작업 보드).
  const [activeView, setActiveView] = useState<ViewKind | null>(null);

  // 산출물 카드에서 연 원문 문서(있으면 보드/뷰보다 우선해서 풀패널로).
  const { doc, closeDoc } = useEditorDoc();
  // 정의 에디터 — 워크플로/카드 스펙 편집 탭(최우선).
  const { target: defTarget, close: closeDef } = useDefEditor();
  const { getPack } = useWorkflowStore();

  // 액티비티바 "뷰 열기" 신호 처리(렌더 중 nonce 비교 — React 권장 패턴).
  const [prevNonce, setPrevNonce] = useState(0);
  if (openView && openView.nonce !== prevNonce) {
    setPrevNonce(openView.nonce);
    setActiveView(openView.kind);
  }

  return (
    <section
      className="ide-editor flex min-h-0 min-w-0 flex-1 flex-col"
      aria-label="에디터 — 작업 보드"
    >
      {defTarget ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 정의 에디터 탭 바 */}
          <div className="ide-view-bar">
            <i className="codicon codicon-symbol-structure" aria-hidden />
            <span className="ide-view-bar-title">
              워크플로 정의 — {getPack(defTarget.packId)?.label ?? defTarget.packId}
            </span>
            <button type="button" className="ide-view-bar-back" onClick={closeDef}>
              <i className="codicon codicon-arrow-left" aria-hidden />
              작업 보드
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <DefinitionEditor />
          </div>
        </div>
      ) : doc ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 문서 탭 바 — 파일명 + "작업 보드" 복귀(VS Code 탭처럼). */}
          <div className="ide-view-bar">
            <i className="codicon codicon-file" aria-hidden />
            <span className="ide-view-bar-title">{doc.name}</span>
            <button type="button" className="ide-view-bar-back" onClick={closeDoc}>
              <i className="codicon codicon-arrow-left" aria-hidden />
              작업 보드
            </button>
          </div>
          <div className="ide-doc-source min-h-0 flex-1 overflow-auto">
            <pre className="ide-doc-source-pre">{doc.content}</pre>
          </div>
        </div>
      ) : activeView ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 뷰 상단 바 — 제목 + "작업 보드" 복귀(탭 대체). */}
          <div className="ide-view-bar">
            <i
              className={`codicon codicon-${viewCodicon(VIEW_META[activeView].icon)}`}
              aria-hidden
            />
            <span className="ide-view-bar-title">{VIEW_META[activeView].label}</span>
            <button
              type="button"
              className="ide-view-bar-back"
              onClick={() => setActiveView(null)}
            >
              <i className="codicon codicon-arrow-left" aria-hidden />
              작업 보드
            </button>
          </div>
          <IdeViewHost key={activeView} kind={activeView} />
        </div>
      ) : (
        <CanvasBoard events={events} artifacts={artifacts} running={running} />
      )}
    </section>
  );
}
