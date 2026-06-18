"use client";

// SSE 소비 + 에이전트 실행 상태 관리 훅.
// /api/agent, /api/replay 가 내려주는 AgentEvent 스트림을 파싱해 UI 상태로 변환한다.

import { useCallback, useEffect, useRef, useState } from "react";
import { artifactKey, type AgentEvent, type ApprovalRequest, type Artifact, type RunMode } from "@/lib/types";

// 골든런 리플레이의 approval_required → approval_resolved 간격(~1.2초)은
// human-in-the-loop 모달을 보여주기에 너무 짧다. 리플레이에서는 approval_required
// 수신 시 이후 이벤트를 로컬 큐에 잡아두고(모달 유지), 발표자가 승인/거부를 누르거나
// 최소 체류 시간이 지나면 큐를 flush 한다. (lib/agent·app/api 무변경 — 순수 클라이언트 처리)
const REPLAY_APPROVAL_HOLD_MS = 5000;

export interface UseAgentStreamResult {
  events: AgentEvent[];
  artifacts: Artifact[];
  streamingText: string;
  approval: ApprovalRequest | null;
  running: boolean;
  /** 실행 모드 — start() 는 "live", startReplay() 는 "replay", 실행 중이 아니면 "idle" */
  mode: RunMode;
  error: string | null;
  /** extra 는 /api/agent body 에 병합된다(예: { rfp, scenarioId }). */
  start: (message: string, extra?: Record<string, unknown>) => Promise<void>;
  /** 산출물을 보드에 직접 추가(문서타입 지정 시 카드로). */
  addArtifact: (artifact: Artifact) => void;
  /** 보드 카드 제거. slotId 주면 그 슬롯 카드만, 없으면 kind 전체. */
  removeArtifact: (kind: Artifact["kind"], slotId?: string) => void;
  /** 보드 전체를 주어진 아티팩트로 복원(폴더 진행 상태 로드). */
  loadArtifacts: (list: Artifact[]) => void;
  /** 채팅 스레드에 이벤트 직접 주입(오케스트레이터: 사용자/어시스턴트/페르소나 코멘트). */
  pushEvent: (event: AgentEvent) => void;
  /** 내 문서를 페르소나와 논의(/api/btl/discuss). personaIds 지정 시 그들만, 없으면 슬롯 전원. reviewPoints=카드 검토 의제. */
  discuss: (file: File, slotId: string, fileName: string, personaIds?: string[], reviewPoints?: string[]) => Promise<void>;
  startReplay: (speed?: number) => Promise<void>;
  resolveApproval: (approvalId: string, approved: boolean) => Promise<void>;
  /** 카드 액션용 승인 게이트 — 전역 모달을 띄우고 사용자가 승인/취소할 때까지 기다린다(외부 비가역 액션 보호). */
  requestApproval: (approval: ApprovalRequest) => Promise<boolean>;
}

export function useAgentStream(): UseAgentStreamResult {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 마지막으로 시작한 실행 경로 — running 이 아닐 때 mode 는 항상 "idle" 로 파생된다.
  const [lastMode, setLastMode] = useState<RunMode>("idle");

  // 클로저 stale 방지용 ref
  const runningRef = useRef(false);
  const streamingRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const lastModeRef = useRef<RunMode>("idle");

  // 리플레이 승인 홀드 상태 — 모달 유지 중 도착한 이벤트를 큐에 버퍼링한다.
  const holdingRef = useRef(false);
  const holdQueueRef = useRef<AgentEvent[]>([]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // dispatch ↔ flush 순환 참조 회피용 최신 참조
  const flushHoldRef = useRef<() => void>(() => {});

  const clearHold = useCallback(() => {
    holdingRef.current = false;
    holdQueueRef.current = [];
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // 누적 중인 text_delta 를 events 에 고정 말풍선으로 밀어넣고 비운다.
  const flushStreaming = useCallback(() => {
    const text = streamingRef.current;
    if (!text) return;
    streamingRef.current = "";
    setStreamingText("");
    setEvents((prev) => [...prev, { type: "text_delta", text }]);
  }, []);

  const dispatch = useCallback(
    (event: AgentEvent) => {
      // 승인 홀드 중 — 이후 이벤트는 화면에 반영하지 않고 큐에 쌓는다 (모달 유지)
      if (holdingRef.current) {
        holdQueueRef.current.push(event);
        return;
      }

      if (event.type === "text_delta") {
        streamingRef.current += event.text;
        setStreamingText(streamingRef.current);
        return;
      }

      // text_delta 가 아닌 이벤트가 오면 현재 말풍선을 분리(고정)한다.
      flushStreaming();

      switch (event.type) {
        case "artifact":
          setArtifacts((prev) => [...prev, event.artifact]);
          break;
        case "approval_required":
          setApproval(event.approval);
          // 리플레이에서는 녹화된 approval_resolved 가 ~1.2초 만에 도착하므로
          // 홀드를 걸어 발표자가 직접 '승인하고 발송'을 누를 시간을 확보한다.
          if (lastModeRef.current === "replay") {
            holdingRef.current = true;
            holdTimerRef.current = setTimeout(
              () => flushHoldRef.current(),
              REPLAY_APPROVAL_HOLD_MS,
            );
          }
          break;
        case "approval_resolved":
          setApproval(null);
          break;
        case "status":
          if (event.status === "done" || event.status === "error") {
            runningRef.current = false;
            setRunning(false);
          }
          if (event.status === "error") {
            setError(event.message ?? "에이전트 실행 중 오류가 발생했습니다.");
          }
          break;
      }

      setEvents((prev) => [...prev, event]);
    },
    [flushStreaming],
  );

  // 승인 홀드 해제 — 큐에 잡아둔 이벤트를 순서대로 재생한다.
  // (큐 선두의 approval_resolved 가 모달을 닫고 이후 발송·완료 이벤트가 이어진다)
  const flushApprovalHold = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const queued = holdQueueRef.current;
    holdQueueRef.current = [];
    for (const e of queued) dispatch(e);
  }, [dispatch]);
  flushHoldRef.current = flushApprovalHold;

  // 공통 SSE 실행기: POST 후 res.body 를 읽어 "\n\n" 단위로 파싱한다.
  const runStream = useCallback(
    async (url: string, body: unknown) => {
      if (runningRef.current) return; // 중복 실행 방지

      // 직전 스트림이 잔존해 있으면 정리 (승인 홀드 큐 포함)
      abortRef.current?.abort();
      clearHold();

      runningRef.current = true;
      setRunning(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // FormData 면 멀티파트로 그대로(헤더 자동), 아니면 JSON.
        const isForm = typeof FormData !== "undefined" && body instanceof FormData;
        const res = await fetch(url, {
          method: "POST",
          headers: isForm ? undefined : { "Content-Type": "application/json" },
          body: isForm ? (body as FormData) : JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`서버 응답 오류 (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE 이벤트 경계는 빈 줄("\n\n")
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            for (const line of chunk.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const json = trimmed.slice(5).trim();
              if (!json) continue;
              try {
                dispatch(JSON.parse(json) as AgentEvent);
              } catch {
                // 깨진 JSON 조각은 무시 (데모 안정성 우선)
              }
            }
          }
        }

        flushStreaming(); // 스트림 종료 시 남은 텍스트 고정
      } catch (e) {
        const isAbort = e instanceof DOMException && e.name === "AbortError";
        if (!isAbort) {
          setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
        }
      } finally {
        runningRef.current = false;
        setRunning(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [clearHold, dispatch, flushStreaming],
  );

  const start = useCallback(
    (message: string, extra?: Record<string, unknown>) => {
      if (!runningRef.current) {
        setLastMode("live");
        lastModeRef.current = "live";
        // 채팅 UI 용 — 내가 보낸 메시지를 대화 스레드에 즉시 표시 (서버 미발행, 클라이언트 로컬)
        setEvents((prev) => [...prev, { type: "user_message", text: message }]);
      }
      return runStream("/api/agent", { message, ...extra });
    },
    [runStream],
  );

  // 산출물을 보드에 직접 추가(SSE 외 — 워크플로 폴더에서 문서타입 지정 시 카드로 띄움).
  // 같은 '키'는 최신본으로 교체. 키 = kind (+ slotId 가 있으면 슬롯별 분리 — 제네릭
  // bound-doc 처럼 한 kind 가 슬롯마다 별 카드인 경우 대응).
  // 보드 카드 추가/교체 — 보드는 artifacts '상태'로 렌더한다. 채팅엔 이벤트를 넣지 않는다
  // (카드 추가는 보드의 시각적 동작이지 대화가 아니다 — "산출물 보드에 추가됨" 스팸 방지).
  const addArtifact = useCallback((artifact: Artifact) => {
    const key = artifactKey(artifact);
    setArtifacts((prev) => [...prev.filter((a) => artifactKey(a) !== key), artifact]);
  }, []);

  // 보드 전체 복원 — 폴더 .octopus/board.json 로드 시. 상태만 세팅(채팅 비오염).
  const loadArtifacts = useCallback((list: Artifact[]) => {
    setArtifacts(list);
  }, []);

  const pushEvent = useCallback((event: AgentEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  // 보드 카드 제거 — 슬롯 지정 해제 시. slotId 주면 그 슬롯 카드만, 없으면 kind 전체.
  const removeArtifact = useCallback((kind: Artifact["kind"], slotId?: string) => {
    const match = (a: Artifact) =>
      a.kind === kind && (slotId === undefined || ("slotId" in a && a.slotId === slotId));
    setArtifacts((prev) => prev.filter((a) => !match(a)));
    setEvents((prev) =>
      prev.filter((e) => !(e.type === "artifact" && match(e.artifact))),
    );
  }, []);

  // 내 문서를 페르소나들과 논의 — /api/btl/discuss 멀티파트 SSE.
  // personaIds 지정 시 그 페르소나들(카드에 끌어다 놓은 방문객 군집/팀원), 없으면 슬롯 담당 전원.
  const discuss = useCallback(
    (file: File, slotId: string, fileName: string, personaIds?: string[], reviewPoints?: string[]) => {
      if (runningRef.current) return Promise.resolve();
      setLastMode("live");
      lastModeRef.current = "live";
      setEvents((prev) => [
        ...prev,
        { type: "user_message", text: `「${fileName}」 관련 페르소나와 논의` },
      ]);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slotId", slotId);
      if (personaIds?.length) fd.append("personaIds", JSON.stringify(personaIds));
      if (reviewPoints?.length) fd.append("reviewPoints", JSON.stringify(reviewPoints));
      return runStream("/api/btl/discuss", fd);
    },
    [runStream],
  );

  const startReplay = useCallback(
    (speed: number = 1) => {
      if (!runningRef.current) {
        setLastMode("replay");
        lastModeRef.current = "replay";
      }
      return runStream("/api/replay", { speed });
    },
    [runStream],
  );

  // 카드 액션이 띄운 승인(엔진 SSE 와 무관) — 로컬 resolver 로 결과를 돌려준다.
  const pendingApprovalRef = useRef<{ id: string; resolve: (v: boolean) => void } | null>(null);
  const requestApproval = useCallback((req: ApprovalRequest): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      pendingApprovalRef.current = { id: req.id, resolve };
      setApproval(req);
    });
  }, []);

  const resolveApproval = useCallback(
    async (approvalId: string, approved: boolean) => {
      // 카드 액션 승인이면 — /api/approve 로 안 보내고 로컬 resolver 로 끝낸다.
      const pending = pendingApprovalRef.current;
      if (pending && pending.id === approvalId) {
        pendingApprovalRef.current = null;
        setApproval(null);
        pending.resolve(approved);
        return;
      }
      setApproval(null); // 서버 이벤트(approval_resolved)도 오지만 즉시 반응

      // 리플레이 홀드 중이면 큐 flush 만으로 충분 — 녹화에 approval_resolved 가
      // 이미 포함되어 있으므로 /api/approve 회신은 보내지 않는다.
      if (holdingRef.current) {
        flushApprovalHold();
        return;
      }

      try {
        await fetch("/api/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalId, approved }),
        });
      } catch {
        setError("승인 응답 전송에 실패했습니다.");
      }
    },
    [flushApprovalHold],
  );

  // 언마운트 시 진행 중인 스트림·홀드 타이머 정리
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
    };
  }, []);

  return {
    events,
    artifacts,
    streamingText,
    approval,
    running,
    mode: running ? lastMode : "idle",
    error,
    start,
    addArtifact,
    removeArtifact,
    loadArtifacts,
    pushEvent,
    discuss,
    startReplay,
    resolveApproval,
    requestApproval,
  };
}
