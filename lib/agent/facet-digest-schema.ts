// lib/agent/facet-digest-schema.ts
// ResearchDigest Zod 스키마 + 타입 가드
// — 공통 헤더(claim, confidence[0.0,1.0], implication, source)
// — 4종 research_type(brand/area/target/market)별 raw_ref 서브타입
// — lib/types.ts 타입과 1:1 대응 (단일 계약 준수)

import { z } from "zod";
import type {
  ResearchDigest,
  DigestRawRefBrand,
  DigestRawRefArea,
  DigestRawRefTarget,
  DigestRawRefMarket,
} from "@/lib/types";

// ── raw_ref 서브타입 스키마 ──────────────────────────────────────────────────
// .strict() 사용: 여분 키가 있으면 파싱 실패 → union 오분류 방지

export const DigestRawRefBrandSchema = z
  .object({
    brand_name: z.string(),
    position: z.string(),
  })
  .strict();

export const DigestRawRefAreaSchema = z
  .object({
    district: z.string(),
    coords: z.tuple([z.number(), z.number()]).optional(),
  })
  .strict();

export const DigestRawRefTargetSchema = z
  .object({
    segment: z.string(),
    size: z.number().optional(),
  })
  .strict();

export const DigestRawRefMarketSchema = z
  .object({
    category: z.string(),
    trend: z.string().optional(),
  })
  .strict();

// 4종 union — .strict()로 각 서브타입이 구분 가능
export const DigestRawRefSchema = z.union([
  DigestRawRefBrandSchema,
  DigestRawRefAreaSchema,
  DigestRawRefTargetSchema,
  DigestRawRefMarketSchema,
]);

// ── ResearchDigest 전체 스키마 ───────────────────────────────────────────────
// confidence: float [0.0, 1.0] 범위 강제

export const ResearchDigestSchema = z.object({
  id: z.string(),
  research_type: z.enum(["brand", "area", "target", "market"]),
  // 공통 헤더 4개
  claim: z.string(),
  confidence: z.number().gte(0.0).lte(1.0),
  implication: z.string(),
  source: z.string(),
  // research_type별 raw_ref (optional)
  raw_ref: DigestRawRefSchema.optional(),
});

// ── 타입 가드 ─────────────────────────────────────────────────────────────────
// lib/types.ts 인터페이스와 연동: parse 성공 여부로 타입 좁히기

export function isResearchDigest(val: unknown): val is ResearchDigest {
  return ResearchDigestSchema.safeParse(val).success;
}

export function isDigestRawRefBrand(val: unknown): val is DigestRawRefBrand {
  return DigestRawRefBrandSchema.safeParse(val).success;
}

export function isDigestRawRefArea(val: unknown): val is DigestRawRefArea {
  return DigestRawRefAreaSchema.safeParse(val).success;
}

export function isDigestRawRefTarget(val: unknown): val is DigestRawRefTarget {
  return DigestRawRefTargetSchema.safeParse(val).success;
}

export function isDigestRawRefMarket(val: unknown): val is DigestRawRefMarket {
  return DigestRawRefMarketSchema.safeParse(val).success;
}
