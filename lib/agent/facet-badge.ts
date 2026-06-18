// lib/agent/facet-badge.ts
// Facet 배지·인디케이터 순수 로직 함수
// — ProvenanceBadge / ModeIndicator 컴포넌트가 소비
// — 순수 함수이므로 vitest node 환경에서 DOM 없이 테스트 가능

import type { FacetProvenance, FacetMode } from "@/lib/types";

// ── ProvenanceBadgeProps ──────────────────────────────────────────────────────

export interface ProvenanceBadgeProps {
  label: string;       // 배지 표시 텍스트
  colorFg: string;     // 전경(텍스트) CSS 색상
  colorBg: string;     // 배경 CSS 색상
  colorBorder: string; // 테두리 CSS 색상
  description: string; // 툴팁/aria 설명
}

/**
 * FacetProvenance 값을 시각 배지 속성으로 변환한다.
 * 워밍 에디토리얼 팔레트(#f4efe6 바탕 + 버밀리언 단일 액센트) 기준.
 */
export function getProvenanceBadgeProps(provenance: FacetProvenance): ProvenanceBadgeProps {
  switch (provenance) {
    case "rfp":
      return {
        label: "RFP",
        colorFg: "#1a3a5c",
        colorBg: "#ddeeff",
        colorBorder: "#6699cc",
        description: "RFP에서 직접 파생된 facet — 검증 우선",
      };
    case "research":
      return {
        label: "리서치",
        colorFg: "#1a4a2e",
        colorBg: "#d6f0e0",
        colorBorder: "#5aaa7a",
        description: "리서치 digest가 근거인 facet",
      };
    case "generated":
      return {
        label: "생성",
        colorFg: "#7a3800",
        colorBg: "#fff0d6",
        colorBorder: "#cc8833",
        description: "시스템이 생성한 facet — 사람 검토 권장",
      };
    case "unspecified":
      return {
        label: "미지정",
        colorFg: "#555555",
        colorBg: "#eeeeee",
        colorBorder: "#aaaaaa",
        description: "출처 미지정 facet",
      };
  }
}

// ── ModeIndicatorProps ────────────────────────────────────────────────────────

export interface ModeIndicatorProps {
  label: string;       // 인디케이터 표시 텍스트
  colorFg: string;     // 전경(텍스트) CSS 색상
  colorBg: string;     // 배경 CSS 색상
  colorBorder: string; // 테두리 CSS 색상
  icon: string;        // codicon 클래스명 (예: "codicon-edit")
  description: string; // 툴팁/aria 설명
}

/**
 * FacetMode 값을 인디케이터 속성으로 변환한다.
 * generate = 생성 모드(창작 자유), validate = 검증 모드(RFP 기준 확인).
 */
export function getModeIndicatorProps(mode: FacetMode): ModeIndicatorProps {
  switch (mode) {
    case "generate":
      return {
        label: "생성",
        colorFg: "#8b2500",
        colorBg: "#fff5ee",
        colorBorder: "#cc5533",
        icon: "codicon-sparkle",
        description: "생성 모드 — 창작 판단 영역, 자유롭게 작성",
      };
    case "validate":
      return {
        label: "검증",
        colorFg: "#003366",
        colorBg: "#eef4ff",
        colorBorder: "#336699",
        icon: "codicon-verified",
        description: "검증 모드 — RFP 요건과 대조하여 확인 필요",
      };
  }
}

// ── 유틸: 모든 enum 값 목록 ──────────────────────────────────────────────────

export const ALL_PROVENANCE_VALUES: FacetProvenance[] = [
  "rfp",
  "research",
  "generated",
  "unspecified",
];

export const ALL_MODE_VALUES: FacetMode[] = ["generate", "validate"];
