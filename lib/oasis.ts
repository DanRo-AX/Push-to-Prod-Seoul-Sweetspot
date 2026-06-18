// lib/oasis.ts — OASIS 오디언스 페르소나 (클라이언트 안전 순수 모듈).
//
// IDE 우측 사이드패널이 보여 주는 "OASIS 오디언스 페르소나"가 이 모듈에서 파생된다.
// data/oasis-personas.json (popga-OASIS-engine 큐레이션 — GA4 행동 + Nemotron 실분포
// 기반 베이지안 네트워크로 생성한 가상 설문 페르소나 500명)을 타입과 함께 노출한다.
//
// 규칙(lib/personas.ts 와 동일 결):
// - 순수 데이터/매핑만. React/DOM/SVG 마크업 없음(카드 마크업은 컴포넌트에서).
//   여기서는 타입·상수·헬퍼(색/필터/집계)만 제공한다.
// - 색(archetypeColor)은 VS Code "Dark Modern" 톤에 맞춘 절제된 P1~P5 팔레트.
//   사용처는 이 색을 .persona-arch 의 막대/칩에 주입한다(globals.css 무수정).
// - JSON 은 import 1곳(여기)에서만 읽고, 타입 단언으로 계약을 고정한다.

import oasisRaw from "@/data/oasis-personas.json";

/** 아키타입 식별자 — P1~P5 (data/oasis-personas.json 의 type 과 1:1). */
export type OasisType = "P1" | "P2" | "P3" | "P4" | "P5";

/** 페르소나(에이전트) rail → 작업 보드 드래그-드롭 페이로드 MIME. 페이로드 = OasisType. */
export const ARCHETYPE_DND = "application/x-oasis-archetype";

/** 아키타입(군집) — 5개 페르소나 유형. 분포 막대/라벨/설명의 원천. */
export interface OasisArchetype {
  type: OasisType; // P1~P5
  label: string; // 한국어 유형명 (예: "트렌드 헌터")
  count: number; // 500명 중 이 유형의 인원 수
  desc: string; // 유형 한 줄 설명
}

/** 샘플 프로필 — 드릴다운용 개별 페르소나(아키타입 대표 표본). */
export interface OasisPersona {
  id: string; // 8자리 해시 식별자
  type: OasisType; // 소속 아키타입(P1~P5)
  label: string; // 소속 아키타입 라벨(중복 보관 — 표시 편의)
  name: string; // 가상 이름 (예: "정지현")
  age: number;
  gender: string; // "여성" | "남성"
  occupation: string; // 직업군
  location: string; // 거주 지역
  monthly_popup_visits: number; // 월평균 팝업 방문 횟수
  personality_traits: string[]; // 성향 칩
  key_pain_points: string[]; // 페인포인트
  decision_style: string; // 의사결정 스타일 한 줄
  background: string; // 배경 서술
}

/** data/oasis-personas.json 전체 형상(엔진 산출물 메타 포함). */
export interface OasisData {
  source: string; // 원천 파일/엔진
  note: string; // 엔진 정체 설명(헤더 노출용)
  total: number; // 생성 페르소나 총원 (500)
  archetypes: OasisArchetype[];
  samples: OasisPersona[];
}

/** 타입이 박힌 OASIS 데이터셋. (JSON → 계약 단언) */
export const OASIS = oasisRaw as OasisData;

/** 전체 페르소나 수(= OASIS.total). 분모/헤더 카운터용. */
export const total: number = OASIS.total;

// ── 아키타입 색 팔레트 (P1~P5) ──────────────────────────────────────
// VS Code "Dark Modern" 토큰 톤에 맞춘 절제된 색. 다크 면에서 또렷하되 네온/발광 금지.
//   P1 트렌드 헌터       = 청록 (#4ec9b0, type 토큰 계열)
//   P2 코스 플래너       = 블루 (#569cd6, keyword 토큰 계열)
//   P3 캐주얼 방문자     = 무채 슬레이트 (#9d9d9d, 가장 큰 군집 — 차분하게)
//   P4 콘텐츠 크리에이터 = 옐로 (#dcdcaa, function 토큰 계열)
//   P5 브랜드/IP 충성팬  = 퍼플 (#c586c0, control 토큰 계열)
const ARCHETYPE_COLOR: Record<OasisType, string> = {
  P1: "#4ec9b0",
  P2: "#569cd6",
  P3: "#9d9d9d",
  P4: "#dcdcaa",
  P5: "#c586c0",
};

/** 아키타입(P1~P5) → 색(HEX). 알 수 없는 타입은 흐린 무채로 폴백. */
export function archetypeColor(type: OasisType | string): string {
  return ARCHETYPE_COLOR[type as OasisType] ?? "#868686";
}

// 타입별 샘플 역인덱스 (모듈 로드 시 1회 구성).
const SAMPLES_BY_TYPE: Record<string, OasisPersona[]> = (() => {
  const map: Record<string, OasisPersona[]> = {};
  for (const s of OASIS.samples) {
    (map[s.type] ??= []).push(s);
  }
  return map;
})();

/** 한 아키타입에 속한 샘플 프로필 목록(드릴다운용). 없으면 빈 배열. */
export function samplesByType(type: OasisType | string): OasisPersona[] {
  return SAMPLES_BY_TYPE[type] ?? [];
}

/** 아키타입 인원 수가 전체에서 차지하는 비율(%) — 분포 막대 폭/라벨용.
 *  count 우선 사용, 없으면 0. 소수 1자리 반올림(예: 44.2). */
export function percent(count: number): number {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

/** type 으로 아키타입 메타를 찾는다(라벨/설명/수 조회 보조). */
export function archetypeByType(type: OasisType | string): OasisArchetype | null {
  return OASIS.archetypes.find((a) => a.type === type) ?? null;
}

// ── 노셔니스트(Notionists) 프로필 아바타 ──────────────────────────────
// popga 프론트엔드와 동일: DiceBear Notionists. 단 오프라인 데모를 위해
// 빌드 타임에 미리 받아 public/avatars/*.svg 로 번들(런타임 외부 의존 0).
// 아키타입 대표 = arch-<type>.svg, 개별 표본 = p-<id>.svg.

/** 아키타입 대표 노셔니스트 아바타 경로. */
export function archetypeAvatar(type: OasisType | string): string {
  return `/avatars/arch-${type}.svg`;
}

/** 개별 표본 페르소나의 노셔니스트 아바타 경로. */
export function personaAvatar(persona: { id: string }): string {
  return `/avatars/p-${persona.id}.svg`;
}
