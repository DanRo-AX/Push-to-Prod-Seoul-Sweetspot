// lib/agent/facet-schema.ts
// BTL Facet 계층 모델 — Zod 런타임 스키마 (엔진/API 경계 shape 검증용)
// TypeScript 타입과 1:1 대응. import type { ... } from "@/lib/types" 기준.

import { z } from "zod";

// ── FacetType ───────────────────────────────────────────────────────────────
export const FacetTypeSchema = z.enum([
  "concept",
  "space",
  "md",
  "routing",
  "schedule",
  "event",
  "persona",
]);

// ── FacetStatus ─────────────────────────────────────────────────────────────
export const FacetStatusSchema = z.enum(["clean", "stale"]);

// ── FacetProvenance ─────────────────────────────────────────────────────────
export const FacetProvenanceSchema = z.enum([
  "rfp",
  "research",
  "generated",
  "unspecified",
]);

// ── FacetMode ───────────────────────────────────────────────────────────────
export const FacetModeSchema = z.enum(["generate", "validate"]);

// ── RfpSpectrum ─────────────────────────────────────────────────────────────
export const RfpSpectrumSchema = z.enum(["none", "thin", "rich"]);

// ── RFPSeed ─────────────────────────────────────────────────────────────────
// provenance=rfp인 facet의 rfp_seed_ref가 가리키는 독립 엔티티
export const RFPSeedSchema = z.object({
  id: z.string(),
  objective: z.string(),
  narrative_parts: z.array(z.string()).optional(),
  scope: z.string().optional(),
  budget: z.string().optional(),
  seeded_facet_ids: z.array(z.string()),
  rfp_spectrum: RfpSpectrumSchema,
});

// ── FacetStaleDiff ──────────────────────────────────────────────────────────
// clean→stale 전환 시 필수 채움 (불변식)
export const FacetStaleDiffSchema = z.object({
  changed_field: z.string(),
  before: z.string(),
  after: z.string(),
  triggered_at: z.string(), // ISO 8601
});

// ── FacetVersionEntry ───────────────────────────────────────────────────────
export const FacetVersionEntrySchema = z.object({
  v: z.number().int().positive(),
  timestamp: z.string(), // ISO 8601
  author: z.enum(["human", "system"]),
  trigger: z.string(), // 상류 facet id 또는 enum: init | digest_update | mode_override
});

// ── FacetPersonaComment ─────────────────────────────────────────────────────
export const FacetPersonaCommentSchema = z.object({
  role_persona_id: z.string(),
  project_persona_ref: z.string().optional(),
  stage: z.enum(["role", "project"]),
  body: z.string(),
});

// ── FacetNode ────────────────────────────────────────────────────────────────
// 사람 본문(body) 자동삭제/재생성 금지.
// stale 전파는 1-hop 직속(children)만.
export const FacetNodeSchema = z.object({
  // 식별
  id: z.string(),
  type: FacetTypeSchema,

  // 트리 구조
  parent: z.string().nullable(),
  is_root: z.boolean(),
  children: z.array(z.string()),

  // 상태
  status: FacetStatusSchema,

  // 출처·모드
  provenance: FacetProvenanceSchema,
  mode: FacetModeSchema,

  // 본문 (사람 작업물)
  body: z.string(),

  // 페르소나 코멘트 (2단 합성 결과)
  persona_comment: z.array(FacetPersonaCommentSchema),

  // stale diff (clean→stale 전환 시 필수 — 런타임 불변식은 facet-engine에서 강제)
  stale_diff: FacetStaleDiffSchema.optional(),

  // 버전 이력
  version_history: z.array(FacetVersionEntrySchema),

  // 참조 (임베드 금지)
  digest_refs: z.array(z.string()),
  rfp_seed_ref: z.string().optional(),      // RFPSeed id (provenance=rfp일 때)
  persona_lens_ref: z.string().optional(),  // type=concept일 때만
});

// ── ResearchDigest ───────────────────────────────────────────────────────────
export const DigestResearchTypeSchema = z.enum(["brand", "area", "target", "market"]);

export const ResearchDigestSchema = z.object({
  id: z.string(),
  research_type: DigestResearchTypeSchema,
  claim: z.string(),
  confidence: z.number().min(0).max(1),
  implication: z.string(),
  source: z.string(),
  raw_ref: z.record(z.string(), z.unknown()).optional(), // research_type별 서브타입 (Zod v4: key+value)
});

// ── 타입 export (Zod infer) ──────────────────────────────────────────────────
export type RFPSeedShape    = z.infer<typeof RFPSeedSchema>;
export type FacetNodeShape  = z.infer<typeof FacetNodeSchema>;
export type ResearchDigestShape = z.infer<typeof ResearchDigestSchema>;
