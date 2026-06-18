"use client";

// lib/useCollab.ts — 작업 보드 멀티 에이전트 협업 시뮬레이션(피그마 풍).
//
// "차분하고 읽히는" 라운드 모델 — 한 번에 하나의 토론만 진행한다(틱당 1개 행동):
//   1) 한 결과물 카드를 골라 에이전트 A가 코멘트(토론 시작, 스레드 자동 펼침),
//   2) 다른 에이전트들이 직전 발화자에게 답글(대화처럼 2턴 이어짐),
//   3) 토론이 마무리되면 한 에이전트가 오케스트레이터에 새 명령을 올리고,
//   4) 오케스트레이터가 그 명령을 하달해 "후보안"을 만든다 — 결과물당 1개, 총 상한.
// 모든 카드에 후보안이 생기거나 상한에 도달하면 조용해진다(커서만 가볍게 이동).
//
// 상태/타이머만. 문구/타입은 lib/collab.ts, 렌더는 CanvasBoard. Math.random 사용(브라우저).

import { useCallback, useEffect, useRef, useState } from "react";
import { archetypeByType, type OasisType } from "@/lib/oasis";
import {
  candidateEffect,
  pickCandidateChanges,
  pickComment,
  pickEscalation,
  pickReply,
  type CardRect,
  type CollabAgent,
  type CollabCandidate,
  type CollabComment,
  type CollabEscalation,
} from "@/lib/collab";

const TICK_MS = 3800; // 느린 틱 — 한 번에 하나씩, 따라 읽히게
const ALL_TYPES: OasisType[] = ["P1", "P2", "P3", "P4", "P5"];
const MAX_THREAD_REPLIES = 2; // 코멘트 1 + 답글 2 = 한 토론 3발화
const CANDIDATE_CAP = 4; // 후보안 총 상한(결과물당은 1개)

const ri = (n: number) => Math.floor(Math.random() * n);
const label = (t: OasisType) => archetypeByType(t)?.label ?? t;

// 토론 중인 카드 둘레의 고정 슬롯(에이전트 index 로 결정) — 팀이 결과물을 둘러싸게.
function slotAround(c: CardRect, i: number): { x: number; y: number } {
  const slots = [
    { x: c.x - 42, y: c.y + 26 },
    { x: c.x + c.w + 12, y: c.y + 26 },
    { x: c.x - 42, y: c.y + 118 },
    { x: c.x + c.w + 12, y: c.y + 118 },
    { x: c.x + 44, y: c.y - 34 },
    { x: c.x + c.w - 76, y: c.y - 34 },
  ];
  return slots[i % slots.length];
}

export function useCollab(cardRects: CardRect[]) {
  const [active, setActive] = useState(false);
  const [agents, setAgents] = useState<CollabAgent[]>([]);
  const [comments, setComments] = useState<CollabComment[]>([]);
  const [escalations, setEscalations] = useState<CollabEscalation[]>([]);
  const [candidates, setCandidates] = useState<CollabCandidate[]>([]);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const seq = useRef(0);
  const nextId = (p: string) => `${p}${seq.current++}`;

  // 틱 클로저가 최신 값을 읽도록 ref 미러(의존성 없이).
  const cardsRef = useRef(cardRects);
  const agentsRef = useRef(agents);
  const commentsRef = useRef(comments);
  const escalationsRef = useRef(escalations);
  const candidatesRef = useRef(candidates);
  useEffect(() => {
    cardsRef.current = cardRects;
  }, [cardRects]);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);
  useEffect(() => {
    escalationsRef.current = escalations;
  }, [escalations]);
  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  // 진행 중 라운드(상태 아님 — 리렌더 불필요).
  const roundRef = useRef<{ kind: string; threadId: string | null; step: number } | null>(null);
  // 팀이 현재 둘러싼 카드 — 바뀔 때만 커서를 재배치(랜덤 이동 금지).
  const teamFocusRef = useRef<string | null>(null);

  const pointOn = (c: CardRect) => ({
    x: c.x + 16 + Math.random() * Math.max(20, c.w - 32),
    y: c.y + 16 + Math.random() * Math.min(Math.max(40, c.h - 32), 300),
  });

  const addAgent = useCallback((type: OasisType, x: number, y: number) => {
    const cards = cardsRef.current;
    const focus = cards.length ? cards[ri(cards.length)].kind : null;
    setAgents((prev) => {
      if (prev.some((a) => a.type === type)) return prev; // 한 유형당 하나
      return [...prev, { id: nextId("ag"), type, x, y, focusKind: focus }];
    });
    setActive(true);
  }, []);

  const start = useCallback(() => {
    const cards = cardsRef.current;
    setAgents((prev) => {
      if (prev.length > 0) return prev;
      return ALL_TYPES.slice(0, 4).map((type, i) => {
        const c = cards.length ? cards[i % cards.length] : null;
        const p = c ? pointOn(c) : { x: 80 + i * 60, y: 80 };
        return { id: nextId("ag"), type, x: p.x, y: p.y, focusKind: c?.kind ?? null };
      });
    });
    setActive(true);
  }, []);

  const pause = useCallback(() => setActive(false), []);
  const toggle = useCallback(() => {
    if (active) setActive(false);
    else start();
  }, [active, start]);

  // 시뮬레이션 틱 — 틱당 정확히 하나의 행동(읽히게).
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      const cards = cardsRef.current;
      const round = roundRef.current;

      // 0) 팀 이동 — 토론 중인 카드가 "바뀔 때만" 그 카드 둘레 고정 슬롯으로 모은다.
      //    (매 틱 랜덤 이동 금지 — 목적 있는 이동만: 팀이 다음 결과물을 함께 보러 간다.)
      const focusKind = round?.kind ?? null;
      if (
        focusKind &&
        focusKind !== teamFocusRef.current &&
        cards.some((c) => c.kind === focusKind)
      ) {
        teamFocusRef.current = focusKind;
        const fc = cards.find((x) => x.kind === focusKind)!;
        setAgents((prev) =>
          prev.map((a, i) => {
            const slot = slotAround(fc, i);
            return { ...a, x: slot.x, y: slot.y, focusKind };
          }),
        );
        return; // 이 틱은 이동만 — 다음 틱부터 발화(도착 후 토론)
      }

      const agentsNow = agentsRef.current;
      if (cards.length === 0 || agentsNow.length === 0) return;

      const cands = candidatesRef.current;
      const haveCandidate = new Set(cands.map((c) => c.sourceKind));

      // 1) 오케스트레이터 하달 — 대기 명령 1건을 후보안으로(결과물당 1, 총 상한).
      if (cands.length < CANDIDATE_CAP) {
        const esc = escalationsRef.current.find(
          (e) => !e.dispatched && !haveCandidate.has(e.targetKind),
        );
        if (esc) {
          setCandidates((cs) => [
            ...cs,
            {
              id: nextId("cd"),
              sourceKind: esc.targetKind,
              label: esc.targetLabel,
              fromType: esc.fromType,
              note: esc.text,
              changes: pickCandidateChanges(esc.fromType),
              effect: candidateEffect(esc.fromType),
            },
          ]);
          setEscalations((prev) => prev.map((e) => (e.id === esc.id ? { ...e, dispatched: true } : e)));
          return; // 이번 틱은 여기까지
        }
      }

      // 2) 라운드 시작 — 후보안 없는 카드 하나를 골라 토론.
      if (!round) {
        if (cands.length >= CANDIDATE_CAP) return; // 상한 — 조용히(커서만)
        const avail = cards.filter(
          (c) => !haveCandidate.has(c.kind) && !escalationsRef.current.some((e) => e.targetKind === c.kind),
        );
        if (avail.length === 0) return; // 다 끝남 — 조용히
        roundRef.current = { kind: avail[ri(avail.length)].kind, threadId: null, step: 0 };
        return; // 다음 틱부터 토론(커서가 먼저 모이게)
      }

      const card = cards.find((c) => c.kind === round.kind);
      if (!card) {
        roundRef.current = null;
        return;
      }

      // 2a) 토론 시작 — 여는 코멘트.
      if (round.step === 0) {
        const author = agentsNow[ri(agentsNow.length)];
        const id = nextId("cm");
        const onCard = commentsRef.current.filter((cm) => cm.kind === card.kind).length;
        setComments((prev) => [
          ...prev,
          {
            id,
            kind: card.kind,
            label: card.label,
            authorType: author.type,
            text: pickComment(author.type),
            x: card.x + card.w - 16,
            y: card.y + 14 + onCard * 30,
            replies: [],
            age: 0,
          },
        ]);
        round.threadId = id;
        round.step = 1;
        setOpenThread(id); // 라이브 토론 펼쳐 보이기
        return;
      }

      // 2b) 답글 — 직전 발화자에게 다른 에이전트가 답(대화처럼).
      const thread = round.threadId
        ? commentsRef.current.find((c) => c.id === round.threadId)
        : null;
      if (thread && thread.replies.length < MAX_THREAD_REPLIES) {
        const lastSpeaker =
          thread.replies.length > 0
            ? thread.replies[thread.replies.length - 1].authorType
            : thread.authorType;
        const others = agentsNow.filter((a) => a.type !== lastSpeaker);
        const pool = others.length ? others : agentsNow;
        const replier = pool[ri(pool.length)];
        setComments((prev) =>
          prev.map((cm) =>
            cm.id === round.threadId
              ? { ...cm, replies: [...cm.replies, { authorType: replier.type, text: pickReply(label(lastSpeaker)) }] }
              : cm,
          ),
        );
        setOpenThread(round.threadId);
        round.step += 1;
        return;
      }

      // 2c) 마무리 — 오케스트레이터에 새 명령 1건(다음 틱에 하달 → 후보안).
      const fromType = thread ? thread.authorType : agentsNow[0].type;
      setEscalations((prev) => {
        if (prev.some((e) => e.targetKind === card.kind)) return prev; // 결과물당 1
        return [
          ...prev,
          {
            id: nextId("es"),
            fromType,
            text: pickEscalation(fromType),
            targetKind: card.kind,
            targetLabel: card.label,
            age: 0,
            dispatched: false,
          },
        ];
      });
      roundRef.current = null; // 다음 라운드는 다른 카드로
    }, TICK_MS);

    return () => clearInterval(iv);
  }, [active]);

  const reset = useCallback(() => {
    roundRef.current = null;
    teamFocusRef.current = null;
    setAgents([]);
    setComments([]);
    setEscalations([]);
    setCandidates([]);
    setOpenThread(null);
    setActive(false);
  }, []);

  return {
    active,
    agents,
    comments,
    escalations,
    candidates,
    openThread,
    setOpenThread,
    addAgent,
    start,
    pause,
    toggle,
    reset,
  };
}
