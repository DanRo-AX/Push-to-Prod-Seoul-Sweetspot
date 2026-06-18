"use client";

// components/ide/ChatPanel.tsx — IDE 좌측 사이드패널: VS Code Copilot Chat 풍 대화 에이전트.
//
// VS Code 의 좌 사이드패널(.ide-sidebar--left) 자리에 들어가는 메인 입력 채널.
// "여기에 대화하면 모든 작업이 처리된다" — onSend 로 라이브 실행을 띄우고,
// 진행 상황(발화·도구 스텝)을 좁은 폭에 맞춰 컴팩트하게 보여 준다.
// 결과물 본문은 중앙 에디터(WorkView)가 렌더하므로, 챗에선 슬림 참조 라인만 남긴다.
//
// 구성(VS Code 사이드바 정통 톤):
//   ┌ 뷰 타이틀(.ide-side-title, 35px) — "채팅"
//   ├ 섹션 헤더(.ide-side-header, 22px 11px 대문자) — codicon + "OCTOPUS 에이전트" + 상태
//   │ 본문 — AgentFeed(compact) : 대화 + 인라인 도구 스텝, 자동 스크롤
//   └ 푸터 — ChatInput : 명령 입력(IME/Enter/Shift+Enter/disabled 보존)
//
// 다크 톤 처리:
//   AgentFeed/ChatInput 은 화이트 페이지용 토큰(--text-1/--accent/--bg-1 …) 기반이다.
//   이 패널의 .chat-panel-scope 래퍼에서 그 토큰들을 .ide 다크 팔레트(--ide-*)로
//   리맵(CSS 변수 재정의)해, 컴포넌트를 건드리지 않고 VS Code Dark Modern 톤으로 그린다.
//   (globals.css 무수정 — 리맵은 인라인 style 의 CSS 커스텀 프로퍼티로만.)
//   액센트는 VS Code 정통 블루(--ide-accent #0078d4)로 매핑한다(흉내 티 제거).
//
// 상태 소스: 기본은 useAgentStreamContext(페이지 이동에도 스트림 유지).
// 단, 합성/테스트를 위해 props 로 events/streamingText/running/onSend 를 주입할 수도 있다.

import { type CSSProperties } from "react";
import { AgentFeed } from "@/components/AgentFeed";
import { ChatInput } from "@/components/ChatInput";
import { Logo } from "@/components/Logo";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import type { AgentEvent, ChatInputProps } from "@/lib/types";

// AgentFeed/ChatInput 의 화이트 토큰 → IDE 다크(--ide-*) 리맵.
// 이 래퍼 자손에서만 적용되므로 다른 페이지의 흰 미니멀 테마는 그대로다.
// (값 하드코딩 금지 — 모두 var(--ide-*) 로만 매핑. 액센트 = VS Code 블루.)
const CHAT_DARK_VARS: CSSProperties = {
  // 표면
  "--bg-0": "var(--ide-bg-alt)",
  "--bg-1": "var(--ide-bg-alt)",
  "--bg-2": "var(--ide-elevated)",
  "--bg-3": "var(--ide-bg-alt)",
  "--bg-raised": "var(--ide-elevated)",
  "--bg-inset": "var(--ide-elevated)",
  // 보더
  "--line-1": "var(--ide-border-strong)",
  "--line-2": "var(--ide-border)",
  "--line-strong": "var(--ide-border-strong)",
  // 액센트 — VS Code Dark Modern 블루(#0078d4) 정통 매핑.
  "--accent": "var(--ide-accent)",
  "--accent-hover": "var(--ide-accent-hover)",
  "--accent-tint": "var(--ide-progress-dim)",
  "--accent-bright": "var(--ide-accent-bright)",
  "--accent-dim": "var(--ide-progress-dim)",
  "--accent-glow": "var(--ide-progress-dim)",
  // 상태색 — IDE 톤
  "--ok": "var(--ide-ok)",
  "--ok-dim": "rgba(78, 201, 176, 0.16)",
  "--ok-glow": "rgba(78, 201, 176, 0.16)",
  "--warn": "var(--ide-warn)",
  "--warn-dim": "rgba(204, 167, 0, 0.18)",
  "--danger": "var(--ide-danger)",
  "--danger-dim": "rgba(241, 76, 76, 0.16)",
  // 텍스트 3단계
  "--ink": "var(--ide-text-strong)",
  "--text-1": "var(--ide-text)",
  "--text-2": "var(--ide-text-dim)",
  "--text-3": "var(--ide-text-faint)",
} as CSSProperties;

interface ChatPanelProps {
  // 합성/테스트용 주입 — 미지정 시 useAgentStreamContext 에서 파생.
  events?: AgentEvent[];
  streamingText?: string;
  running?: boolean;
  onSend?: (text: string) => void;
  onAttach?: (file: File) => void;
  workflow?: ChatInputProps["workflow"];
}

/** 섹션 헤더 상태 — 실행 중이면 sync(spin) + "실행 중", 대기면 채워진 점 + "대기". */
function HeaderStatus({ running }: { running: boolean }) {
  return (
    <span className="ide-sidebar-actions items-center gap-1.5">
      {running ? (
        <>
          <i
            className="codicon codicon-loading codicon-modifier-spin"
            style={{ fontSize: 12, color: "var(--ide-progress)" }}
            aria-hidden
          />
          <span className="ide-mono text-[10px]" style={{ color: "var(--ide-progress)" }}>
            실행 중
          </span>
        </>
      ) : (
        <>
          <i
            className="codicon codicon-circle-filled"
            style={{ fontSize: 9, color: "var(--ide-ok)" }}
            aria-hidden
          />
          <span className="ide-mono text-[10px]" style={{ color: "var(--ide-text-dim)" }}>
            대기
          </span>
        </>
      )}
    </span>
  );
}

// 빈 상태 추천 프롬프트 — 클릭 시 그대로 start() 로 실행되는 한국어 칩.
// (codicon 앞글리프로 작업 성격을 암시 — 비기능 장식 아님, 실제 실행 프롬프트)
const SUGGESTIONS: { icon: string; text: string }[] = [
  { icon: "sparkle", text: "오늘 아침 브리핑 만들어줘" },
  { icon: "graph", text: "이번 주 성과 지표 정리해줘" },
  { icon: "device-camera", text: "인스타 카드뉴스 캐러셀 만들어줘 (이미지까지)" },
  { icon: "send", text: "잠재고객 콜드메일 초안 잡아줘" },
];

/** 빈 상태 그리팅 — Claude Code / Cursor 풍(짧은 인사 + 추천 프롬프트 칩).
 *  추천 칩을 누르면 그 문구로 바로 실행(onSend). */
function ChatGreeting({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  return (
    <div className="chat-greeting">
      <span className="chat-greeting-avatar" aria-hidden>
        <Logo withWordmark={false} className="text-[15px]" />
      </span>
      <p className="chat-greeting-title">무엇을 도와드릴까요?</p>
      <p className="chat-greeting-sub">
        여기에 지시하면 리서치·분석·콘텐츠·아웃리치까지 에이전트 팀이 함께
        처리합니다. 진행 상황은 가운데 에디터, 담당 에이전트는 우측 패널에서
        확인하세요.
      </p>

      <div className="chat-suggest">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            type="button"
            className="chat-suggest-chip"
            disabled={disabled}
            onClick={() => onSend(s.text)}
          >
            <i className={`codicon codicon-${s.icon}`} aria-hidden />
            {s.text}
          </button>
        ))}
      </div>

      <p
        className="ide-mono flex items-center gap-1.5 text-[11px] leading-relaxed"
        style={{ color: "var(--ide-text-faint)" }}
      >
        <i className="codicon codicon-shield" style={{ fontSize: 12 }} aria-hidden />
        메일 발송 전에는 항상 사람의 승인을 거칩니다.
      </p>
    </div>
  );
}

export function ChatPanel(props: ChatPanelProps) {
  const ctx = useAgentStreamContext();

  // props 주입이 있으면 우선, 없으면 컨텍스트에서 파생.
  const events = props.events ?? ctx.events;
  const streamingText = props.streamingText ?? ctx.streamingText;
  const running = props.running ?? ctx.running;
  const onSend = props.onSend ?? ctx.start;

  return (
    <div
      className="ide-sidebar ide-sidebar--left chat-panel-scope"
      style={CHAT_DARK_VARS}
    >
      {/* 뷰 타이틀(35px) — VS Code 사이드바 최상단 뷰 제목. */}
      <div className="ide-side-title">
        <span>채팅</span>
      </div>

      {/* 섹션 헤더(22px, 11px 대문자) — codicon + 뷰 라벨 + 상태. Copilot Chat 톤. */}
      <div className="ide-side-header">
        <i className="codicon codicon-comment-discussion" aria-hidden />
        <span>octopus 에이전트</span>
        <HeaderStatus running={running} />
      </div>

      {/* 본문 — 컴팩트 대화 피드(자동 스크롤은 AgentFeed 내부). */}
      <div className="flex min-h-0 flex-1 flex-col">
        <AgentFeed
          events={events}
          streamingText={streamingText}
          running={running}
          compact
          greeting={<ChatGreeting onSend={onSend} disabled={running} />}
        />
      </div>

      {/* 푸터 — 명령 입력바. 실행 중에는 disabled(중복 실행 방지). */}
      <div
        className="shrink-0 px-3 pb-3 pt-2"
        style={{ borderTop: "1px solid var(--ide-border)" }}
      >
        <ChatInput onSend={onSend} disabled={running} onAttach={props.onAttach} workflow={props.workflow} />
      </div>
    </div>
  );
}
