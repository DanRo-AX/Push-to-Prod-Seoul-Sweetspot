// lib/agent/btl-filter-cards.ts
// 순수 함수: RFP 태그로 패턴카드 후보를 필터링한다 (LLM 미사용)

import type {
  BtlIndustry,
  BtlScopeRequirement,
  PatternCard,
  RfpDocument,
} from "@/lib/types";

/**
 * RFP 의 산업/트랙 태그 기반으로 패턴카드 후보를 추린다.
 *
 * - industry_tags: rfp.client_brand.industry (단일 값 → 1-element 배열)
 * - track_tags:    rfp.scope_requirement
 *
 * 필터 의미론:
 * - industry OR track 중 하나라도 교집합이 있으면 후보에 포함 (넓은 그물)
 * - 두 배열이 모두 비어있으면(빈 배열 또는 absent) 전체 세트를 반환 (필터 없음)
 *
 * @param rfp          RFP 문서 (client_brand + scope_requirement 만 사용)
 * @param patternCards 전체 패턴카드 배열
 * @returns            후보 패턴카드 부분 집합
 */
export function filterCardsByTags(
  rfp: Pick<RfpDocument, "client_brand" | "scope_requirement">,
  patternCards: PatternCard[],
): PatternCard[] {
  // RFP 에서 태그 배열 추출
  const industryTags: BtlIndustry[] =
    rfp.client_brand?.industry ? [rfp.client_brand.industry] : [];

  const trackTags: BtlScopeRequirement[] =
    Array.isArray(rfp.scope_requirement) ? rfp.scope_requirement : [];

  // 두 배열이 모두 비면 — 필터 없음 → 전체 반환
  if (industryTags.length === 0 && trackTags.length === 0) {
    return patternCards;
  }

  return patternCards.filter((card) => {
    const industryMatch =
      industryTags.length > 0 &&
      card.industry.some((i) => industryTags.includes(i));

    const trackMatch =
      trackTags.length > 0 &&
      card.track.some((t) => (trackTags as string[]).includes(t as string));

    return industryMatch || trackMatch;
  });
}
