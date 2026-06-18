// lib/agent/btl-aggregate-cards.ts
// Sub-AC 4.1: aggregatePatternCards — field_provenance 배열을 card_id 기준으로 집계
//
// 패턴카드별로 몇 개 필드를 채웠는지, 어떤 필드를 채웠는지 집계한다.
// card_id 없는 엔트리(source≠persona 또는 카드 미적용)는 건너뛴다.

import type { FieldProvenance } from "@/lib/types";

// ── 출력 타입 ────────────────────────────────────────────────────────────────

export interface PatternCardAggregate {
  /** 집계 기준 card_id */
  cardId: string;
  /** 이 카드로 채운 총 필드 수 */
  totalCount: number;
  /** 채운 field_path 목록 (순서: 입력 순) */
  filledFields: string[];
}

// ── 메인 함수 ────────────────────────────────────────────────────────────────

/**
 * aggregatePatternCards
 *
 * field_provenance 배열을 받아 card_id 기준으로 그룹화한다.
 * card_id 가 없는 엔트리는 집계에서 제외된다.
 *
 * @param fieldProvenance  FieldProvenance 배열 (제안서 또는 전체 런에서 수집)
 * @returns PatternCardAggregate 배열 (card_id 알파벳 오름차순)
 */
export function aggregatePatternCards(
  fieldProvenance: FieldProvenance[],
): PatternCardAggregate[] {
  // card_id 있는 것만 필터
  const withCard = fieldProvenance.filter(
    (fp): fp is FieldProvenance & { card_id: string } =>
      typeof fp.card_id === "string" && fp.card_id.length > 0,
  );

  // Map<card_id, filledFields[]>
  const map = new Map<string, string[]>();

  for (const fp of withCard) {
    const existing = map.get(fp.card_id);
    if (existing) {
      existing.push(fp.field_path);
    } else {
      map.set(fp.card_id, [fp.field_path]);
    }
  }

  // Map → 배열, card_id 알파벳 오름차순 정렬
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cardId, filledFields]) => ({
      cardId,
      totalCount: filledFields.length,
      filledFields,
    }));
}
