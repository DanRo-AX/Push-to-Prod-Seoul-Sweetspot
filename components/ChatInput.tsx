"use client";

// 하단 컴포저 — Cursor / Claude Code 풍 입력창.
// .chat-composer (globals.css, .ide 스코프) 기반: 둥근 다크 입력 박스 + 하단 칩 행 + 우측 전송 버튼.
//   - 입력 영역: .chat-composer-input textarea (scrollHeight 기반 auto-grow, 최대 ~6줄).
//   - 칩 바(.chat-composer-bar): 모드 칩("Agent" + 드롭다운 캐럿 — 비기능 표시),
//     모델 칩("claude-opus-4-8"), 컨텍스트 칩("@<brandName>" — /api/scenario 에서, 없으면 생략).
//   - 전송: .chat-send (codicon send). 보낼 내용 있을 때만 .is-active 로 블루 활성.
//   - 힌트: .chat-composer-hint (Enter 전송 · Shift+Enter 줄바꿈).
// ChatInput 은 ChatPanel(.ide 다크 스코프) 안에서만 사용된다. 혹시 화이트 페이지에서
// 재사용되더라도 .chat-* 클래스는 .ide 스코프라 스타일이 적용되지 않을 뿐 구조는 안전하다.
// Enter 전송, Shift+Enter 줄바꿈, 한글 IME 조합 중 전송 방지 로직은 그대로 유지.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ChatInputProps, ScenarioInfo } from "@/lib/types";

// auto-grow 상한 — line-height 1.5 × 13.5px ≈ 20.3px/줄 + 패딩 → 약 6줄 (CSS max-height 168px 와 동기)
const MAX_GROW_PX = 168;

// 모델 칩 라벨 — CLAUDE.md 규칙상 고정 모델.
const MODEL_LABEL = "claude-opus-4-8";

/** 전송 글리프 — codicon send. (codicon 폰트는 .ide 에서 로드됨) */
function SendGlyph() {
  return <i className="codicon codicon-send" aria-hidden />;
}

export function ChatInput({ onSend, disabled, onAttach, workflow }: ChatInputProps) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 컨텍스트 칩용 브랜드명 — /api/scenario 의 brandName (TopNav 와 동일 패턴). 없으면 칩 생략.
  const [brandName, setBrandName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/scenario")
      .then((r) => r.json())
      .then((info: ScenarioInfo) => {
        if (alive) setBrandName(info?.brandName ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 입력량에 맞춰 높이 재계산 — 전송 후 비워질 때도 원래 높이로 복귀
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_GROW_PX)}px`;
  }, [text]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME 조합 중(한글 입력 등)에는 Enter 전송 금지
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = !disabled && text.trim().length > 0;

  return (
    <div>
      {/* Cursor 풍 컴포저 — 둥근 다크 박스. focus-within 시 블루 보더(CSS). */}
      <div className="chat-composer">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={
            disabled
              ? "에이전트가 작업 중입니다…"
              : "에이전트에게 업무를 지시하세요"
          }
          className="chat-composer-input"
        />

        {/* 하단 칩 바 — 첨부 + 모드/모델/컨텍스트 칩(비기능 표시) + 우측 전송 버튼. */}
        <div className="chat-composer-bar">
          {/* 파일 첨부 — onAttach 있을 때만(예: BTL 시나리오 RFP 분석). */}
          {onAttach && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onAttach(f);
                  e.target.value = ""; // 같은 파일 재첨부 허용
                }}
              />
              <button
                type="button"
                className="chat-chip chat-chip--attach btn-press"
                onClick={() => fileRef.current?.click()}
                disabled={disabled}
                title="파일 첨부 — RFP 등 문서를 분석"
                aria-label="파일 첨부"
              >
                <i className="codicon codicon-add" />첨부
              </button>
            </>
          )}

          {/* 워크플로 칩 — 채팅에서 워크플로 로드(빈 카드 시드). 워크플로 탭과 같은 동작. */}
          {workflow && (
            <span className="chat-chip chat-chip--wf" title="워크플로 — 고르면 그 하네스의 빈 카드가 보드에 깔립니다">
              <i className="codicon codicon-symbol-structure" />
              <select
                className="chat-chip-wf-select"
                value={workflow.current}
                disabled={disabled}
                onChange={(e) => workflow.onLoad(e.target.value)}
                aria-label="워크플로 선택"
              >
                <option value="">워크플로 없음</option>
                {workflow.options.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <i className="codicon codicon-chevron-down chat-chip-caret" aria-hidden />
            </span>
          )}

          {/* 모델 칩 — 고정 모델 라벨(정보 표시). */}
          <span className="chat-chip" aria-hidden>
            {MODEL_LABEL}
          </span>

          {/* 컨텍스트 칩 — @<브랜드명>. brandName 없으면 생략. */}
          {brandName && (
            <span className="chat-chip chat-chip--context" aria-hidden>
              <i className="codicon codicon-mention" />@{brandName}
            </span>
          )}

          {/* 전송 — codicon send. 입력 있을 때만 블루 활성(.is-active). */}
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="전송"
            className={`chat-send btn-press${canSend ? " is-active" : ""}`}
          >
            {disabled ? (
              // 실행 중 — 대기 스피너로 라이브 상태 표시.
              <span className="spinner-ring text-[13px]" />
            ) : (
              <SendGlyph />
            )}
          </button>
        </div>
      </div>

      {/* 힌트 라인 — Enter 전송 · Shift+Enter 줄바꿈 + 승인 안내. */}
      <p className="chat-composer-hint">
        <kbd>Enter</kbd> 전송 · <kbd>Shift + Enter</kbd> 줄바꿈 — 메일 발송 전에는
        항상 사람의 승인을 거칩니다
      </p>
    </div>
  );
}
