"use client";

// octopus 에이전트 콘솔 (/console) — VS Code "Dark Modern" IDE 셸 위에서 돌아가는 핵심 화면.
//
// 노드 캔버스 구조를 전부 걷어내고, VS Code 룩앤필(포크/Electron/monaco 아님)로 재현한 IDE 로 교체했다:
//   · 좌 사이드패널 = Claude Code 풍 대화(ChatPanel) — 여기에 지시하면 모든 작업이 처리된다.
//   · 중앙 에디터 = 작업 산출물 탭/문서뷰(EditorArea) — 작업 중인 상황이 가운데에서 보인다.
//   · 우 사이드패널 = 멀티 에이전트 페르소나 스택(PersonaRail) — 누가 무슨 일을 하는지 쌓인다.
//   · 하단 패널 = 터미널/실행 로그(Terminal) — 도구 실행이 한 줄씩 흐른다.
//   · 상태바 = 모드(LIVE/REPLAY/IDLE)·도구 수·발송·시나리오 — 좌/우 그룹(codicon).
//   · 명령 팔레트(⌘P 빠른 열기 / ⌘⇧P 명령) — 산출물/뷰 열기·리플레이·패널 토글.
// 셸 프레임은 IDEShell 이 잡고(리사이즈/접기/팔레트), 슬롯은 콘솔이 주입한다.
//
// 스트림 상태는 useAgentStreamContext 공유 — 페이지를 떠나도 실행이 끊기지 않는다.
// 승인 모달은 셸 레이아웃(app/(app)/layout.tsx)의 전역 ApprovalModal 이 담당(fixed z-50, IDE 위 오버레이).
// 다크 테마는 .ide 래퍼에만 스코프된다(IDEShell 내부) — 다른 페이지는 흰 미니멀 그대로.

import { useEffect, useMemo, useRef, useState } from "react";
import { IDEShell } from "@/components/ide/IDEShell";
import type { CommandItem } from "@/components/ide/CommandPalette";
import { ChatPanel } from "@/components/ide/ChatPanel";
import { useBtlOrchestrator } from "@/lib/use-btl-orchestrator";
import { useWorkflowLoader } from "@/lib/use-workflow-loader";
import { FolderPanel } from "@/components/ide/FolderPanel";
import { WorkflowDefPanel } from "@/components/ide/WorkflowDefPanel";
import { EditorArea } from "@/components/ide/EditorArea";
import { PersonaRail } from "@/components/ide/PersonaRail";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import { ARTIFACT_LABELS } from "@/components/AgentFeed";
import type { ScenarioInfo } from "@/lib/types";
import {
  artifactToFile,
  VIEW_META,
  VIEW_TAB_ORDER,
  type IdeViewKind,
} from "@/lib/ide/views";

// artifactToFile 의 언어 → codicon 글리프(팔레트 좌측 파일 아이콘).
function fileIcon(language: "markdown" | "json" | "plaintext"): string {
  return language === "markdown"
    ? "markdown"
    : language === "json"
      ? "json"
      : "file";
}

// 뷰 아이콘 키 → codicon 글리프(팔레트/명령 좌측 아이콘).
const VIEW_ICON: Record<IdeViewKind, string> = {
  welcome: "star",
  workflow: "list-tree",
  dashboard: "graph",
  content: "device-camera",
  outbound: "send",
  settings: "settings-gear",
};

export default function ConsolePage() {
  const {
    events,
    artifacts,
    streamingText,
    running,
    mode,
    start,
    startReplay,
  } = useAgentStreamContext();

  // 활성 시나리오 — 상태바 표시용 (로딩 전 null)
  const [scenario, setScenario] = useState<ScenarioInfo | null>(null);
  useEffect(() => {
    fetch("/api/scenario")
      .then((r) => r.json())
      .then(setScenario)
      .catch(() => {});
  }, []);

  // BTL: 채팅 = 보드 오케스트레이터(손으로 하는 동작을 대화로). 그 외 시나리오는 기존 엔진.
  const { sendBtl, attachFile } = useBtlOrchestrator();
  const onChatSend = scenario?.id === "C-btl" ? sendBtl : start;
  const onChatAttach = scenario?.id === "C-btl" ? attachFile : undefined;
  // 채팅 컴포저의 워크플로 칩 — 손(워크플로 탭)과 동일하게 채팅에서도 워크플로 로드(빈 카드 시드).
  const { packs, packId, loadWorkflow } = useWorkflowLoader();
  const chatWorkflow = scenario?.id === "C-btl"
    ? { options: packs.filter((p) => p.available).map((p) => ({ id: p.id, label: p.label })), current: packId, onLoad: loadWorkflow }
    : undefined;

  // 랜딩 '골든런 리플레이 보기' → /console?replay=1 — 마운트 시 리플레이 자동 시작.
  // (lib/agent·api 무수정 — window.location 으로 처리, useSearchParams Suspense 요구 회피)
  const replayTriggeredRef = useRef(false);
  useEffect(() => {
    if (replayTriggeredRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("replay") === "1") {
      replayTriggeredRef.current = true;
      startReplay(1);
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 액티비티바 → EditorArea 뷰 열기 신호.
  // nonce 는 같은 뷰를 다시 눌러도 활성화(재포커스)되도록 매 클릭 증가시킨다.
  const [openView, setOpenView] = useState<{
    kind: Exclude<IdeViewKind, "welcome">;
    nonce: number;
  } | null>(null);
  const handleOpenView = (kind: Exclude<IdeViewKind, "welcome">) => {
    setOpenView((prev) => ({ kind, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  // ── 명령 팔레트: 빠른 열기(⌘P) 대상 "파일"(산출물 + 뷰) ──
  const paletteFiles = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];
    // 화면(대시보드/콘텐츠/아웃바운드/설정) — 친근한 한국어 라벨로 노출(파일명/확장자 대신).
    for (const kind of VIEW_TAB_ORDER) {
      const meta = VIEW_META[kind];
      items.push({
        id: `file:view:${kind}`,
        label: meta.label,
        icon: VIEW_ICON[kind] ?? "file",
        meta: "화면",
        keywords: `${meta.label} ${meta.filename} ${kind} view 화면`,
        run: () => handleOpenView(kind as Exclude<IdeViewKind, "welcome">),
      });
    }
    // 산출물 — kind별 최신본(중복 제거). 라벨은 친근한 산출물 이름.
    const seen = new Set<string>();
    for (const a of artifacts) {
      if (seen.has(a.kind)) continue;
      seen.add(a.kind);
      items.push({
        id: `file:artifact:${a.kind}`,
        label: ARTIFACT_LABELS[a.kind],
        icon: fileIcon(artifactToFile(a).language),
        meta: "산출물",
        keywords: `${ARTIFACT_LABELS[a.kind]} ${a.kind} artifact 산출물`,
        // 산출물은 자체적으로 최신본이 활성화되므로, 채팅/리플레이로 생성된 탭을 따라간다.
        // 여기서는 해당 산출물이 이미 에디터에 떠 있으니 별도 동작 없이 닫기만 한다.
        run: () => {},
      });
    }
    return items;
  }, [artifacts]);

  // ── 명령 팔레트: 명령(⌘⇧P) — 리플레이/뷰 열기/프리셋 ──
  const paletteCommands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = [
      {
        id: "cmd:replay",
        label: "골든런 리플레이 실행",
        icon: "debug-start",
        meta: "실행",
        keywords: "replay golden run 리플레이 재생 골든런",
        run: () => {
          if (!running) startReplay(1);
        },
      },
      {
        id: "cmd:replay-fast",
        label: "골든런 리플레이 (2배속)",
        icon: "debug-start",
        meta: "실행",
        keywords: "replay fast 2x 빠르게 리플레이",
        run: () => {
          if (!running) startReplay(2);
        },
      },
    ];
    // 뷰 열기 명령(대시보드/콘텐츠/아웃바운드/설정).
    for (const kind of VIEW_TAB_ORDER) {
      const meta = VIEW_META[kind];
      cmds.push({
        id: `cmd:open:${kind}`,
        label: `뷰 열기: ${meta.label}`,
        icon: VIEW_ICON[kind] ?? "file",
        meta: "보기",
        keywords: `open view ${meta.label} ${kind} 뷰 열기`,
        run: () => handleOpenView(kind as Exclude<IdeViewKind, "welcome">),
      });
    }
    // 프리셋 지시 — 채팅을 거치지 않고 바로 라이브 실행(실행 중이 아닐 때만).
    const presets: { label: string; prompt: string }[] = [
      {
        label: "이번 주 인스타 콘텐츠 3개 초안",
        prompt: "이번 주 인스타 콘텐츠 3개 초안 만들어줘",
      },
      {
        label: "성과 지표 브리핑 만들기",
        prompt: "이번 주 성과 지표를 브리핑으로 정리해줘",
      },
      {
        label: "콜드메일 시퀀스 작성",
        prompt: "타겟 리드 대상 콜드메일 시퀀스를 작성해줘",
      },
    ];
    for (const p of presets) {
      cmds.push({
        id: `cmd:preset:${p.label}`,
        label: `지시: ${p.label}`,
        icon: "comment-discussion",
        meta: "에이전트",
        keywords: `${p.label} ${p.prompt} 지시 명령 preset`,
        run: () => {
          if (!running) start(p.prompt);
        },
      });
    }
    return cmds;
  }, [running, start, startReplay]);

  // 상태바 — 파란 바가 떠 있는 동안엔 "진행(progress) + 실행 모드(LIVE/REPLAY)"만 남긴다.
  const statusLeft = (
    <span className="ide-status-item ide-mono" title="실행 상태">
      <span className="ide-spinner" style={{ fontSize: 11 }} aria-hidden />
      {mode === "replay" ? "REPLAY" : "LIVE"}
    </span>
  );

  const statusRight = null;

  return (
    <IDEShell
      busy={running}
      onOpenView={handleOpenView}
      paletteFiles={paletteFiles}
      paletteCommands={paletteCommands}
      leftPanel={
        <ChatPanel
          events={events}
          streamingText={streamingText}
          running={running}
          onSend={onChatSend}
          onAttach={onChatAttach}
          workflow={chatWorkflow}
        />
      }
      explorerPanel={<FolderPanel />}
      defPanel={<WorkflowDefPanel />}
      editor={
        <EditorArea
          events={events}
          artifacts={artifacts}
          running={running}
          openView={openView}
        />
      }
      rightPanel={<PersonaRail onRun={onChatSend} running={running} />}
      statusLeft={statusLeft}
      statusRight={statusRight}
    />
  );
}
