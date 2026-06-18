"use client";

// components/ide/IDEShell.tsx — VS Code "Dark Modern" 풍 IDE 셸(상단 타이틀바 제거판).
//   액티비티바 48px(MUI 아이콘 18px, 활성 시 좌측 2px 흰 인디케이터) · 좌(탐색기/대화/워크플로)
//   · 중앙 에디터 · 하단 패널(터미널) · 우 페르소나 · 상태바(실행 중에만 블루로 슬라이드).
// 다크 테마는 최상위 .ide 래퍼 안에만 스코프된다(globals.css). 기능 아이콘은 MUI(muiIcons).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CommandPalette, type CommandItem } from "@/components/ide/CommandPalette";
import {
  ChatIcon,
  ExplorerIcon,
  WorkflowIcon,
  QuickOpenIcon,
  ViewIcon,
  PersonaIcon,
  SettingsIcon,
  TerminalIcon,
  ChevronDownIcon,
} from "@/components/ide/muiIcons";
import type { IdeViewKind } from "@/lib/ide/views";
import { LeftPanelProvider } from "@/lib/left-panel-context";

/** 액티비티바 항목 — 좌측 아이콘 스트립의 한 칸. */
export interface IDEActivityItem {
  id: string;
  icon: string;
  label: string;
  badge?: number;
}

export interface IDEShellProps {
  /** 좌 사이드패널 슬롯 — 자체 .ide-sidebar 크롬 포함(ChatPanel). */
  leftPanel: ReactNode;
  /** 좌 사이드패널 탐색기 뷰(폴더) — 액티비티바 '탐색기'로 채팅 대신 표시. */
  explorerPanel?: ReactNode;
  /** 좌 사이드패널 워크플로 정의 뷰 — 카드/워크플로 스펙 인스펙터. */
  defPanel?: ReactNode;
  /** 중앙 에디터 영역(탭 + 작업뷰). */
  editor: ReactNode;
  /** 우 사이드패널(페르소나 스택). */
  rightPanel: ReactNode;
  /** 하단 패널 본문(.ide-panel-body). 없으면 하단 패널 자체를 렌더하지 않는다. */
  bottomPanel?: ReactNode;
  bottomTitle?: string;
  bottomActions?: ReactNode;
  /** 상태바 좌측 그룹 항목들. */
  statusLeft?: ReactNode;
  /** 상태바 우측 그룹 항목들. */
  statusRight?: ReactNode;
  /** 실행 중이면 상태바를 블루로 강조 + 슬라이드 표시. */
  busy?: boolean;
  onOpenView?: (kind: Exclude<IdeViewKind, "welcome">) => void;
  paletteFiles?: CommandItem[];
  paletteCommands?: CommandItem[];
}

// 패널 폭/높이 범위(px) — 리사이즈 클램프.
const LEFT_MIN = 240;
const LEFT_MAX = 520;
const RIGHT_MIN = 220;
const RIGHT_MAX = 460;
const BOTTOM_MIN = 90;
const BOTTOM_MAX = 460;

export function IDEShell({
  leftPanel,
  explorerPanel,
  defPanel,
  editor,
  rightPanel,
  bottomPanel,
  bottomTitle = "터미널",
  bottomActions,
  statusLeft,
  statusRight,
  busy = false,
  onOpenView,
  paletteFiles = [],
  paletteCommands = [],
}: IDEShellProps) {
  // ── 패널 접힘 ──
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);

  // ── 좌 사이드바 모드(탐색기/대화/워크플로) ──
  const [leftActive, setLeftActive] = useState<"chat" | "explorer" | "workflow">("explorer");

  // ── 패널 치수(px) ──
  const [leftW, setLeftW] = useState(380);
  const [rightW, setRightW] = useState(300);
  const [bottomH, setBottomH] = useState(160);

  // ── 명령 팔레트 ──
  const [palette, setPalette] = useState<{ mode: "files" | "commands" } | null>(
    null,
  );

  // ── 포인터 드래그 리사이즈 (새 의존성 없이) ──
  const dragRef = useRef<{
    kind: "left" | "right" | "bottom";
    startPos: number;
    startSize: number;
  } | null>(null);
  const sizeRef = useRef({ leftW, rightW, bottomH });
  useEffect(() => {
    sizeRef.current = { leftW, rightW, bottomH };
  }, [leftW, rightW, bottomH]);
  const [dragging, setDragging] = useState<"left" | "right" | "bottom" | null>(
    null,
  );

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "left") {
      const delta = e.clientX - drag.startPos;
      setLeftW(Math.min(LEFT_MAX, Math.max(LEFT_MIN, drag.startSize + delta)));
    } else if (drag.kind === "right") {
      const delta = drag.startPos - e.clientX;
      setRightW(
        Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, drag.startSize + delta)),
      );
    } else {
      const delta = drag.startPos - e.clientY;
      setBottomH(
        Math.min(BOTTOM_MAX, Math.max(BOTTOM_MIN, drag.startSize + delta)),
      );
    }
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDragging(null);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor =
      dragging === "bottom" ? "row-resize" : "col-resize";
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [dragging, onPointerMove, endDrag]);

  const startDrag = useCallback(
    (kind: "left" | "right" | "bottom") => (e: React.PointerEvent) => {
      e.preventDefault();
      const { leftW: lw, rightW: rw, bottomH: bh } = sizeRef.current;
      dragRef.current = {
        kind,
        startPos: kind === "bottom" ? e.clientY : e.clientX,
        startSize: kind === "left" ? lw : kind === "right" ? rw : bh,
      };
      setDragging(kind);
    },
    [],
  );

  // ── 명령 팔레트 키바인딩(⌘P 빠른 열기 / ⌘⇧P 명령) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setPalette({ mode: e.shiftKey ? "commands" : "files" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 셸이 항상 제공하는 패널 토글 명령(콘솔 명령 위에 합쳐 노출).
  const shellCommands: CommandItem[] = [
    {
      id: "cmd:toggle-left",
      label: leftCollapsed ? "기본 사이드바 표시" : "기본 사이드바 숨기기",
      icon: "layout-sidebar-left",
      meta: "보기",
      keywords: "sidebar 사이드바 대화 채팅 chat toggle 토글",
      run: () => setLeftCollapsed((v) => !v),
    },
    {
      id: "cmd:toggle-right",
      label: rightCollapsed ? "보조 사이드바 표시" : "보조 사이드바 숨기기",
      icon: "layout-sidebar-right",
      meta: "보기",
      keywords: "secondary sidebar persona 페르소나 에이전트 toggle 토글",
      run: () => setRightCollapsed((v) => !v),
    },
    {
      id: "cmd:toggle-panel",
      label: bottomCollapsed ? "패널 표시 (터미널)" : "패널 숨기기 (터미널)",
      icon: "layout-panel",
      meta: "보기",
      keywords: "panel terminal 터미널 패널 toggle 토글",
      run: () => setBottomCollapsed((v) => !v),
    },
  ];

  const allCommands = [...paletteCommands, ...shellCommands];

  // 보드 카드 → 좌 패널 전환(논의 시작 시 채팅을 다시 보여줌).
  const leftPanelValue = useMemo(
    () => ({ showChat: () => { setLeftActive("chat"); setLeftCollapsed(false); } }),
    [],
  );

  return (
    <LeftPanelProvider value={leftPanelValue}>
    <div className="ide ide-shell ide-fade-in">
      {/* ── 본문 (액티비티바 | 좌 | 에디터+하단 | 우) — 상단 타이틀바 제거됨 ── */}
      <div className="ide-body">
        {/* 액티비티바 48px — 상단 그룹 + 하단 그룹. 활성 시 좌측 2px 흰 인디케이터. */}
        <nav className="ide-activitybar" aria-label="액티비티바">
          {/* 탐색기 — 좌 패널을 폴더(탐색기) 뷰로 전환. */}
          <button
            type="button"
            className={`ide-act-item ${!leftCollapsed && leftActive === "explorer" ? "active" : ""}`}
            aria-pressed={!leftCollapsed}
            aria-label="탐색기"
            title="탐색기 — 작업 폴더 열기"
            onClick={() => {
              if (leftActive === "explorer") setLeftCollapsed((v) => !v);
              else { setLeftActive("explorer"); setLeftCollapsed(false); }
            }}
          >
            <ExplorerIcon aria-hidden />
          </button>
          {/* 대화(Claude) — 산출물을 담당 페르소나와 논의. */}
          <button
            type="button"
            className={`ide-act-item ${!leftCollapsed && leftActive === "chat" ? "active" : ""}`}
            aria-pressed={!leftCollapsed}
            aria-label="Claude — 대화"
            title="Claude — 대화"
            onClick={() => {
              if (leftActive === "chat") setLeftCollapsed((v) => !v);
              else { setLeftActive("chat"); setLeftCollapsed(false); }
            }}
          >
            <ChatIcon aria-hidden />
          </button>
          {/* 워크플로 정의 — 카드/워크플로 스펙 인스펙터. */}
          {defPanel && (
            <button
              type="button"
              className={`ide-act-item ${!leftCollapsed && leftActive === "workflow" ? "active" : ""}`}
              aria-pressed={!leftCollapsed}
              aria-label="워크플로 정의"
              title="워크플로 정의 — 카드 스펙"
              onClick={() => {
                if (leftActive === "workflow") setLeftCollapsed((v) => !v);
                else { setLeftActive("workflow"); setLeftCollapsed(false); }
              }}
            >
              <WorkflowIcon aria-hidden />
            </button>
          )}
          {/* 빠른 열기 — 명령 팔레트(⌘P)로 산출물/뷰 검색. */}
          <button
            type="button"
            className="ide-act-item"
            aria-label="빠른 열기"
            title="빠른 열기 (⌘P)"
            onClick={() => setPalette({ mode: "files" })}
          >
            <QuickOpenIcon aria-hidden />
          </button>

          {/* 구분선 — 뷰 그룹. */}
          <span
            aria-hidden
            style={{
              width: 22,
              height: 1,
              margin: "6px auto",
              background: "var(--ide-border)",
            }}
          />

          {/* 뷰 탭 — IDE 에디터 탭으로 연다. */}
          <button
            type="button"
            className="ide-act-item"
            aria-label="대시보드 탭 열기"
            title="대시보드 — 성과 지표"
            onClick={() => onOpenView?.("dashboard")}
          >
            <ViewIcon kind="dashboard" aria-hidden />
          </button>
          <button
            type="button"
            className="ide-act-item"
            aria-label="콘텐츠 탭 열기"
            title="콘텐츠 — 스튜디오"
            onClick={() => onOpenView?.("content")}
          >
            <ViewIcon kind="content" aria-hidden />
          </button>
          <button
            type="button"
            className="ide-act-item"
            aria-label="아웃바운드 탭 열기"
            title="아웃바운드 — 파이프라인"
            onClick={() => onOpenView?.("outbound")}
          >
            <ViewIcon kind="outbound" aria-hidden />
          </button>

          <span className="ide-activity-spacer" />

          {/* 하단 그룹 — 에이전트(페르소나) 우 패널 토글 + 설정. */}
          <button
            type="button"
            className={`ide-act-item ${!rightCollapsed ? "active" : ""}`}
            aria-pressed={!rightCollapsed}
            aria-label="에이전트 — 페르소나"
            title="에이전트 — 페르소나"
            onClick={() => setRightCollapsed((v) => !v)}
          >
            <PersonaIcon aria-hidden />
          </button>
          <button
            type="button"
            className="ide-act-item"
            aria-label="설정 탭 열기"
            title="설정"
            onClick={() => onOpenView?.("settings")}
          >
            <SettingsIcon aria-hidden />
          </button>
        </nav>

        {/* 좌 사이드패널 (접힘 가능) */}
        {!leftCollapsed && (
          <>
            <div
              className="flex min-h-0 flex-col [&>*]:min-h-0 [&>*]:flex-1"
              style={{ width: leftW, flexShrink: 0 }}
            >
              <div style={{ display: leftActive === "chat" ? undefined : "none" }} className="flex min-h-0 flex-col">
                {leftPanel}
              </div>
              {explorerPanel && (
                <div style={{ display: leftActive === "explorer" ? undefined : "none" }} className="flex min-h-0 flex-col">
                  {explorerPanel}
                </div>
              )}
              {defPanel && (
                <div style={{ display: leftActive === "workflow" ? undefined : "none" }} className="flex min-h-0 flex-col">
                  {defPanel}
                </div>
              )}
            </div>
            <div
              className={`ide-resizer ide-resizer--col ${dragging === "left" ? "dragging" : ""}`}
              onPointerDown={startDrag("left")}
              role="separator"
              aria-orientation="vertical"
              aria-label="좌측 패널 크기 조절"
            />
          </>
        )}

        {/* 중앙 + 하단(세로 스택) */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {editor}

          {bottomPanel && !bottomCollapsed && (
            <>
              <div
                className={`ide-resizer ide-resizer--row ${dragging === "bottom" ? "dragging" : ""}`}
                onPointerDown={startDrag("bottom")}
                role="separator"
                aria-orientation="horizontal"
                aria-label="하단 패널 크기 조절"
              />
              <div
                className="ide-panel"
                style={{ height: bottomH, flexShrink: 0 }}
              >
                <div className="ide-panel-tabs" role="tablist" aria-label="패널">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={true}
                    className="ide-panel-tab active"
                  >
                    <TerminalIcon aria-hidden />
                    {bottomTitle}
                  </button>
                  <span className="ide-panel-actions">
                    {bottomActions}
                    <button
                      type="button"
                      className="ide-icon-btn"
                      aria-label="하단 패널 접기"
                      title="하단 패널 접기"
                      onClick={() => setBottomCollapsed(true)}
                    >
                      <ChevronDownIcon aria-hidden />
                    </button>
                  </span>
                </div>
                {bottomPanel}
              </div>
            </>
          )}
        </div>

        {/* 우 사이드패널 (접힘 가능) */}
        {!rightCollapsed && (
          <>
            <div
              className={`ide-resizer ide-resizer--col ${dragging === "right" ? "dragging" : ""}`}
              onPointerDown={startDrag("right")}
              role="separator"
              aria-orientation="vertical"
              aria-label="우측 패널 크기 조절"
            />
            <div
              className="flex min-h-0 flex-col [&>*]:min-h-0 [&>*]:flex-1"
              style={{ width: rightW, flexShrink: 0 }}
            >
              {rightPanel}
            </div>
          </>
        )}
      </div>

      {/* ── 상태바: 평소 숨김(슬라이드 다운), 실행 중(busy)에만 블루로. progress+모드만. ── */}
      <div
        className={`ide-statusbar ${busy ? "ide-statusbar--busy" : "ide-statusbar--hidden"}`}
        aria-hidden={!busy}
      >
        <span className="ide-status-left">{statusLeft}</span>
        <span className="ide-status-right">{statusRight}</span>
      </div>

      {/* ── 명령 팔레트(⌘P / ⌘⇧P) ── */}
      <CommandPalette
        open={palette !== null}
        initialMode={palette?.mode ?? "files"}
        files={paletteFiles}
        commands={allCommands}
        onClose={() => setPalette(null)}
      />
    </div>
    </LeftPanelProvider>
  );
}
