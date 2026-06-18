"use client";

// components/ide/SchedulePanel.tsx — 우측 패널의 "스케줄" 섹션.
//
// 에이전트가 알아서 수행할 작업을 등록한다(업무 + 주기). 등록한 스케줄은 브라우저에
// 저장되고, 틱 타이머가 예정 시각이 되면 해당 지시를 에이전트에게 자동 전달한다
// (onRun = 콘솔의 start). 실행 중이면 겹치지 않게 대기했다가 끝나면 수행한다.
//
// 데모용 주기 프리셋: 매일 오전 9시 / 매주 월 오전 9시 / 1분 뒤(테스트) / 5분마다(테스트).
// 실제 cron 백엔드 없이 클라이언트 타이머로 "알아서 수행"을 시연한다(엔진/SSE 무영향).

import { useCallback, useEffect, useRef, useState } from "react";

const STORE_KEY = "octopus.schedules.v1";

// 등록 가능한 업무(지시문) 프리셋 — 콘솔 프리셋과 동일 결.
const TASKS: { label: string; prompt: string }[] = [
  { label: "아침 브리핑", prompt: "오늘 아침 브리핑 만들어줘" },
  { label: "콘텐츠 초안", prompt: "이번 주 인스타 콘텐츠 3개 초안 만들어줘" },
  { label: "콜드메일 시퀀스", prompt: "타겟 리드 대상 콜드메일 시퀀스를 작성해줘" },
  { label: "성과 지표 브리핑", prompt: "이번 주 성과 지표를 브리핑으로 정리해줘" },
];

// 주기 프리셋.
const WHENS: { key: WhenKey; label: string }[] = [
  { key: "daily9", label: "매일 오전 9시" },
  { key: "weekly_mon9", label: "매주 월 오전 9시" },
  { key: "in1", label: "1분 뒤 (테스트)" },
  { key: "every5", label: "5분마다 (테스트)" },
];

type WhenKey = "daily9" | "weekly_mon9" | "in1" | "every5";

interface Schedule {
  id: string;
  taskLabel: string;
  prompt: string;
  whenKey: WhenKey;
  whenLabel: string;
  enabled: boolean;
  nextRun: number; // epoch ms
  lastRun?: number;
}

/** 다음 실행 시각(epoch ms) — whenKey + 기준 시각에서 계산. */
function computeNextRun(whenKey: WhenKey, from: number): number {
  if (whenKey === "in1") return from + 60_000;
  if (whenKey === "every5") return from + 5 * 60_000;
  const n = new Date(from);
  n.setHours(9, 0, 0, 0);
  if (whenKey === "daily9") {
    if (n.getTime() <= from) n.setDate(n.getDate() + 1);
    return n.getTime();
  }
  // weekly_mon9 — 다음 월요일 09:00.
  let add = (1 - n.getDay() + 7) % 7;
  if (add === 0 && n.getTime() <= from) add = 7;
  n.setDate(n.getDate() + add);
  return n.getTime();
}

/** 다음 실행까지 상대 시간 라벨. */
function relativeLabel(nextRun: number, now: number): string {
  const diff = nextRun - now;
  if (diff <= 0) return "지금";
  const m = Math.round(diff / 60_000);
  if (m < 1) return "곧";
  if (m < 60) return `${m}분 후`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 후`;
  const d = new Date(nextRun);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export interface SchedulePanelProps {
  /** 예정 시각 도달 시 에이전트에게 전달할 지시 실행기(콘솔의 start). */
  onRun?: (prompt: string) => void;
  /** 실행 중이면 겹치지 않게 대기. */
  running?: boolean;
}

export function SchedulePanel({ onRun, running }: SchedulePanelProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [taskIdx, setTaskIdx] = useState(0);
  const [whenIdx, setWhenIdx] = useState(0);
  const [now, setNow] = useState(0);
  const [justFired, setJustFired] = useState<string | null>(null);

  // 최신 onRun/running 을 타이머 클로저가 읽도록 ref 미러.
  const onRunRef = useRef(onRun);
  const runningRef = useRef(running);
  useEffect(() => {
    onRunRef.current = onRun;
    runningRef.current = running;
  }, [onRun, running]);

  // 초기 로드(클라이언트) — 하이드레이션 불일치 방지로 마운트 후 1회 외부 저장소 동기화.
  // localStorage 는 SSR 에서 읽을 수 없어 effect 에서 1회 동기화한다(의도된 setState).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let loaded: Schedule[] = [];
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) loaded = JSON.parse(raw) as Schedule[];
    } catch {
      // 파싱 실패 — 빈 목록으로 시작(무해).
    }
    setNow(Date.now());
    setSchedules(loaded);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 변경 시 저장.
  useEffect(() => {
    if (now === 0) return; // 초기 로드 전엔 저장하지 않음(빈 배열 덮어쓰기 방지).
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(schedules));
    } catch {
      // 저장 실패 — 무해.
    }
  }, [schedules, now]);

  // 틱 — 예정 도달 스케줄을 자동 실행(실행 중이면 대기).
  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      setSchedules((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          if (!s.enabled || s.nextRun > t) return s;
          if (runningRef.current) return s; // 실행 중 — 대기(다음 틱에 재시도)
          changed = true;
          onRunRef.current?.(s.prompt);
          setJustFired(s.id);
          setTimeout(() => setJustFired((cur) => (cur === s.id ? null : cur)), 4000);
          if (s.whenKey === "in1") return { ...s, enabled: false, lastRun: t };
          return { ...s, lastRun: t, nextRun: computeNextRun(s.whenKey, t) };
        });
        return changed ? next : prev;
      });
    };
    const iv = setInterval(tick, 10_000);
    return () => clearInterval(iv);
  }, []);

  const addSchedule = useCallback(() => {
    const task = TASKS[taskIdx];
    const when = WHENS[whenIdx];
    const t = Date.now();
    setSchedules((prev) => [
      ...prev,
      {
        id: `sch-${t}-${prev.length}`,
        taskLabel: task.label,
        prompt: task.prompt,
        whenKey: when.key,
        whenLabel: when.label,
        enabled: true,
        nextRun: computeNextRun(when.key, t),
      },
    ]);
  }, [taskIdx, whenIdx]);

  const toggle = (id: string) =>
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              enabled: !s.enabled,
              nextRun: !s.enabled ? computeNextRun(s.whenKey, Date.now()) : s.nextRun,
            }
          : s,
      ),
    );

  const runNow = (id: string) => {
    const s = schedules.find((x) => x.id === id);
    if (!s) return;
    if (runningRef.current) return;
    onRunRef.current?.(s.prompt);
    setJustFired(id);
    setTimeout(() => setJustFired((cur) => (cur === id ? null : cur)), 4000);
  };

  const remove = (id: string) =>
    setSchedules((prev) => prev.filter((s) => s.id !== id));

  return (
    <section className="ide-sched" aria-label="스케줄">
      <div className="ide-side-header">
        <i className="codicon codicon-watch" aria-hidden />
        <span>스케줄 ({schedules.length})</span>
        <span className="ide-sidebar-actions">
          <span className="ide-badge">자동 실행</span>
        </span>
      </div>

      {/* 등록 폼 — 업무 + 주기 + 추가. */}
      <div className="ide-sched-add">
        <select
          className="ide-sched-select"
          value={taskIdx}
          onChange={(e) => setTaskIdx(Number(e.target.value))}
          aria-label="업무"
        >
          {TASKS.map((t, i) => (
            <option key={t.label} value={i}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className="ide-sched-select"
          value={whenIdx}
          onChange={(e) => setWhenIdx(Number(e.target.value))}
          aria-label="주기"
        >
          {WHENS.map((w, i) => (
            <option key={w.key} value={i}>
              {w.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ide-sched-addbtn"
          onClick={addSchedule}
          title="스케줄 등록"
        >
          <i className="codicon codicon-add" aria-hidden />
          등록
        </button>
      </div>

      {/* 등록 목록. */}
      <div className="ide-sched-list">
        {schedules.length === 0 ? (
          <p className="ide-sched-empty">
            등록한 스케줄이 없습니다. 업무와 주기를 골라 추가하면 에이전트가 예정 시각에
            알아서 실행합니다.
          </p>
        ) : (
          schedules.map((s) => (
            <div
              key={s.id}
              className={`ide-sched-item ${s.enabled ? "" : "is-off"} ${justFired === s.id ? "is-fired" : ""}`}
            >
              <button
                type="button"
                className={`ide-sched-toggle ${s.enabled ? "on" : ""}`}
                onClick={() => toggle(s.id)}
                aria-pressed={s.enabled}
                title={s.enabled ? "사용 중 — 끄기" : "꺼짐 — 켜기"}
              >
                <i
                  className={`codicon ${s.enabled ? "codicon-circle-large-filled" : "codicon-circle-large-outline"}`}
                  aria-hidden
                />
              </button>
              <div className="ide-sched-info">
                <span className="ide-sched-task">{s.taskLabel}</span>
                <span className="ide-sched-meta">
                  {s.whenLabel}
                  {s.enabled && (
                    <>
                      {" · "}
                      <span className="ide-sched-next">
                        {justFired === s.id ? "방금 실행됨" : `다음 ${relativeLabel(s.nextRun, now)}`}
                      </span>
                    </>
                  )}
                </span>
              </div>
              <button
                type="button"
                className="ide-sched-run"
                onClick={() => runNow(s.id)}
                disabled={running}
                title="지금 실행"
                aria-label="지금 실행"
              >
                <i className="codicon codicon-play" aria-hidden />
              </button>
              <button
                type="button"
                className="ide-sched-del"
                onClick={() => remove(s.id)}
                title="삭제"
                aria-label="삭제"
              >
                <i className="codicon codicon-trash" aria-hidden />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
