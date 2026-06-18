// lib/agent/facet-persona-synthesis.ts
// BTL 제안서 Facet 2단 페르소나 합성
//
// 2단 분리 원칙:
//   Stage 1 (role)   : BTL 역할 렌즈 → WHO 관점 코멘트 → synthesizeRolePersona()
//   Stage 2 (project): 프로젝트 페르소나 컨텍스트 + 역할 렌즈 → HOW 반응 코멘트 → synthesizeProjectPersona()
//
// AC 8: persona_lens_ref 있는 concept facet → 프로젝트 페르소나 facet의 digest_refs를
//       stage=project 코멘트 digestSummaries에 자동 반영. → buildProjectPersonaContextFromLens()
//
// PoC 1차: mock 합성 (LLM 호출 없음 — deterministic).
// phase-2: Anthropic SDK + project persona body + digest context 기반 실합성.

import type { FacetNode, FacetPersonaComment } from "@/lib/types";
import { BTL_PERSONAS, type BtlPersona } from "@/lib/agent/btl-personas";
import {
  type DigestStore,
  resolveDigestRefs,
} from "@/lib/agent/facet-digest-store";

// ── 입력 컨텍스트 ─────────────────────────────────────────────────────────────

// Stage 1 (role): BTL 역할 렌즈 → WHO 관점 코멘트
export interface RolePersonaContext {
  /** 대상 facet 본문 (코멘트 대상 컨텍스트) */
  facetBody: string;

  /**
   * ResearchDigest 요약 문자열 목록 (optional).
   * PoC 1차: mock 텍스트에 앞 2개 삽입.
   * phase-2: 실 digest 연동.
   */
  digestSummaries?: string[];

  /**
   * 참여시킬 BTL 역할 페르소나 id 목록.
   * 생략 시 BTL_PERSONAS 전체.
   * 지정 시 해당 id만 포함 (BTL_PERSONAS에 없는 id는 무시).
   */
  rolePersonaIds?: string[];
}

// ── synthesizeRolePersona ─────────────────────────────────────────────────────
/**
 * 역할 컨텍스트를 받아 stage='role' FacetPersonaComment[] 반환.
 *
 * 각 BTL 역할 페르소나가 자신의 전문 렌즈(WHO 관점)로 facet을 코멘트.
 * 반환 항목 보장:
 *   - stage: 'role'
 *   - project_persona_ref: undefined (role stage에서는 미포함)
 *   - role_persona_id: BTL_PERSONAS 내 유효 id
 *   - body: 비어 있지 않음
 *
 * 불변 원칙: 입력 ctx 변경 없음.
 * PoC 1차: mock 텍스트 생성 (LLM 없음).
 */
export function synthesizeRolePersona(
  ctx: RolePersonaContext,
): FacetPersonaComment[] {
  // 참여 페르소나 결정
  const personas: BtlPersona[] =
    ctx.rolePersonaIds !== undefined
      ? BTL_PERSONAS.filter((p) => ctx.rolePersonaIds!.includes(p.id))
      : BTL_PERSONAS;

  return personas.map((persona): FacetPersonaComment => ({
    role_persona_id: persona.id,
    stage: "role",
    body: buildMockRoleComment(persona, ctx),
  }));
}

// ── mock 코멘트 빌더 — role stage (PoC 1차) ───────────────────────────────────
// phase-2에서 Anthropic SDK 호출로 대체.

function buildMockRoleComment(
  persona: BtlPersona,
  ctx: RolePersonaContext,
): string {
  const preview =
    ctx.facetBody.length > 40
      ? `${ctx.facetBody.slice(0, 40)}…`
      : ctx.facetBody;

  const digestNote =
    ctx.digestSummaries && ctx.digestSummaries.length > 0
      ? ` | 리서치: ${ctx.digestSummaries.slice(0, 2).join(" / ")}`
      : "";

  return (
    `[${persona.name}·${persona.title}·role] ` +
    `「${preview}」 에 대해, ` +
    `${persona.lens}${digestNote} — ` +
    `WHO 관점 판단 필요. (PoC mock)`
  );
}

// Stage 2 (project): 프로젝트 페르소나 컨텍스트 + 역할 렌즈 → HOW 반응 코멘트
export interface ProjectPersonaContext {
  /**
   * 프로젝트 페르소나 facet id.
   * → 반환되는 각 FacetPersonaComment.project_persona_ref 값.
   */
  projectPersonaFacetId: string;

  /**
   * 프로젝트 페르소나 본문 (사람 작성 — 읽기 전용 참조만).
   * 역할 페르소나가 이 컨텍스트를 렌즈로 코멘트.
   */
  projectPersonaBody: string;

  /** 대상 facet 본문 (코멘트 대상 컨텍스트) */
  facetBody: string;

  /**
   * ResearchDigest 요약 문자열 목록 (optional).
   * PoC 1차: mock 텍스트에 앞 2개 삽입.
   * phase-2: 실 digest 연동.
   */
  digestSummaries?: string[];

  /**
   * 참여시킬 BTL 역할 페르소나 id 목록.
   * 생략 시 BTL_PERSONAS 전체.
   * 지정 시 해당 id만 포함 (BTL_PERSONAS에 없는 id는 무시).
   */
  rolePersonaIds?: string[];
}

// ── synthesizeProjectPersona ──────────────────────────────────────────────────
/**
 * 프로젝트 컨텍스트를 받아 stage='project' FacetPersonaComment[] 반환.
 *
 * 각 BTL 역할 페르소나가 프로젝트 페르소나 컨텍스트를 렌즈로 코멘트.
 * 반환 항목 보장:
 *   - stage: 'project'
 *   - project_persona_ref: ctx.projectPersonaFacetId
 *   - role_persona_id: BTL_PERSONAS 내 유효 id
 *   - body: 비어 있지 않음
 *
 * 불변 원칙: 입력 ctx 변경 없음.
 * PoC 1차: mock 텍스트 생성 (LLM 없음).
 */
export function synthesizeProjectPersona(
  ctx: ProjectPersonaContext,
): FacetPersonaComment[] {
  // 참여 페르소나 결정
  const personas: BtlPersona[] =
    ctx.rolePersonaIds !== undefined
      ? BTL_PERSONAS.filter((p) => ctx.rolePersonaIds!.includes(p.id))
      : BTL_PERSONAS;

  return personas.map((persona): FacetPersonaComment => ({
    role_persona_id: persona.id,
    project_persona_ref: ctx.projectPersonaFacetId,
    stage: "project",
    body: buildMockProjectComment(persona, ctx),
  }));
}

// ── synthesizePersonaPipeline ─────────────────────────────────────────────────
/**
 * 2단 파이프라인 오케스트레이션.
 *
 * 순서:
 *   1) synthesizeProjectPersona(projectCtx) → stage='project' 항목
 *   2) synthesizeRolePersona(roleCtx)       → stage='role' 항목
 *
 * 반환: [...projectComments, ...roleComments] — project 항목이 role 항목보다 앞 보장.
 *
 * 불변 원칙: 입력 ctx 변경 없음.
 */
export function synthesizePersonaPipeline(
  projectCtx: ProjectPersonaContext,
  roleCtx: RolePersonaContext,
): FacetPersonaComment[] {
  const projectComments = synthesizeProjectPersona(projectCtx);
  const roleComments = synthesizeRolePersona(roleCtx);
  return [...projectComments, ...roleComments];
}

// ── mock 코멘트 빌더 (PoC 1차) ────────────────────────────────────────────────
// phase-2에서 Anthropic SDK 호출로 대체.

function buildMockProjectComment(
  persona: BtlPersona,
  ctx: ProjectPersonaContext,
): string {
  const preview =
    ctx.projectPersonaBody.length > 40
      ? `${ctx.projectPersonaBody.slice(0, 40)}…`
      : ctx.projectPersonaBody;

  const digestNote =
    ctx.digestSummaries && ctx.digestSummaries.length > 0
      ? ` | 리서치: ${ctx.digestSummaries.slice(0, 2).join(" / ")}`
      : "";

  return (
    `[${persona.name}·${persona.title}·project] ` +
    `프로젝트 페르소나 「${preview}」 기준으로, ` +
    `${persona.lens}${digestNote} — ` +
    `대상 facet에 반영 필요. (PoC mock)`
  );
}

// ── AC 8: persona_lens_ref → ProjectPersonaContext 자동 빌드 ──────────────────
//
// concept facet.persona_lens_ref → 프로젝트 페르소나 facet 조회
//   → 페르소나 facet.digest_refs → ResearchDigest[] 해석
//   → digestSummaries = "[{research_type}] {claim}" 문자열 목록
//   → ProjectPersonaContext 반환
//
// 반환 null 조건:
//   - conceptFacet.persona_lens_ref 없음
//   - tree에 해당 id의 facet 없음

export interface LensContextOptions {
  /** 참여시킬 BTL 역할 페르소나 id 목록 (생략 시 전체) */
  rolePersonaIds?: string[];
}

/**
 * persona_lens_ref가 채워진 concept facet에서 ProjectPersonaContext를 자동 빌드.
 *
 * 동작:
 *   1. conceptFacet.persona_lens_ref → tree에서 프로젝트 페르소나 facet 조회
 *   2. 페르소나 facet.digest_refs → digestStore에서 ResearchDigest[] 해석
 *   3. 각 digest → "[{research_type}] {claim}" 형식 digestSummaries 생성
 *   4. ProjectPersonaContext 반환 (projectPersonaBody = 페르소나 facet.body)
 *
 * 불변 원칙: 입력 변경 없음.
 *
 * phase-2: digestSummaries를 claim 대신 LLM 압축 summary로 교체 예정.
 *
 * @returns ProjectPersonaContext | null (lens 없거나 facet 미존재 시 null)
 */
export function buildProjectPersonaContextFromLens(
  conceptFacet: FacetNode,
  tree: Map<string, FacetNode>,
  digestStore: DigestStore,
  opts?: LensContextOptions,
): ProjectPersonaContext | null {
  // lens 참조 없으면 null
  const lensRef = conceptFacet.persona_lens_ref;
  if (!lensRef) return null;

  // 프로젝트 페르소나 facet 조회
  const personaFacet = tree.get(lensRef);
  if (!personaFacet) return null;

  // 페르소나 facet의 digest_refs → ResearchDigest[] 해석
  const digests = resolveDigestRefs(personaFacet, digestStore);

  // digestSummaries: "[research_type] claim" 형식 (PoC 1차)
  const digestSummaries = digests.map(
    (d) => `[${d.research_type}] ${d.claim}`,
  );

  return {
    projectPersonaFacetId: lensRef,
    projectPersonaBody: personaFacet.body,
    facetBody: conceptFacet.body,
    digestSummaries: digestSummaries.length > 0 ? digestSummaries : undefined,
    rolePersonaIds: opts?.rolePersonaIds,
  };
}
