"use client";

// components/ide/WorkView.tsx — 중앙 에디터 본문의 "작업뷰".
//
// EditorArea(탭 스트립 + 본문 컨테이너)가 활성 탭의 내용을 이 컴포넌트로 그린다.
// VS Code 의 "열린 파일" 자리에서, 우리는 에이전트가 만들어 내는 산출물(아티팩트)을
// "편집 중인 문서"처럼 보여 준다:
//   - 상단 브레드크럼(경로 풍) + 산출물 라벨
//   - 본문은 기존 아티팩트 렌더러(renderArtifactBody)를 흰 "문서 표면" 위에 얹어 재사용.
//
// 핵심: components/artifacts/* 렌더러는 라이트(흰 배경) 디자인이라
// 전역 라이트 토큰(--text-1/--bg-0 …)을 쓴다. IDE 다크 .ide-editor-body 위에 그대로 두면
// 표면 없는 텍스트가 어둠 위 어둠이 된다. 따라서 흰 "문서 표면" 카드로 감싸
// 다크 IDE 크롬 안에서 "편집 중인 미리보기 문서"처럼 떠 보이게 한다(가독성 보장).
//
// 라이브 상태(아직 산출물 전): 에이전트가 무엇을 하고 있는지(현재 도구/스트리밍 발화)를
// 작업 표시로 그린다.
//
// 모든 상태는 props 에서만 파생(SSE/엔진 직접 접근 금지). 이모지 금지(인라인 SVG).
// 다크 테마는 상위 .ide 스코프가 책임지고, 문서 표면만 흰색으로 둔다. prefers-reduced-motion 가드.

import type { ReactNode } from "react";
import type { Artifact } from "@/lib/types";
import { ARTIFACT_LABELS, renderArtifactBody } from "@/components/AgentFeed";
import { personaForTool } from "@/lib/personas";
import { DocIcon, ChevronIcon } from "@/components/ide/glyphs";

// ───────────────────────── 라이브 작업 표시 ─────────────────────────

export interface WorkViewLive {
  /** 현재 실행 중인 도구 라벨(없으면 일반 작업 중). */
  toolLabel?: string;
  /** 현재 실행 중인 도구명(페르소나 매핑용). */
  toolName?: string;
  /** 누적 중인 에이전트 발화(스트리밍). */
  streamingText: string;
  /** 발송 승인 대기 여부. */
  awaitingApproval: boolean;
  /** 오류 메시지(있으면). */
  error: string | null;
}

/**
 * 라이브 작업 화면 — 산출물이 아직 없거나 생성 중일 때 가운데 본문에 그린다.
 * "지금 무슨 일이 벌어지고 있는지"를 실행/컴파일 풍으로 보여 준다.
 */
function LiveWork({ live, running }: { live: WorkViewLive; running: boolean }) {
  const persona = live.toolName ? personaForTool(live.toolName) : null;

  // 상태 헤드라인 — 우선순위: 오류 > 승인대기 > 도구 실행 > 작업 중 > 대기
  let headline: string;
  let tone: "active" | "warn" | "danger" | "idle";
  if (live.error) {
    headline = "작업 중 오류가 발생했습니다";
    tone = "danger";
  } else if (live.awaitingApproval) {
    headline = "발송 승인 대기 — 사람의 확인이 필요합니다";
    tone = "warn";
  } else if (running && live.toolLabel) {
    headline = `${live.toolLabel} 실행 중`;
    tone = "active";
  } else if (running) {
    headline = "에이전트가 작업하고 있습니다";
    tone = "active";
  } else {
    headline = "대기 중";
    tone = "idle";
  }

  const dotClass =
    tone === "warn"
      ? "bg-[var(--ide-warn)]"
      : tone === "danger"
        ? "bg-[var(--ide-danger)]"
        : "bg-[var(--ide-text-faint)]";

  return (
    <div className="ide-fade-in flex h-full flex-col px-8 py-7">
      {/* 헤드라인 — 현재 작업 상태 */}
      <div className="flex items-center gap-2.5">
        {tone === "active" || tone === "warn" ? (
          <span className="ide-spinner text-[14px]" aria-hidden />
        ) : (
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
          />
        )}
        <span className="text-[15px] font-semibold text-[var(--ide-text-strong)]">
          {headline}
        </span>
        {persona && (
          <span
            className="ide-badge"
            style={{ color: persona.accent }}
            title={persona.role}
          >
            {persona.name}
          </span>
        )}
      </div>

      {/* 진행 메타 라인 — 도구명(모노) + 커서 */}
      {live.toolName && running && (
        <p className="ide-mono mt-2 text-[12px] text-[var(--ide-text-dim)]">
          $ {live.toolName}
          <span className="ide-term-cursor ml-1" aria-hidden>
            ▋
          </span>
        </p>
      )}

      {/* 스트리밍 발화 — 에이전트가 말하는 중이면 작은 본문으로 노출 */}
      {live.streamingText ? (
        <div className="mt-5 max-w-[680px] rounded-md border border-[var(--ide-border)] bg-[var(--ide-panel)] px-4 py-3">
          <p className="ide-mono mb-1.5 text-[10px] tracking-[0.14em] text-[var(--ide-text-faint)]">
            에이전트 출력
          </p>
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--ide-text)]">
            {live.streamingText}
            {running && (
              <span className="ide-term-cursor ml-0.5" aria-hidden>
                ▋
              </span>
            )}
          </p>
        </div>
      ) : (
        !running && (
          <p className="mt-6 max-w-[520px] text-[13px] leading-relaxed text-[var(--ide-text-dim)]">
            좌측 채팅 패널에서 에이전트에게 마케팅 업무를 지시하면, 작업 결과가 이
            가운데 영역에 문서처럼 열립니다.
          </p>
        )
      )}

      {live.error && (
        <p className="mt-5 max-w-[680px] rounded-md border border-[var(--ide-danger)]/40 bg-[rgba(241,76,76,0.08)] px-4 py-3 text-[13px] leading-relaxed text-[var(--ide-danger)]">
          {live.error}
        </p>
      )}
    </div>
  );
}

// ───────────────────────── 산출물 문서 뷰 ─────────────────────────

export interface WorkViewProps {
  /** 활성 탭의 산출물(없으면 라이브/빈 상태). */
  artifact: Artifact | null;
  /** 산출물 렌더에 쓸 브랜드명. */
  brandName: string;
  /** 라이브 작업 상태(산출물 없을 때 본문). */
  live: WorkViewLive;
  /** 실행 중 여부(라이브 인디케이터). */
  running: boolean;
}

/**
 * 중앙 작업뷰 — 활성 산출물이 있으면 흰 "문서 표면" 위에 렌더, 없으면 라이브 작업 화면.
 * EditorArea 가 탭 선택/빈 상태를 관리하고, 본문 렌더는 여기로 위임한다.
 */
export function WorkView({
  artifact,
  brandName,
  live,
  running,
}: WorkViewProps): ReactNode {
  if (!artifact) {
    return <LiveWork live={live} running={running} />;
  }

  const label = ARTIFACT_LABELS[artifact.kind];

  return (
    <div className="ide-fade-in flex flex-col">
      {/* 브레드크럼 — VS Code 경로 표시 풍(산출물 위치를 파일 경로처럼) */}
      <div className="flex items-center gap-1.5 border-b border-[var(--ide-border)] px-5 py-1.5 text-[12px] text-[var(--ide-text-dim)]">
        <span className="text-[var(--ide-text-faint)]">octopus</span>
        <ChevronIcon className="h-3 w-3 opacity-60" />
        <span className="text-[var(--ide-text-faint)]">artifacts</span>
        <ChevronIcon className="h-3 w-3 opacity-60" />
        <span className="flex items-center gap-1.5 text-[var(--ide-text)]">
          <DocIcon className="h-3.5 w-3.5" />
          {label}
        </span>
      </div>

      {/* 문서 표면 — 흰 종이. 아티팩트 렌더러(라이트 디자인)를 그대로 재사용.
          IDE 다크 크롬 안에서 "편집 중인 미리보기 문서"처럼 떠 보인다. */}
      <div className="px-5 py-5">
        <div className="mx-auto w-full max-w-[760px] overflow-hidden rounded-lg border border-[var(--ide-border-strong)] bg-[var(--bg-0)] text-[var(--text-1)] shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          {/* 문서 헤더 — 라벨 + 라이브 점(아직 생성 중이면) */}
          <div className="flex items-center gap-2 border-b border-[var(--line-1)] px-5 py-3">
            <span className="font-[family-name:var(--font-geist-mono)] text-[10px] font-semibold tracking-[0.16em] text-[var(--accent)]">
              결과물
            </span>
            <span className="text-[14px] font-semibold text-[var(--text-1)]">
              {label}
            </span>
            {running && (
              <span
                className="anim-pulse-dot ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                aria-hidden
                title="작업 진행 중"
              />
            )}
          </div>
          <div className="px-5 py-4">{renderArtifactBody(artifact, brandName)}</div>
        </div>
      </div>
    </div>
  );
}
