"use client";

// components/ide/CanvasBoard.tsx — 중앙 "하나의 캔버스" + 멀티 에이전트 협업(피그마 풍).
//
// 산출물을 줌·팬 보드 위 카드로 자유 배치하고, 그 위에서 OASIS 오디언스 에이전트가
// 라이브로 협업한다(테마: "고객들과 함께 쌓아가는 오프라인 경험을 만들자").
//   · 카드   = kind별 최신 산출물(renderArtifactBody, .ide-doc-light 화이트).
//   · 협업   = 에이전트 커서가 카드 주변을 돌며 코멘트 핀을 남기고(피그마 코멘트),
//     서로 답글을 달고, 오케스트레이터에게 새 명령을 올린다. 오케스트레이터가 명령을
//     받으면 원본 초안 옆에 "후보안"(아키타입 색 변형 카드)을 만든다.
//   · 페르소나를 rail 에서 드롭하면 협업에 합류(커서 추가). 상단 "협업" 토글로 시작/정지.
//
// 팬/줌/카드 드래그는 포인터 이벤트, 시뮬레이션은 lib/useCollab. 엔진/SSE 직접 접근 없음.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { artifactKey, type AgentEvent, type Artifact, type ArtifactKind } from "@/lib/types";
import { ARTIFACT_LABELS, renderArtifactBody } from "@/components/AgentFeed";
import {
  ARCHETYPE_DND,
  archetypeAvatar,
  archetypeByType,
  archetypeColor,
  type OasisType,
} from "@/lib/oasis";
import { COLLAB_TAGLINE, type CardRect } from "@/lib/collab";
import { useCollab } from "@/lib/useCollab";
import { useActiveCard } from "@/lib/active-card-context";
import { useBoardDocs } from "@/lib/board-docs-context";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import { useLeftPanel } from "@/lib/left-panel-context";
import { BTL_PERSONA_DND } from "@/lib/agent/btl-personas";
import { personaById as audienceById } from "@/lib/agent/personas";
import { CARD_DND, cardSpecForSlot } from "@/lib/ide/card-spec";
import { artifactToMarkdown } from "@/lib/ide/export-md";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { demoDiscussEvents } from "@/lib/demo/demo-fixtures";

// 아티팩트 → 워크플로 슬롯 id(검토팀 배정·선택 강조). 슬롯 없으면 null.
function slotOf(a: Artifact): string | null {
  if (a.kind === "btl_rfp") return "rfp";
  if ("slotId" in a) return a.slotId;
  return null;
}

// 보드 카드 제목/아이콘 — 슬롯이 있으면 그 카드 스펙(기획안·견적서·운영안 등)을 따른다.
// (kind 라벨은 btl_doc_file="산출물" 처럼 제네릭이라 본문 제목과 어긋난다.)
function cardTitleOf(kind: ArtifactKind, slot: string | null): string {
  const spec = slot ? cardSpecForSlot(slot) : undefined;
  return spec?.header.title ?? ARTIFACT_LABELS[kind];
}
function cardIconOf(kind: ArtifactKind, slot: string | null): string {
  const spec = slot ? cardSpecForSlot(slot) : undefined;
  return spec?.header.icon ?? KIND_ICON[kind] ?? "file";
}

// PERSONA_DND 페이로드 파싱 — 단일 id 또는 다중 선택 JSON 배열(["oasis-p3", ...]).
function parsePersonaIds(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map(String);
  } catch {
    /* 단일 id */
  }
  return raw ? [raw] : [];
}

// 보드 배치 상수(px, 줌=1 기준). PAD 은 카드 시작 여백 — 카드 둘레 협업 커서가
// 보드 가장자리에 잘리지 않도록 좌/상단 여유를 둔다.
const PAD = 64;
const CARD_W = 380;
const COL_GAP = 40;
const ROW_GAP = 28;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.6;
const GRID = 22;

// kind별 카드 헤더 아이콘(파일 확장자 연상 금지 — 의미 아이콘).
const KIND_ICON: Record<ArtifactKind, string> = {
  briefing: "book",
  rfp_analysis: "search",
  proposal: "rocket",
  bid: "briefcase",
  operation_plan: "organization",
  visual: "device-camera",
  instagram_posts: "device-camera",
  instagram_published: "broadcast",
  newsletter: "mail",
  cold_emails: "mail",
  metrics: "graph",
  keywords: "search",
  funnel: "filter",
  content_performance: "graph-line",
  calendar: "calendar",
  lead_journey: "git-merge",
  keyword_journey: "search",
  attribution: "pie-chart",
  follower_growth: "graph",
  tracking_audit: "checklist",
  subject_lab: "beaker",
  copy_critique: "comment-discussion",
  email_sequence: "mail",
  newsletter_performance: "graph",
  btl_rfp: "file",
  btl_proposal: "file-text",
  btl_quote: "list-ordered",
  btl_proposal_file: "file-text",
  btl_quote_file: "list-ordered",
  btl_operation_file: "organization",
  btl_doc_file: "file-text",
  btl_doc_loading: "loading",
};

interface BoardCard {
  key: string;          // 보드 식별 키(kind 또는 kind:slotId)
  kind: ArtifactKind;   // 아이콘/라벨용
  artifact: Artifact;
}

type Pos = { x: number; y: number };

// 보드 배치 논리 순서 — 트리거(RFP)가 항상 먼저, 그 다음 산출물·합성. 첨부 시점(삽입순) 무관.
const SLOT_ORDER: Record<string, number> = {
  rfp: 0, proposal: 1, quote: 2, operation: 3, contract: 4, proposal_doc: 5, content: 6,
};
const slotRank = (a: Artifact): number => {
  const s = slotOf(a);
  return s && s in SLOT_ORDER ? SLOT_ORDER[s] : 50;
};

function deriveCards(artifacts: Artifact[]): BoardCard[] {
  const order: string[] = [];
  const latest = new Map<string, Artifact>();
  for (const a of artifacts) {
    const k = artifactKey(a);
    if (!latest.has(k)) order.push(k);
    latest.set(k, a);
  }
  // 슬롯 논리 순서로 정렬(같은 순위는 삽입순 유지) — RFP 가 늦게 첨부돼도 맨 위에 온다.
  return order
    .map((key, i) => ({ key, artifact: latest.get(key)!, i }))
    .sort((a, b) => slotRank(a.artifact) - slotRank(b.artifact) || a.i - b.i)
    .map(({ key, artifact }) => ({ key, kind: artifact.kind, artifact }));
}

function deriveCurrentTool(events: AgentEvent[]): string | null {
  const done = new Set<string>();
  for (const e of events) if (e.type === "tool_end") done.add(e.toolUseId);
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "tool_start" && !done.has(e.toolUseId)) return e.label;
  }
  return null;
}

function deriveBrandName(artifacts: Artifact[]): string {
  for (let i = artifacts.length - 1; i >= 0; i--) {
    const a = artifacts[i];
    if (a.kind === "metrics") return a.metrics.brandName;
  }
  return "달무드";
}

function computeLayout(
  cards: BoardCard[],
  heights: Record<string, number>,
): Record<string, Pos> {
  const colX = [PAD, PAD + CARD_W + COL_GAP];
  const colY = [PAD, PAD];
  const pos: Record<string, Pos> = {};
  for (const { key } of cards) {
    const c = colY[0] <= colY[1] ? 0 : 1;
    pos[key] = { x: colX[c], y: colY[c] };
    colY[c] += (heights[key] ?? 300) + ROW_GAP;
  }
  return pos;
}

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export interface CanvasBoardProps {
  events: AgentEvent[];
  artifacts: Artifact[];
  running: boolean;
}

export function CanvasBoard({ events, artifacts, running }: CanvasBoardProps) {
  const cards = useMemo(() => deriveCards(artifacts), [artifacts]);
  const brandName = useMemo(() => deriveBrandName(artifacts), [artifacts]);
  const currentTool = useMemo(() => deriveCurrentTool(events), [events]);
  // 키 기반(detail 등) + kind 기반(후보안 collab) 양쪽 조회.
  const artifactByKey = useMemo(() => {
    const m = new Map<string, Artifact>();
    for (const { key, artifact } of cards) m.set(key, artifact);
    return m;
  }, [cards]);
  const artifactByKind = useMemo(() => {
    const m = new Map<ArtifactKind, Artifact>();
    for (const { kind, artifact } of cards) if (!m.has(kind)) m.set(kind, artifact);
    return m;
  }, [cards]);

  // 카드 선택(→우측 검토팀 강조) + 페르소나 드롭 배정.
  const { activeSlot, setActiveSlot } = useActiveCard();
  const { docs } = useBoardDocs();
  const { discuss, addArtifact, removeArtifact, pushEvent } = useAgentStreamContext();
  const { showChat } = useLeftPanel();
  // 페르소나(들)를 한 카드에 배정 → 그 카드 결과물만 논의(보드 전체가 아니라 카드 단위).
  // 논의 입력 텍스트: 바운드 파일이 있으면 그 파일, 없으면 구조화 카드(RFP/기획안/견적서)를
  // 마크다운으로 만들어 보낸다. 둘 다 없으면(빈 카드 등) 아무 일도 안 함.
  const assignPersona = useCallback(async (slot: string, personaIds: string[], artifact: Artifact) => {
    if (personaIds.length === 0) return;
    // 시연 모드 — 느린 discuss 호출 대신 고정 코멘트를 채팅에 차례로 흘린다.
    if (isDemoMode()) {
      setActiveSlot(slot);
      showChat();
      pushEvent({ type: "user_message", text: "방문객 군집 3종을 기획안에 투입" });
      const evs = demoDiscussEvents();
      for (let i = 0; i < evs.length; i++) {
        setTimeout(() => pushEvent(evs[i]), 700 + i * 1100);
      }
      return;
    }
    const bound = docs.find((d) => d.slotId === slot);
    let file: File | null = null;
    let fileName = bound?.name ?? "산출물";
    if (bound?.handle) {
      file = await bound.handle.getFile();
      fileName = bound.name;
    } else {
      const md = artifactToMarkdown(artifact);
      if (md) {
        file = new File([md.markdown], md.filename, { type: "text/markdown" });
        fileName = md.filename;
      }
    }
    setActiveSlot(slot);
    showChat();
    // 논의할 내용(파일/구조화 산출물)이 없으면 침묵 금지 — 무엇을 해야 하는지 알린다.
    if (!file) {
      const title = cardSpecForSlot(slot)?.header.title ?? "이 카드";
      const who = personaIds.map((id) => audienceById(id)?.name).filter(Boolean).join("·") || "방문객 군집";
      pushEvent({ type: "user_message", text: `${who} → 「${title}」 투입` });
      pushEvent({ type: "text_delta", text: `「${title}」 카드엔 아직 논의할 내용이 없어요. 카드에서 ‘파일 불러오기’로 초안을 올리거나(또는 RFP·기획안·견적서 같은 산출물 카드 위에 놓아 주세요).` });
      return;
    }
    await discuss(file, slot, fileName, personaIds, cardSpecForSlot(slot)?.reviewPoints);
  }, [docs, discuss, showChat, setActiveSlot, pushEvent]);

  const [pan, setPan] = useState<Pos>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const [autoPos, setAutoPos] = useState<Record<string, Pos>>({});
  const [manualPos, setManualPos] = useState<Record<string, Pos>>({});
  const heightsRef = useRef<Record<string, number>>({});
  const cardEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const [heightsVersion, setHeightsVersion] = useState(0);
  const rafRef = useRef<number | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);

  // 결과물 상세 — 크게 보기 오버레이(작은 카드에 갇혀 안 보이던 세부 내용).
  const [detail, setDetail] = useState<{ key: string; kind: ArtifactKind; candidateNote?: string } | null>(null);

  const posOf = useCallback(
    (key: string): Pos => manualPos[key] ?? autoPos[key] ?? { x: PAD, y: PAD },
    [manualPos, autoPos],
  );

  useLayoutEffect(() => {
    for (const { key } of cards) {
      const el = cardEls.current.get(key);
      if (el) heightsRef.current[key] = el.offsetHeight;
    }
    setAutoPos(computeLayout(cards, heightsRef.current));
  }, [cards, heightsVersion]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setHeightsVersion((v) => v + 1);
      });
    });
    for (const el of cardEls.current.values()) ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [cards]);

  // 협업 레이어에 넘길 카드 사각형(캔버스 좌표).
  const cardRects = useMemo<CardRect[]>(
    () =>
      cards.map(({ key, kind }) => {
        const p = posOf(key);
        // 협업 레이어용 근사 사각형 — 핀/커서는 카드 상단 영역에 분포하므로 명목 높이로 충분.
        return { kind, label: ARTIFACT_LABELS[kind], x: p.x, y: p.y, w: CARD_W, h: 320 };
      }),
    [cards, posOf],
  );

  const collab = useCollab(cardRects);

  // 후보안 위치 — 원본 카드 오른쪽에 같은 source 끼리 세로로 스택.
  const candidatePos = useMemo(() => {
    const stack: Record<string, number> = {};
    const out: Record<string, Pos> = {};
    for (const cd of collab.candidates) {
      const rect = cardRects.find((r) => r.kind === cd.sourceKind);
      const i = stack[cd.sourceKind] ?? 0;
      stack[cd.sourceKind] = i + 1;
      if (!rect) continue;
      out[cd.id] = { x: rect.x + rect.w + 40, y: rect.y + i * 40 };
    }
    return out;
  }, [collab.candidates, cardRects]);

  // ── 팬 ──
  const panDrag = useRef<{ startX: number; startY: number; origin: Pos } | null>(null);
  const [panning, setPanning] = useState(false);
  const onBoardPointerDown = (e: React.PointerEvent) => {
    // 카드/핀/스레드/후보안, 그리고 모든 오버레이 컨트롤(툴바·협업 바·오케스트레이터·
    // 모달·버튼/셀렉트/링크) 위에서 시작한 포인터는 팬이 아니다 — 클릭을 가로채지 않게.
    if (
      (e.target as HTMLElement).closest(
        ".ide-board-card, .collab-pin, .collab-thread, .ide-cand-card, .ide-board-toolbar, .ide-collab-bar, .ide-orch-dock, .ide-card-modal-backdrop, button, select, a",
      )
    )
      return;
    if (e.button !== 0) return;
    panDrag.current = { startX: e.clientX, startY: e.clientY, origin: pan };
    setPanning(true);
    collab.setOpenThread(null);
    setActiveSlot(null); // 빈 보드 클릭 — 카드 선택 해제(우측 강조 해제)
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onBoardPointerMove = (e: React.PointerEvent) => {
    const d = panDrag.current;
    if (!d) return;
    setPan({ x: d.origin.x + (e.clientX - d.startX), y: d.origin.y + (e.clientY - d.startY) });
  };
  const endBoardPan = (e: React.PointerEvent) => {
    if (!panDrag.current) return;
    panDrag.current = null;
    setPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // 무해.
    }
  };

  // ── 카드 드래그 ──
  const cardDrag = useRef<{ key: string; startX: number; startY: number; origin: Pos } | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const onCardHeadPointerDown = (key: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    cardDrag.current = { key, startX: e.clientX, startY: e.clientY, origin: posOf(key) };
    setDraggingKey(key);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onCardHeadPointerMove = (e: React.PointerEvent) => {
    const d = cardDrag.current;
    if (!d) return;
    setManualPos((prev) => ({
      ...prev,
      [d.key]: { x: d.origin.x + (e.clientX - d.startX) / zoom, y: d.origin.y + (e.clientY - d.startY) / zoom },
    }));
  };
  const endCardDrag = (e: React.PointerEvent) => {
    if (!cardDrag.current) return;
    cardDrag.current = null;
    setDraggingKey(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // 무해.
    }
  };

  // ── rail/팔레트 → 보드 드롭 ──
  const onDrop = (e: React.DragEvent) => {
    // 카드 팔레트 드롭 → 보드에 단독 카드 추가(워크플로 없이).
    const cardSlot = e.dataTransfer.getData(CARD_DND);
    if (cardSlot) {
      const spec = cardSpecForSlot(cardSlot);
      if (spec) { e.preventDefault(); addArtifact({ kind: "btl_doc_file", slotId: cardSlot, name: spec.header.title, ext: "" }); }
      return;
    }
    // 페르소나(OASIS) 드롭 → 협업 에이전트 합류.
    const type = e.dataTransfer.getData(ARCHETYPE_DND) as OasisType;
    if (!type || !archetypeByType(type)) return;
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    collab.addAgent(type, x, y);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(ARCHETYPE_DND) || e.dataTransfer.types.includes(CARD_DND)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  // ── 줌 ──
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setZoom((z) => {
      const nz = clampZoom(z * factor);
      if (nz === z) return z;
      setPan((p) => ({ x: cx - ((cx - p.x) / z) * nz, y: cy - ((cy - p.y) / z) * nz }));
      return nz;
    });
  }, []);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (ev: WheelEvent) => {
      // 카드/모달 본문 위에서 스크롤 가능한 콘텐츠면 줌 대신 그 안을 스크롤하게 둔다.
      const scroller = (ev.target as HTMLElement)?.closest(
        ".ide-board-card-body, .ide-card-modal-body",
      ) as HTMLElement | null;
      if (scroller && scroller.scrollHeight > scroller.clientHeight) return;
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      // 휠 줌 — deltaY 비례 배율(트랙패드/마우스 절충). 한 이벤트당 과하지 않게 클램프.
      const d = Math.max(-60, Math.min(60, ev.deltaY));
      const factor = Math.exp(-d * 0.0025);
      zoomAt(factor, ev.clientX - rect.left, ev.clientY - rect.top);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [zoomAt]);
  const zoomButton = (factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(factor, rect.width / 2, rect.height / 2);
  };
  const fit = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || cards.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    let maxX = 0;
    let maxY = 0;
    for (const { key } of cards) {
      const p = posOf(key);
      maxX = Math.max(maxX, p.x + CARD_W);
      maxY = Math.max(maxY, p.y + (heightsRef.current[key] ?? 300));
    }
    const contentW = maxX + PAD + 440; // 후보안 여유
    const contentH = maxY + PAD;
    const z = clampZoom(Math.min(rect.width / contentW, rect.height / contentH, 1));
    setZoom(z);
    setPan({ x: (rect.width - contentW * z) / 2, y: Math.max(PAD / 2, (rect.height - contentH * z) / 2) });
  }, [cards, posOf]);

  const isEmpty = cards.length === 0 && collab.agents.length === 0 && !running;
  const openComment = collab.openThread
    ? collab.comments.find((c) => c.id === collab.openThread) ?? null
    : null;

  return (
    <div
      ref={viewportRef}
      className={`ide-board ${panning ? "is-panning" : ""}`}
      style={{ backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
      onPointerDown={onBoardPointerDown}
      onPointerMove={onBoardPointerMove}
      onPointerUp={endBoardPan}
      onPointerCancel={endBoardPan}
      onDrop={onDrop}
      onDragOver={onDragOver}
      aria-label="작업 보드 — 산출물 캔버스"
    >
      {/* 변환 레이어 — 카드/후보안/협업(커서·핀·스레드) 절대 배치. */}
      <div
        className="ide-board-canvas"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {/* 원본 산출물 카드. */}
        {cards.map(({ key, kind, artifact }) => {
          const p = posOf(key);
          const slot = slotOf(artifact);
          const isActive = slot != null && activeSlot === slot;
          return (
            <div
              key={key}
              ref={(el) => {
                if (el) cardEls.current.set(key, el);
                else cardEls.current.delete(key);
              }}
              className={`ide-board-card ${draggingKey === key ? "is-dragging" : ""} ${isActive ? "is-active" : ""}`}
              style={{ left: p.x, top: p.y }}
              onClick={slot ? () => setActiveSlot(slot) : undefined}
              onDragOver={slot ? (e) => { if (e.dataTransfer.types.includes(BTL_PERSONA_DND)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } } : undefined}
              onDrop={slot ? (e) => {
                const raw = e.dataTransfer.getData(BTL_PERSONA_DND);
                if (!raw) return;
                e.preventDefault(); e.stopPropagation();
                void assignPersona(slot, parsePersonaIds(raw), artifact);
              } : undefined}
            >
              <div
                className="ide-board-card-head"
                onPointerDown={onCardHeadPointerDown(key)}
                onPointerMove={onCardHeadPointerMove}
                onPointerUp={endCardDrag}
                onPointerCancel={endCardDrag}
              >
                <i className={`codicon codicon-${cardIconOf(kind, slot)}`} aria-hidden />
                <span className="ide-board-card-title">{cardTitleOf(kind, slot)}</span>
                <button
                  type="button"
                  className="ide-board-card-max"
                  title="크게 보기"
                  aria-label="크게 보기"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setDetail({ key, kind })}
                >
                  <i className="codicon codicon-screen-full" aria-hidden />
                </button>
                <button
                  type="button"
                  className="ide-board-card-max"
                  title="카드 보드에서 제거(파일·원본은 그대로)"
                  aria-label="카드 제거"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeArtifact(kind, slot ?? undefined)}
                >
                  <i className="codicon codicon-trash" aria-hidden />
                </button>
                <i className="codicon codicon-gripper ide-board-card-grip" aria-hidden />
              </div>
              <div className="ide-board-card-body ide-doc-light">
                {renderArtifactBody(artifact, brandName)}
              </div>
            </div>
          );
        })}

        {/* 개선안 — 오케스트레이터가 피드백을 받아 만든 "실제로 달라진" 변형(원본 옆). */}
        {collab.candidates.map((cd) => {
          const pos = candidatePos[cd.id];
          if (!pos) return null;
          const color = archetypeColor(cd.fromType);
          return (
            <div
              key={cd.id}
              className="ide-board-card ide-cand-card"
              style={{ left: pos.x, top: pos.y, ["--arch" as string]: color }}
            >
              <div className="ide-cand-head" style={{ background: `${color}1f`, borderColor: `${color}55` }}>
                <i className="codicon codicon-sparkle" style={{ color }} aria-hidden />
                <span className="ide-cand-title">
                  개선안 · {archetypeByType(cd.fromType)?.label ?? cd.fromType}
                </span>
                <span className="ide-cand-badge" style={{ color, borderColor: `${color}66` }}>
                  {cd.label}
                </span>
              </div>
              {/* 요청(왜) */}
              <div className="ide-cand-note">
                <i className="codicon codicon-comment" aria-hidden /> {cd.note}
              </div>
              {/* 실제로 달라진 점(원본 대비 구체 변경) */}
              <div className="ide-cand-changes">
                <div className="ide-cand-changes-head">달라진 점</div>
                {cd.changes.map((c, i) => (
                  <div className="ide-cand-change" key={i}>
                    <i className="codicon codicon-diff-added" style={{ color }} aria-hidden />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
              <div className="ide-cand-effect">
                <i className="codicon codicon-graph" aria-hidden /> {cd.effect}
              </div>
            </div>
          );
        })}

        {/* 코멘트 핀(피그마 코멘트). */}
        {collab.comments.map((cm) => {
          const rect = cardRects.find((r) => r.kind === cm.kind);
          if (!rect) return null;
          const color = archetypeColor(cm.authorType);
          return (
            <button
              key={cm.id}
              type="button"
              className={`collab-pin ${collab.openThread === cm.id ? "is-open" : ""}`}
              style={{ left: cm.x, top: cm.y, ["--arch" as string]: color }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => collab.setOpenThread(collab.openThread === cm.id ? null : cm.id)}
              title={`${archetypeByType(cm.authorType)?.label ?? cm.authorType} 코멘트`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 번들 로컬 SVG 아바타 */}
              <img src={archetypeAvatar(cm.authorType)} alt="" width={20} height={20} draggable={false} />
              {cm.replies.length > 0 && <span className="collab-pin-count">{cm.replies.length + 1}</span>}
            </button>
          );
        })}

        {/* 열린 코멘트 스레드. */}
        {openComment &&
          (() => {
            const rect = cardRects.find((r) => r.kind === openComment.kind);
            if (!rect) return null;
            return (
              <div className="collab-thread" style={{ left: openComment.x + 14, top: openComment.y }}>
                <div className="collab-thread-head">
                  <span className="collab-thread-on">{openComment.label}</span>
                  <button
                    type="button"
                    className="collab-thread-close"
                    onClick={() => collab.setOpenThread(null)}
                    aria-label="닫기"
                  >
                    <i className="codicon codicon-close" aria-hidden />
                  </button>
                </div>
                <CollabMsg type={openComment.authorType} text={openComment.text} />
                {openComment.replies.map((r, i) => (
                  <CollabMsg key={i} type={r.authorType} text={r.text} reply />
                ))}
              </div>
            );
          })()}

        {/* 에이전트 라이브 커서. */}
        {collab.agents.map((a) => {
          const color = archetypeColor(a.type);
          return (
            <div key={a.id} className="collab-cursor" style={{ left: a.x, top: a.y }}>
              <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden>
                <path
                  d="M2 1 L2 13 L5.6 9.7 L8 14.6 L10.2 13.6 L7.8 8.8 L12.4 8.2 Z"
                  fill={color}
                  stroke="#fff"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="collab-cursor-name" style={{ background: color }}>
                {archetypeByType(a.type)?.label ?? a.type}
              </span>
            </div>
          );
        })}
      </div>

      {/* 상단 협업 컨트롤 — 테마 태그라인 + 시작/정지 토글. */}
      <div className="ide-collab-bar">
        <i className="codicon codicon-organization" aria-hidden />
        <span className="ide-collab-tagline">{COLLAB_TAGLINE}</span>
        <button
          type="button"
          className={`ide-collab-toggle ${collab.active ? "is-on" : ""}`}
          onClick={collab.toggle}
        >
          <i className={`codicon ${collab.active ? "codicon-debug-pause" : "codicon-play"}`} aria-hidden />
          {collab.active ? "협업 일시정지" : "협업 시작"}
        </button>
        {collab.agents.length > 0 && (
          <span className="ide-collab-count">{collab.agents.length} 에이전트</span>
        )}
      </div>

      {/* 라이브 칩 — 작업 중(현재 도구). */}
      {running && (
        <div className="ide-board-live" role="status">
          <i className="codicon codicon-loading codicon-modifier-spin" aria-hidden />
          <span className="ide-board-live-label">{currentTool ? currentTool : "작업 중"}</span>
        </div>
      )}

      {/* 오케스트레이터 도크 — 에이전트가 올린 새 명령 → 하달 → 후보안 생성. */}
      {(collab.active || collab.escalations.length > 0) && (
        <div className="ide-orch-dock" aria-label="오케스트레이터">
          <div className="ide-orch-head">
            <span className="ide-orch-mark"><i className="codicon codicon-hubot" aria-hidden /></span>
            <span className="ide-orch-name">octopus 오케스트레이터</span>
            <span className="ide-orch-meta">{collab.candidates.length} 후보안</span>
          </div>
          {collab.escalations.length === 0 ? (
            <p className="ide-orch-empty">에이전트의 새 명령을 기다리는 중…</p>
          ) : (
            <div className="ide-orch-list">
              {collab.escalations.slice(-4).map((e) => {
                const color = archetypeColor(e.fromType);
                return (
                  <div key={e.id} className="ide-orch-item">
                    <span className="ide-orch-from" style={{ background: color }}>
                      {e.fromType}
                    </span>
                    <span className="ide-orch-text">{e.text}</span>
                    <span className={`ide-orch-status ${e.dispatched ? "done" : ""}`}>
                      {e.dispatched ? "후보안 생성" : "대기"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 빈 보드 안내. */}
      {isEmpty && (
        <div className="ide-board-empty">
          <i className="codicon codicon-layout" aria-hidden />
          <span className="ide-board-empty-title">작업 보드</span>
          <span className="ide-board-empty-sub">
            왼쪽 탐색기에서 작업 폴더를 열고 파일을 문서타입(RFP·기획제안서·견적서)에 지정하면
            여기에 산출물 카드가 뜹니다. 카드에서 담당 페르소나와 바로 논의할 수 있습니다.
          </span>
        </div>
      )}

      {/* 줌 툴바. */}
      <div className="ide-board-toolbar">
        <button type="button" onClick={() => zoomButton(1 / 1.18)} aria-label="축소" title="축소">
          <i className="codicon codicon-zoom-out" aria-hidden />
        </button>
        <span className="ide-board-zoom">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomButton(1.18)} aria-label="확대" title="확대">
          <i className="codicon codicon-zoom-in" aria-hidden />
        </button>
        <button type="button" onClick={fit} aria-label="전체 맞춤" title="전체 맞춤">
          <i className="codicon codicon-screen-full" aria-hidden />
        </button>
      </div>

      {/* 결과물 상세 — 크게 보기 오버레이(전체 내용 스크롤). */}
      {detail &&
        (() => {
          const art = artifactByKey.get(detail.key) ?? artifactByKind.get(detail.kind);
          const dSlot = art ? slotOf(art) : null;
          const dTitle = cardTitleOf(detail.kind, dSlot);
          return (
            <div className="ide-card-modal-backdrop" onPointerDown={() => setDetail(null)}>
              <div
                className="ide-card-modal"
                onPointerDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={dTitle}
              >
                <div className="ide-card-modal-head">
                  <i className={`codicon codicon-${cardIconOf(detail.kind, dSlot)}`} aria-hidden />
                  <span className="ide-card-modal-title">
                    {dTitle}
                    {detail.candidateNote ? " · 후보안" : ""}
                  </span>
                  <button
                    type="button"
                    className="ide-card-modal-close"
                    onClick={() => setDetail(null)}
                    aria-label="닫기"
                  >
                    <i className="codicon codicon-close" aria-hidden />
                  </button>
                </div>
                {detail.candidateNote && (
                  <div className="ide-cand-note">
                    <i className="codicon codicon-arrow-right" aria-hidden /> {detail.candidateNote}
                  </div>
                )}
                <div className="ide-card-modal-body ide-doc-light">
                  {art ? renderArtifactBody(art, brandName) : <p>내용을 불러올 수 없습니다.</p>}
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

/** 스레드 메시지 한 줄 — 아바타 + 작성자 + 텍스트(답글이면 들여쓰기). */
function CollabMsg({ type, text, reply }: { type: OasisType; text: string; reply?: boolean }) {
  const color = archetypeColor(type);
  return (
    <div className={`collab-msg ${reply ? "is-reply" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 번들 로컬 SVG 아바타 */}
      <img src={archetypeAvatar(type)} alt="" width={20} height={20} className="collab-msg-av" style={{ boxShadow: `0 0 0 2px ${color}` }} draggable={false} />
      <div className="collab-msg-body">
        <span className="collab-msg-author" style={{ color }}>
          {archetypeByType(type)?.label ?? type}
        </span>
        <span className="collab-msg-text">{text}</span>
      </div>
    </div>
  );
}
