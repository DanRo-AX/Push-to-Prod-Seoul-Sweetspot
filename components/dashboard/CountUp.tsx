"use client";

// 숫자 카운트업 — KPI 스트립 전용.
// rAF + ease-out cubic. prefers-reduced-motion 환경에서는 즉시 최종값을 표시한다.
// 라이브 아티팩트로 값이 갱신되면 현재 표시값에서 새 값으로 이어서 카운트한다.

import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, durationMs = 900): number {
  const [display, setDisplay] = useState(0);
  // 진행 중 표시값 추적 — 갱신이 끼어들어도 현재 값에서 이어 달린다
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || fromRef.current === target) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const value = Math.round(from + (target - from) * easeOutCubic(p));
      fromRef.current = value;
      setDisplay(value);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return display;
}

export function CountUp({ value }: { value: number }) {
  const display = useCountUp(value);
  return <>{display.toLocaleString()}</>;
}
