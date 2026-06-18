"use client";

// 앱 영역 공유 셸 — 이제 /console(IDE) 단일 화면만 존재한다.
// 대시보드/콘텐츠/아웃바운드/설정/그로스 스튜디오의 별도 흰 페이지와 상단 내비(TopNav)는
// 제거되고, 모든 기능이 콘솔 IDE 안으로 통합됐다(좌 대화 · 중앙 작업 보드 · 우 페르소나 ·
// 액티비티바 뷰). AgentStreamProvider 를 여기서 감싸 SSE 스트림/이벤트/아티팩트 상태가
// 유지되고, 승인 모달은 셸 레벨에서 전역으로 뜬다(fixed z-50, IDE 위 오버레이).

import type { ReactNode } from "react";
import {
  AgentStreamProvider,
  useAgentStreamContext,
} from "@/lib/agent-stream-context";
import { ApprovalModal } from "@/components/ApprovalModal";
import { BoardDocsProvider } from "@/lib/board-docs-context";
import { ProjectFolderProvider } from "@/lib/project-folder-context";
import { EditorDocProvider } from "@/lib/editor-doc-context";
import { ActiveCardProvider } from "@/lib/active-card-context";
import { ActiveWorkflowProvider } from "@/lib/active-workflow-context";
import { WorkflowStoreProvider } from "@/lib/ide/workflow-store";
import { DefEditorProvider } from "@/lib/def-editor-context";

// 전역 승인 게이트 — 컨텍스트의 approval 상태를 셸 레벨에서 모달로 렌더.
function GlobalApprovalModal() {
  const { approval, resolveApproval } = useAgentStreamContext();
  return <ApprovalModal approval={approval} onResolve={resolveApproval} />;
}

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <AgentStreamProvider>
      <BoardDocsProvider>
        <ProjectFolderProvider>
        <EditorDocProvider>
          <WorkflowStoreProvider>
          <DefEditorProvider>
          <ActiveWorkflowProvider>
          <ActiveCardProvider>
            {/* IDE 풀 화면 — children(IDEShell)이 100dvh 를 직접 채운다. */}
            <div className="h-dvh w-full overflow-hidden">{children}</div>
            {/* 승인 모달 오버레이(fixed — 셸 흐름에서 제외). */}
            <GlobalApprovalModal />
          </ActiveCardProvider>
          </ActiveWorkflowProvider>
          </DefEditorProvider>
          </WorkflowStoreProvider>
        </EditorDocProvider>
        </ProjectFolderProvider>
      </BoardDocsProvider>
    </AgentStreamProvider>
  );
}
