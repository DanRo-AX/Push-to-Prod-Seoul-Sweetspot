// lib/live-assets.ts — 라이브 작업뷰 이미지 매니페스트 + 도구→창종류 매핑 헬퍼.
//
// 클라이언트/서버 어디서든 import 가능한 순수 모듈(부수효과 없음, "use client" 불요).
// public/live/ 에 번들된 무료 사진(thumb-1..6 640x400 · tile-1..6 360x360 · cover 1280x640)을
// 결정론적으로 골라, 같은 toolUseId 는 항상 같은 사진이 뜨도록 한다.
//
// 사진은 사용처에서 .photo-warm 필터(app/globals.css)를 입혀 에디토리얼 톤으로 통일한다.

/** 브라우저/분석 창 썸네일(640x400). 사이트 미리보기·스캔 시머 배경용. */
export const THUMBS = [
  "/live/thumb-1.jpg",
  "/live/thumb-2.jpg",
  "/live/thumb-3.jpg",
  "/live/thumb-4.jpg",
  "/live/thumb-5.jpg",
  "/live/thumb-6.jpg",
] as const;

/** 검색 결과 타일(360x360). 검색 창 결과 행/타일용. */
export const TILES = [
  "/live/tile-1.jpg",
  "/live/tile-2.jpg",
  "/live/tile-3.jpg",
  "/live/tile-4.jpg",
  "/live/tile-5.jpg",
  "/live/tile-6.jpg",
] as const;

/** 와이드 커버(1280x640). 대형 배경/히어로용. */
export const COVER = "/live/cover.jpg" as const;

/**
 * 도구 실행을 "어떤 창이 열렸나"로 매핑한 종류.
 * - browser   : 주소창+트래픽라이트 점 + 사이트 썸네일 + 파비콘 + 스캔 시머
 * - search    : 쿼리 줄 + 결과 행/타일
 * - document  : 타이핑되는 줄(에디터/문서)
 * - analytics : 미니 차트/지표 행
 * - generic   : 그 외 일반 작업 창
 */
export type WindowKind = "browser" | "search" | "document" | "analytics" | "generic";

// 도구명 → 창종류 매핑 테이블(컨셉 문서 기준). 알 수 없는 도구는 generic 으로 폴백.
const WINDOW_KIND_MAP: Record<string, WindowKind> = {
  // 브라우저 창 — 외부 사이트/대시보드를 들여다보는 도구
  monitor_competitors: "browser",
  audit_tracking_setup: "browser",
  fetch_search_console: "browser",
  fetch_instagram_insights: "browser",
  query_ga_bigquery: "browser",

  // 검색 창 — 쿼리를 던지고 결과를 훑는 도구
  analyze_keywords: "search",
  analyze_keyword_journey: "search",
  optimize_subject_lines: "search",
  list_outbound_contacts: "search",

  // 문서/에디터 창 — 글을 써 내려가는 도구
  draft_newsletter: "document",
  draft_instagram_posts: "document",
  propose_cold_emails: "document",
  plan_content_calendar: "document",
  plan_email_sequence: "document",
  critique_copy: "document",
  publish_briefing: "document",

  // 분석 창 — 지표/차트를 뽑아 보는 도구
  analyze_funnel: "analytics",
  show_metrics: "analytics",
  track_content_performance: "analytics",
  analyze_lead_journey: "analytics",
  analyze_content_attribution: "analytics",
  track_follower_growth: "analytics",
  analyze_newsletter_performance: "analytics",
  read_crm: "analytics",
  schedule_follow_ups: "analytics",
};

/** 도구명으로 창종류를 결정한다. 미등록 도구는 "generic". */
export function windowKindFor(toolName: string): WindowKind {
  return WINDOW_KIND_MAP[toolName] ?? "generic";
}

// FNV-1a 32비트 해시 — 작고 결정론적. 같은 seed 는 항상 같은 인덱스를 낸다.
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // 부호 없는 32비트로 환산
  return h >>> 0;
}

/** seed(보통 toolUseId)로 썸네일을 결정론적으로 고른다. */
export function pickThumb(seed: string): string {
  return THUMBS[hash(seed) % THUMBS.length];
}

/** seed(보통 toolUseId)로 타일을 결정론적으로 고른다. */
export function pickTile(seed: string): string {
  return TILES[hash(seed) % TILES.length];
}
