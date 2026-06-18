"use client";

// 대화 스레드 — 단일 컬럼 인라인 채팅(토큰 기반).
// user_message → 우측 유저 말풍선(액센트 틴트), text_delta → 좌측 에이전트 블록(로고 점 아바타),
// tool_start/tool_end 페어 → 대화 흐름 안의 깔끔한 인라인 스텝(· {label} + 스피너→체크),
//   브라우징/검색 계열 도구는 스텝 아래 절제된 미니 프리뷰(썸네일 1장 + 의사 URL 한 줄),
// artifact → 대화 안에 정착하는 인라인 결과물 카드(.inline-card · 전 kind),
// approval/email_sent → 인라인 행, status → 미세한 시스템 라인.
// 비어 있을 때는 greeting 슬롯(가벼운 인사)을 띄운다.
//
// 두 가지 맥락에서 재사용:
//  1) 화이트 페이지 단독 — 흰 바탕 + 잉크 본문 + 버밀리언 절제.
//  2) IDE 좌측 챗 패널(.ide) — ChatPanel 의 CSS 변수 리맵으로 동일 토큰이 다크로 해석됨.
//     좁은 사이드 폭에 맞춰 compact 모드를 쓰면 인라인 결과물 카드를 생략(중앙 에디터가 렌더)하고
//     스텝/발화 위주의 간결한 흐름만 보여 준다 — 기능(이벤트 처리)은 그대로.
// 글로우/네온 금지(이모지 장식 대신 인라인 SVG).

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Markdown } from "@/components/Markdown";
import type { AgentEvent, AgentFeedProps, Artifact, ArtifactKind } from "@/lib/types";
import { pickThumb, windowKindFor } from "@/lib/live-assets";
import { BriefingCard } from "@/components/artifacts/BriefingCard";
import { RfpAnalysisCard } from "@/components/artifacts/RfpAnalysisCard";
import { ProposalCard } from "@/components/artifacts/ProposalCard";
import { BidCard } from "@/components/artifacts/BidCard";
import { OperationPlanCard } from "@/components/artifacts/OperationPlanCard";
import { VisualGallery } from "@/components/artifacts/VisualGallery";
import { InstagramMockup } from "@/components/artifacts/InstagramMockup";
import { InstagramPublishedCard } from "@/components/artifacts/InstagramPublishedCard";
import { NewsletterPreview } from "@/components/artifacts/NewsletterPreview";
import { ColdEmailList } from "@/components/artifacts/ColdEmailList";
import { MetricsDashboard } from "@/components/artifacts/MetricsDashboard";
import { KeywordTable } from "@/components/artifacts/KeywordTable";
import { FunnelChart } from "@/components/artifacts/FunnelChart";
import { ContentPerformance } from "@/components/artifacts/ContentPerformance";
import { CalendarBoard } from "@/components/artifacts/CalendarBoard";
import { LeadJourneyCard } from "@/components/artifacts/LeadJourneyCard";
import { KeywordJourneyFlow } from "@/components/artifacts/KeywordJourneyFlow";
import { AttributionTable } from "@/components/artifacts/AttributionTable";
import { FollowerGrowthChart } from "@/components/artifacts/FollowerGrowthChart";
import { TrackingAuditCard } from "@/components/artifacts/TrackingAuditCard";
import { SubjectLab } from "@/components/artifacts/SubjectLab";
import { CopyCritique } from "@/components/artifacts/CopyCritique";
import { EmailSequence } from "@/components/artifacts/EmailSequence";
import { NewsletterPerformance } from "@/components/artifacts/NewsletterPerformance";
import { BtlRfpView } from "@/components/artifacts/BtlRfpView";
import { BtlProposalView } from "@/components/artifacts/BtlProposalView";
import { BtlQuoteView } from "@/components/artifacts/BtlQuoteView";
import { BtlBoundDocView } from "@/components/artifacts/BtlBoundDocView";
import { BtlLoadingView } from "@/components/artifacts/BtlLoadingView";

// 결과물 kind → 한국어 라벨. AgentFeed 인라인 카드 + 노드 클릭 미리보기(ArtifactPreview)에서 공유.
export const ARTIFACT_LABELS: Record<ArtifactKind, string> = {
  briefing: "아침 브리핑",
  rfp_analysis: "RFP 분석",
  proposal: "제안서",
  bid: "비딩 견적",
  operation_plan: "운영안",
  visual: "콘텐츠 비주얼",
  instagram_posts: "인스타그램 콘텐츠",
  instagram_published: "인스타그램 발행",
  newsletter: "뉴스레터 초안",
  cold_emails: "콜드메일 초안",
  metrics: "지표 대시보드",
  keywords: "키워드 리포트",
  funnel: "전환 퍼널",
  content_performance: "콘텐츠 성과 리포트",
  calendar: "콘텐츠 캘린더",
  lead_journey: "리드 여정 분석",
  keyword_journey: "키워드 탐색 경로",
  attribution: "콘텐츠 기여 분석",
  follower_growth: "채널 성장 추이",
  tracking_audit: "추적 설정 감사",
  subject_lab: "제목 랩",
  copy_critique: "카피 점검",
  email_sequence: "이메일 시퀀스",
  newsletter_performance: "뉴스레터 성과",
  btl_rfp: "RFP 문서",
  btl_proposal: "기획제안서",
  btl_quote: "견적서",
  btl_proposal_file: "기획제안서",
  btl_quote_file: "견적서",
  btl_operation_file: "운영안",
  btl_doc_file: "산출물",
  btl_doc_loading: "분석 중",
};

const MONO = "font-[family-name:var(--font-geist-mono)]";

// 에이전트 쪽 콘텐츠 들여쓰기 — 아바타(28px) + 간격(12px) = 40px
const AGENT_INDENT = "ml-10";

/** 에이전트 아바타 — 로고 점 마크 (워드마크 없음). 종이 칩 위 잉크 궤도 + 버밀리언 중심점 */
function AgentAvatar() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line-1)] bg-[var(--bg-1)] text-[var(--text-2)]">
      <Logo withWordmark={false} className="text-[12px]" />
    </span>
  );
}

/** 유저 말풍선 — 우측 정렬, 버밀리언 틴트 */
function UserBubble({ text }: { text: string }) {
  return (
    <div className="anim-bubble-in flex justify-end pl-10">
      <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-[6px] border border-[var(--accent)]/20 bg-[var(--accent-tint)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--text-1)] sm:max-w-[78%]">
        {text}
      </div>
    </div>
  );
}

/** 에이전트 발화 블록 — 좌측, 아바타 + 텍스트 (typing 시 깜빡이는 커서) */
function AgentText({ text, typing = false }: { text: string; typing?: boolean }) {
  return (
    <div className="anim-bubble-in flex items-start gap-3">
      <AgentAvatar />
      <div className="min-w-0 flex-1 whitespace-pre-wrap pt-[3px] text-[16px] leading-relaxed text-[var(--text-1)]">
        {text}
        {typing && (
          <span className="animate-blink ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-[var(--accent)]" />
        )}
      </div>
    </div>
  );
}

/** 완료 체크 글리프 — 인라인 SVG (이모지 금지). .tool-step-glyph 슬롯 안에 들어간다. */
function CheckGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
      <path
        d="M2.5 6.2 L5 8.5 L9.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 인라인 체크 글리프 — 상태 라인(작업 완료·승인됨)용. 텍스트 ✓ 대신 SVG(이모지 금지). */
function CheckInline() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="mr-1 inline-block h-3 w-3 shrink-0 translate-y-[-1px] align-middle"
      aria-hidden="true"
    >
      <path
        d="M2.5 6.2 L5 8.5 L9.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 도구 실행 스텝 — Claude Code 풍 인라인 한 줄.
 *   진행 중: 점→스피너 글리프 + 라벨 + "실행 중"
 *   완료:   딥그린 체크 + 잉크 라벨 (클릭 시 summary 펼침)
 * 브라우징/검색 계열(browser·search)이면 스텝 아래 절제된 미니 프리뷰를 붙인다.
 */
function ToolStep({
  toolUseId,
  label,
  toolName,
  summary,
}: {
  toolUseId: string;
  label: string;
  toolName: string;
  summary: string | undefined;
}) {
  const isDone = summary !== undefined;
  const kind = windowKindFor(toolName);
  const showPreview = kind === "browser" || kind === "search";
  // 도구별 결정론적 의사 URL — toolUseId 로 흔들리지 않게 고정
  const pseudoUrl =
    kind === "search"
      ? `search?q=${encodeURIComponent(label)}`
      : `${toolName.replace(/_/g, "-")}.octopus.live`;

  // 완료 + summary 가 있으면 클릭으로 펼치는 <details>, 아니면 정적 행
  const stepRow = (
    <div className={`tool-step ${isDone ? "tool-step-done" : ""}`}>
      <span className="tool-step-glyph">
        {isDone ? <CheckGlyph /> : <span className="spinner-ring" />}
      </span>
      <span className="min-w-0 truncate font-medium">{label}</span>
      {!isDone && (
        <span className={`ml-auto shrink-0 ${MONO} text-[10px] text-[var(--text-3)]`}>
          실행 중
        </span>
      )}
      {isDone && (
        <span
          className={`ml-auto hidden shrink-0 ${MONO} text-[10px] text-[var(--text-3)] sm:inline`}
        >
          {toolName}
        </span>
      )}
    </div>
  );

  return (
    <div className={`anim-bubble-in ${AGENT_INDENT}`}>
      {isDone && summary ? (
        <details className="group">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            {stepRow}
          </summary>
          <p className="mt-1 pl-[22px] text-[13px] leading-relaxed text-[var(--text-2)]">
            {summary}
          </p>
        </details>
      ) : (
        stepRow
      )}

      {/* 브라우징/검색 미니 프리뷰 — 플로팅 창 아님, 절제된 인라인 한 조각 */}
      {showPreview && (
        <div className="browse-mini ml-[22px]">
          <span className="browse-mini-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pickThumb(toolUseId)} alt="" className="photo-warm" />
          </span>
          <span className="browse-mini-url">{pseudoUrl}</span>
        </div>
      )}
    </div>
  );
}

// ── 인라인 결과물 카드 — kind별 하위 컴포넌트로 위임 ──
// 캔버스 노드 클릭 미리보기(ArtifactPreview)도 동일 렌더러를 재사용한다(단일 진실 소스).
export function renderArtifactBody(artifact: Artifact, brandName: string): ReactNode {
  switch (artifact.kind) {
    case "briefing":
      return <BriefingCard briefing={artifact.briefing} />;
    case "rfp_analysis":
      return <RfpAnalysisCard analysis={artifact.analysis} />;
    case "proposal":
      return <ProposalCard proposal={artifact.proposal} />;
    case "bid":
      return <BidCard bid={artifact.bid} />;
    case "operation_plan":
      return <OperationPlanCard plan={artifact.plan} />;
    case "visual":
      return <VisualGallery set={artifact.set} />;
    case "instagram_posts":
      return <InstagramMockup posts={artifact.posts} brandName={brandName} />;
    case "instagram_published":
      return <InstagramPublishedCard result={artifact.result} brandName={brandName} />;
    case "newsletter":
      return <NewsletterPreview draft={artifact.draft} />;
    case "cold_emails":
      return <ColdEmailList emails={artifact.emails} />;
    case "metrics":
      return <MetricsDashboard metrics={artifact.metrics} />;
    case "keywords":
      return <KeywordTable report={artifact.report} />;
    case "funnel":
      return <FunnelChart report={artifact.report} />;
    case "content_performance":
      return <ContentPerformance report={artifact.report} />;
    case "calendar":
      return <CalendarBoard calendar={artifact.calendar} />;
    case "lead_journey":
      return <LeadJourneyCard report={artifact.report} />;
    case "keyword_journey":
      return <KeywordJourneyFlow report={artifact.report} />;
    case "attribution":
      return <AttributionTable report={artifact.report} />;
    case "follower_growth":
      return <FollowerGrowthChart report={artifact.report} />;
    case "tracking_audit":
      return <TrackingAuditCard report={artifact.report} />;
    case "subject_lab":
      return <SubjectLab lab={artifact.lab} />;
    case "copy_critique":
      return <CopyCritique report={artifact.report} />;
    case "email_sequence":
      return <EmailSequence sequence={artifact.sequence} />;
    case "newsletter_performance":
      return <NewsletterPerformance report={artifact.report} />;
    case "btl_rfp":
      return <BtlRfpView rfp={artifact.rfp} />;
    case "btl_proposal":
      return <BtlProposalView proposal={artifact.proposal} />;
    case "btl_quote":
      return <BtlQuoteView quote={artifact.quote} />;
    case "btl_proposal_file":
    case "btl_quote_file":
    case "btl_operation_file":
    case "btl_doc_file":
      return <BtlBoundDocView slotId={artifact.slotId} name={artifact.name} ext={artifact.ext} />;
    case "btl_doc_loading":
      return <BtlLoadingView label={artifact.label} />;
  }
}

// 본문이 이보다 길면 접고 "더 보기" 를 노출한다(기본 펼침이되 과하게 긴 카드만 축약).
const ARTIFACT_COLLAPSE_MAX_PX = 760;

/** 대화 안에 정착하는 결과물 카드 — 종이 표면 + 머리글(라벨) + 본문. 별도 패널로 보내지 않는다. */
function ArtifactCard({ artifact, brandName }: { artifact: Artifact; brandName: string }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // 기본 펼침(expanded=true). 본문이 임계치를 넘으면 접기 토글을 보여 준다.
  const [expanded, setExpanded] = useState(true);
  const [overflows, setOverflows] = useState(false);

  // 렌더 후 본문 높이를 측정해 임계치 초과 시에만 토글을 활성화한다.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > ARTIFACT_COLLAPSE_MAX_PX + 32);
  }, [artifact]);

  const clamp = overflows && !expanded;

  return (
    <div className={`anim-bubble-in inline-card ${AGENT_INDENT}`}>
      <div className="inline-card-head">
        <span className="text-[var(--accent)]">결과물</span>
        <span aria-hidden>·</span>
        <span className="text-[var(--text-2)]">{ARTIFACT_LABELS[artifact.kind]}</span>
      </div>

      <div
        ref={bodyRef}
        className={clamp ? "relative overflow-hidden" : "relative"}
        style={clamp ? { maxHeight: ARTIFACT_COLLAPSE_MAX_PX } : undefined}
      >
        {renderArtifactBody(artifact, brandName)}
        {clamp && (
          // 하단 페이드 — 잘렸음을 부드럽게 시사 (종이색으로 자연스럽게 사라짐)
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
            style={{
              background: "linear-gradient(to bottom, transparent, var(--bg-1))",
            }}
          />
        )}
      </div>

      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent)] transition-colors hover:text-[var(--text-1)]"
        >
          <svg
            viewBox="0 0 10 6"
            className={`h-[7px] w-2.5 shrink-0 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            <path
              d="M1 1 L5 5 L9 1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {expanded ? "접기" : "더 보기"}
        </button>
      )}
    </div>
  );
}

/** 컴팩트(IDE 챗) 모드용 결과물 참조 한 줄 — 본문은 중앙 에디터가 렌더하므로 챗에선 슬림 라인만. */
function ArtifactRef({ artifact }: { artifact: Artifact }) {
  return (
    <div className={`anim-bubble-in inline-card-head ${AGENT_INDENT}`}>
      <span className="text-[var(--accent)]">결과물</span>
      <span aria-hidden>·</span>
      <span className="text-[var(--text-2)]">{ARTIFACT_LABELS[artifact.kind]}</span>
      <span className="ml-1 text-[var(--text-3)]">보드에 추가됨</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  컴팩트(IDE .ide 다크) 챗 — Claude Code / Cursor 결.
//  아래 컴포넌트들은 globals.css 의 `.chat-*`(.ide 스코프) 클래스를 사용한다.
//  → compact 모드(IDE 좌측 챗 패널)에서만 렌더된다. 흰 미니멀 페이지는
//     기존 렌더러(UserBubble/AgentText/ToolStep/ArtifactCard)를 그대로 쓴다.
// ════════════════════════════════════════════════════════════════════

/** 코드블록 — 모노 + 헤더(언어 라벨) + 복사 버튼(codicon). */
function ChatCodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = () => {
    // navigator.clipboard 미지원/거부 시에도 조용히 토글만(데모 안정성)
    void navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="chat-code">
      <div className="chat-code-head">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={copy}
          className={`chat-code-copy ${copied ? "is-copied" : ""}`}
          aria-label={copied ? "복사됨" : "복사"}
          title={copied ? "복사됨" : "복사"}
        >
          <i
            className={`codicon ${copied ? "codicon-check" : "codicon-copy"}`}
            aria-hidden
          />
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** 본문 렌더 — 마크다운(제목/목록/굵게/링크/코드)을 견고하게 렌더. 코드펜스는
 *  복사 버튼 달린 ChatCodeBlock 으로 위임. 스트리밍 중 미닫힌 마커는 글자로 흘린다. */
function ChatRichBody({ text, typing }: { text: string; typing?: boolean }) {
  return (
    <>
      <Markdown
        text={text}
        renderCode={(lang, code) => <ChatCodeBlock lang={lang} code={code} />}
      />
      {typing && <span className="chat-caret" aria-hidden />}
    </>
  );
}

/** 어시스턴트 턴 — 작은 원형 아바타(octopus 마크) + 평문 본문(코드블록 인라인). */
function ChatAssistantTurn({ text, typing }: { text: string; typing?: boolean }) {
  return (
    <div className="chat-turn chat-turn-assistant anim-bubble-in">
      <span className="chat-avatar" aria-hidden>
        <Logo withWordmark={false} />
      </span>
      <div className="chat-body">
        <ChatRichBody text={text} typing={typing} />
      </div>
    </div>
  );
}

/** 유저 턴 — Cursor 풍 옅은 박스(또렷이 구분). */
function ChatUserTurn({ text }: { text: string }) {
  return (
    <div className="chat-turn chat-turn-user anim-bubble-in">
      <div className="chat-bubble">{text}</div>
    </div>
  );
}

/**
 * 도구 호출 블록 — Claude Code 풍 접히는 <details>.
 *   헤더: 상태 글리프(기본=채움원형점 / 실행중=spin / 완료=check) + 모노 라벨 + 셰브론.
 *   본문(펼침): 좌측 꺾인 가이드 들여쓰기 + "tool(args)" 다음줄 result(모노).
 * 브라우징/검색 계열이면 본문에 절제된 미니 프리뷰(썸네일 + 의사 URL).
 */
function ChatToolBlock({
  toolUseId,
  label,
  toolName,
  summary,
}: {
  toolUseId: string;
  label: string;
  toolName: string;
  summary: string | undefined;
}) {
  const isDone = summary !== undefined;
  const kind = windowKindFor(toolName);
  const showPreview = kind === "browser" || kind === "search";
  const pseudoUrl =
    kind === "search"
      ? `search?q=${encodeURIComponent(label)}`
      : `${toolName.replace(/_/g, "-")}.octopus.live`;

  // 상태 글리프 — 실행 중(spin) / 완료(check) / (기본 채움 원형점은 실행중 폴백)
  const glyphClass = isDone
    ? "codicon codicon-check"
    : "codicon codicon-loading codicon-modifier-spin";

  return (
    <details
      className={`chat-tool anim-bubble-in ${
        isDone ? "chat-tool--done" : "chat-tool--running"
      }`}
    >
      <summary className="chat-tool-head">
        <span className="chat-tool-glyph">
          <i className={glyphClass} aria-hidden />
        </span>
        <span className="chat-tool-label">{label}</span>
        <span className="chat-tool-meta">{isDone ? toolName : "실행 중"}</span>
        <i className="codicon codicon-chevron-right chat-tool-caret" aria-hidden />
      </summary>

      <div className="chat-tool-body">
        {/* tool(args) — Claude Code 의 호출 라인 느낌 */}
        <div className="chat-tool-args">
          {toolName}(<span>{label}</span>)
        </div>
        {/* 다음줄 result */}
        <div className="chat-tool-result">
          {isDone ? summary : "실행 중…"}
        </div>

        {showPreview && (
          <div className="browse-mini mt-1.5">
            <span className="browse-mini-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pickThumb(toolUseId)} alt="" className="photo-warm" />
            </span>
            <span className="browse-mini-url">{pseudoUrl}</span>
          </div>
        )}
      </div>
    </details>
  );
}

/** 결과물 참조 — 산출물 생성 = "보드에 카드 추가". 의미 라벨 + "보드에 추가됨".
 *  클릭은 중앙 작업 보드로 시선을 보내는 best-effort(보드 영역 스크롤). 실패해도 무해. */
function ChatFileRef({ artifact }: { artifact: Artifact }) {
  const focusBoard = () => {
    // 중앙 작업 보드로 스크롤(시선 유도). 없으면 무시.
    if (typeof document === "undefined") return;
    document
      .querySelector(".ide-board, .ide-editor")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  return (
    <button type="button" className="chat-fileref anim-bubble-in" onClick={focusBoard}>
      <i className="codicon codicon-layout" aria-hidden />
      <span className="chat-fileref-name">{ARTIFACT_LABELS[artifact.kind]}</span>
      <span className="chat-fileref-hint">보드에 추가됨</span>
    </button>
  );
}

/** 생각 중 — 은은한 점멸 인디케이터. */
function ChatThinking({ label = "생각 중" }: { label?: string }) {
  return (
    <div className="chat-thinking" role="status">
      <span className="chat-thinking-dot" aria-hidden />
      <span>{label}…</span>
    </div>
  );
}

/** 컴팩트 모드 단일 이벤트 렌더 — Claude Code / Cursor 결. */
function CompactFeedItem({
  event,
  toolSummaries,
}: {
  event: AgentEvent;
  toolSummaries: Map<string, string>;
}) {
  switch (event.type) {
    case "user_message":
      return <ChatUserTurn text={event.text} />;

    case "text_delta":
      return <ChatAssistantTurn text={event.text} />;

    case "tool_start":
      return (
        <ChatToolBlock
          toolUseId={event.toolUseId}
          label={event.label}
          toolName={event.toolName}
          summary={toolSummaries.get(event.toolUseId)}
        />
      );

    case "artifact":
      return <ChatFileRef artifact={event.artifact} />;

    case "status":
      if (event.status === "thinking") return <ChatThinking />;
      if (event.status === "started") {
        return (
          <div className="ide-mono flex items-center gap-2 px-1.5 py-0.5 text-[10px] tracking-[0.18em] text-[var(--ide-text-faint)]">
            <span className="h-px w-6 bg-[var(--ide-border)]" />
            RUN START
            <span className="h-px flex-1 bg-[var(--ide-border)]" />
          </div>
        );
      }
      if (event.status === "done") {
        return (
          <div className="flex items-center gap-1.5 px-1.5 text-[12.5px] text-[var(--ide-ok)]">
            <i className="codicon codicon-check" style={{ fontSize: 13 }} aria-hidden />
            작업 완료{event.message ? ` — ${event.message}` : ""}
          </div>
        );
      }
      return (
        <div className="flex items-center gap-1.5 px-1.5 text-[12.5px] text-[var(--ide-danger)]">
          <i className="codicon codicon-error" style={{ fontSize: 13 }} aria-hidden />
          오류{event.message ? ` — ${event.message}` : "가 발생했습니다."}
        </div>
      );

    case "persona_comment":
      return (
        <div className="anim-bubble-in px-1.5 py-1">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: event.accent }}
              aria-hidden
            />
            <span className="ide-mono text-[11.5px] font-semibold" style={{ color: "var(--ide-text)" }}>
              {event.name}
            </span>
            <span className="ide-mono text-[10px]" style={{ color: "var(--ide-text-faint)" }}>
              {event.title}
            </span>
          </div>
          <p
            className="mt-1 rounded-md px-2.5 py-1.5 text-[12.5px] leading-relaxed"
            style={{
              color: "var(--ide-text)",
              background: "var(--ide-elevated)",
              borderLeft: `2px solid ${event.accent}`,
            }}
          >
            {event.text}
          </p>
        </div>
      );

    case "email_sent":
      return (
        <div className="anim-flash-ok flex flex-wrap items-baseline gap-x-2 rounded-lg border border-[var(--ide-ok)]/30 px-3 py-2 text-[12.5px] text-[var(--ide-ok)]">
          <span className="flex items-center gap-1.5">
            <i className="codicon codicon-mail" style={{ fontSize: 13 }} aria-hidden />
            발송 완료
          </span>
          <span className="font-semibold text-[var(--ide-text)]">{event.company}</span>
          <span className="text-[var(--ide-text-dim)]">{event.subject}</span>
        </div>
      );

    case "approval_required":
      return (
        <div className="anim-bubble-in flex items-center gap-1.5 rounded-lg border border-[var(--ide-warn)]/35 px-3 py-2 text-[12.5px] text-[var(--ide-warn)]">
          <i className="codicon codicon-shield" style={{ fontSize: 13 }} aria-hidden />
          {event.approval.kind === "instagram_publish"
            ? "발행 승인 대기 — 사람의 확인이 필요합니다 (게시물 1건)"
            : `발송 승인 대기 — 사람의 확인이 필요합니다 (${event.approval.emails.length}건)`}
        </div>
      );

    case "instagram_published":
      return (
        <div className="flex items-center gap-1.5 px-1.5 text-[12.5px] text-[var(--ide-ok)]">
          <i className="codicon codicon-device-camera" style={{ fontSize: 13 }} aria-hidden />
          {event.mock ? "인스타그램 mock 발행" : "인스타그램 발행 완료"}
          {event.permalink ? (
            <a href={event.permalink} target="_blank" rel="noreferrer" className="underline">
              보기
            </a>
          ) : null}
        </div>
      );

    case "approval_resolved":
      return event.approved ? (
        <div className="flex items-center gap-1.5 px-1.5 text-[12.5px] text-[var(--ide-ok)]">
          <i className="codicon codicon-check" style={{ fontSize: 13 }} aria-hidden />
          발송 승인됨
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-1.5 text-[12.5px] text-[var(--ide-danger)]">
          <i className="codicon codicon-circle-slash" style={{ fontSize: 13 }} aria-hidden />
          발송 거부됨
        </div>
      );

    default:
      return null;
  }
}

function FeedItem({
  event,
  toolSummaries,
  brandName,
  compact = false,
}: {
  event: AgentEvent;
  toolSummaries: Map<string, string>;
  brandName: string;
  compact?: boolean;
}) {
  switch (event.type) {
    case "user_message":
      return <UserBubble text={event.text} />;

    case "text_delta":
      return <AgentText text={event.text} />;

    case "tool_start":
      return (
        <ToolStep
          toolUseId={event.toolUseId}
          label={event.label}
          toolName={event.toolName}
          summary={toolSummaries.get(event.toolUseId)}
        />
      );

    case "artifact":
      // 컴팩트(IDE 챗)에서는 결과물 본문을 중앙 에디터가 렌더한다 — 챗엔 슬림 참조 라인만.
      return compact ? (
        <ArtifactRef artifact={event.artifact} />
      ) : (
        <ArtifactCard artifact={event.artifact} brandName={brandName} />
      );

    case "status":
      if (event.status === "thinking") {
        return (
          <div
            className={`flex items-center gap-2 text-[13px] text-[var(--text-3)] ${AGENT_INDENT}`}
          >
            <span className="anim-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span>생각 중…</span>
          </div>
        );
      }
      if (event.status === "started") {
        // 미세한 시스템 라인 — 세션 경계
        return (
          <div
            className={`mx-auto flex items-center gap-3 py-0.5 ${MONO} text-[10px] tracking-[0.18em] text-[var(--text-3)]`}
          >
            <span className="h-px w-8 bg-[var(--line-1)]" />
            RUN START
            <span className="h-px w-8 bg-[var(--line-1)]" />
          </div>
        );
      }
      if (event.status === "done") {
        return (
          <div className={`flex items-center text-[13px] text-[var(--ok)] ${AGENT_INDENT}`}>
            <CheckInline />
            작업 완료{event.message ? ` — ${event.message}` : ""}
          </div>
        );
      }
      return (
        <div className={`text-[13px] text-[var(--danger)] ${AGENT_INDENT}`}>
          오류{event.message ? ` — ${event.message}` : "가 발생했습니다."}
        </div>
      );

    case "email_sent":
      return (
        <div
          className={`anim-flash-ok flex flex-wrap items-baseline gap-x-2 rounded-xl border border-[var(--ok)]/25 bg-[var(--ok-dim)] px-3.5 py-2.5 text-[14px] text-[var(--ok)] ${AGENT_INDENT}`}
        >
          발송 완료 — <span className="font-semibold">{event.company}</span>
          <span className="text-[12.5px] opacity-80">{event.subject}</span>
        </div>
      );

    case "approval_required":
      return (
        <div
          className={`anim-bubble-in rounded-xl border border-[var(--warn)]/30 bg-[var(--warn-dim)] px-3.5 py-2.5 text-[14px] text-[var(--warn)] ${AGENT_INDENT}`}
        >
          {event.approval.kind === "instagram_publish"
            ? "발행 승인 대기 — 사람의 확인이 필요합니다 (게시물 1건)"
            : `발송 승인 대기 — 사람의 확인이 필요합니다 (${event.approval.emails.length}건)`}
        </div>
      );

    case "instagram_published":
      return (
        <div
          className={`anim-flash-ok flex flex-wrap items-baseline gap-x-2 rounded-xl border border-[var(--ok)]/25 bg-[var(--ok-dim)] px-3.5 py-2.5 text-[14px] text-[var(--ok)] ${AGENT_INDENT}`}
        >
          {event.mock ? "인스타그램 mock 발행" : "인스타그램 발행 완료"}
          {event.account ? <span className="font-semibold">@{event.account}</span> : null}
          {event.permalink ? (
            <a href={event.permalink} target="_blank" rel="noreferrer" className="text-[12.5px] underline opacity-80">
              게시물 보기
            </a>
          ) : null}
        </div>
      );

    case "approval_resolved":
      return (
        <div
          className={`flex items-center text-[13px] ${AGENT_INDENT} ${
            event.approved ? "text-[var(--ok)]" : "text-[var(--danger)]"
          }`}
        >
          {event.approved ? (
            <>
              <CheckInline />
              발송 승인됨
            </>
          ) : (
            "발송 거부됨"
          )}
        </div>
      );

    default:
      return null;
  }
}

// greeting: 빈 상태에 상단 정렬로 띄우는 그리팅 슬롯 (선택적 — 기존 props 계약은 그대로 유지)
// compact: IDE 좌측 챗 패널용 — 인라인 결과물 카드를 슬림 참조로 대체하고 여백을 좁힌다(선택적, 기본 false)
export function AgentFeed({
  events,
  streamingText,
  running,
  greeting,
  compact = false,
}: AgentFeedProps & { greeting?: ReactNode; compact?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // 사용자가 하단 근처에 있을 때만 자동 스크롤 — 위로 올라가 이전 내용을 읽는 중이면 따라가지 않는다
  const stickToBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // tool_end summary 를 toolUseId 로 매핑 (tool_start 스텝에 합쳐 표시)
  const toolSummaries = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      if (e.type === "tool_end") map.set(e.toolUseId, e.summary);
    }
    return map;
  }, [events]);

  // InstagramMockup 등에 넘길 브랜드명 — metrics 아티팩트가 있으면 그 brandName, 없으면 기본값
  const brandName = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === "artifact" && e.artifact.kind === "metrics") {
        return e.artifact.metrics.brandName;
      }
    }
    return "달무드";
  }, [events]);

  // 그리팅은 첫 user_message(또는 리플레이 시작)와 함께 사라진다
  const isEmpty = events.length === 0 && !streamingText && !running;

  // "생각 중" 은 영구 히스토리가 아니라 **현재 상태**다. thinking status 이벤트는
  // 피드 본문에 쌓지 않고(아래 map 에서 skip), 마지막 이벤트가 thinking 일 때만
  // 트레일링 라이브 표시로 그린다. 도구 실행/산출물/완료가 뒤따르면 자동으로 사라진다.
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const liveThinking =
    running &&
    lastEvent?.type === "status" &&
    lastEvent.status === "thinking"
      ? lastEvent.message ?? "생각 중"
      : null;
  const isThinkingEvent = (e: AgentEvent) =>
    e.type === "status" && e.status === "thinking";

  // 새 이벤트/텍스트 시 자동 스크롤 — 하단 근처(80px 이내)일 때만 고정.
  // 단, 빈 그리팅 상태에선 자동 스크롤하지 않는다 — 좁은(모바일) 뷰포트에서
  // 그리팅이 뷰포트보다 길면 하단 고정이 명조 H1 을 스크롤 밖으로 밀어내기 때문.
  useEffect(() => {
    if (isEmpty) return;
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [events, streamingText, running, isEmpty]);

  // ── 컴팩트(IDE .ide 다크) — Claude Code / Cursor 결의 턴 스레드 ──
  if (compact) {
    return (
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        {isEmpty ? (
          <div className="px-3 pt-4">{greeting}</div>
        ) : (
          <div className="chat-thread relative z-10 min-h-full">
            {events.map((event, i) => {
              // tool_end 는 tool_start 블록에 합쳐 표시 — 별도 행 없음
              if (event.type === "tool_end") return null;
              // thinking 은 히스토리에 쌓지 않는다(트레일링 라이브 표시로만).
              if (isThinkingEvent(event)) return null;
              return (
                <CompactFeedItem
                  key={i}
                  event={event}
                  toolSummaries={toolSummaries}
                />
              );
            })}

            {/* 스트리밍 중인 어시스턴트 발화(타이핑 캐럿). */}
            {streamingText && <ChatAssistantTurn text={streamingText} typing />}

            {/* 진행 표시 — 마지막 상태가 thinking 일 때만. 도구/산출물/완료가 오면 사라짐. */}
            {liveThinking && !streamingText && <ChatThinking label={liveThinking} />}
          </div>
        )}
      </div>
    );
  }

  // ── 화이트 미니멀 페이지(단독) — 기존 렌더 그대로 ──
  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="relative min-h-0 flex-1 overflow-y-auto"
    >
      <div
        className={`chat-col relative z-10 flex min-h-full flex-col ${
          isEmpty
            ? "items-start pt-7 pb-7 lg:justify-end lg:pt-[14vh]"
            : "gap-4 py-5 pb-7"
        }`}
      >
        {isEmpty && greeting}

        {events.map((event, i) => {
          // tool_end 는 tool_start 스텝에 합쳐 표시 — 별도 행 없음
          if (event.type === "tool_end") return null;
          // thinking 은 히스토리에 쌓지 않는다(트레일링 라이브 표시로만).
          if (isThinkingEvent(event)) return null;
          return (
            <FeedItem
              key={i}
              event={event}
              toolSummaries={toolSummaries}
              brandName={brandName}
              compact={compact}
            />
          );
        })}

        {streamingText && <AgentText text={streamingText} typing />}

        {running && !streamingText && (
          <div className={`flex items-center gap-2.5 ${AGENT_INDENT}`}>
            <span className="anim-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span className={`${MONO} text-[10px] tracking-[0.18em] text-[var(--text-3)]`}>
              {liveThinking ?? "진행 중"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
