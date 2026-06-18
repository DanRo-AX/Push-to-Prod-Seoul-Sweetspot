"use client";

// lib/demo/demo-mode.ts — `?demo=1` 시연 모드 감지.
//
// 시연 녹화(Playwright)는 네이티브 파일창(showDirectoryPicker/showOpenFilePicker)을 못 누른다.
// demo 모드에서는 파일창·느린 LLM 호출을 번들 fixture(golden-*)로 우회해 결정적·고속으로 흐른다.
// 실서비스 동작에는 영향 없음(쿼리 파라미터 있을 때만).

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("demo");
}
