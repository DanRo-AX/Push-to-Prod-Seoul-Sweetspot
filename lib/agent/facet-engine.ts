// lib/agent/facet-engine.ts
// BTL 제안서 Facet 계층 엔진
// — version_history append-on-update
// — stale 1-hop 전파 (전이적 연쇄 금지)
// — RFP spectrum → mode 자동매핑
// — 사람 본문(body) 자동삭제/재생성 금지

import type {
  FacetNode,
  FacetStaleDiff,
  FacetVersionEntry,
  FacetPersonaComment,
  FacetMode,
  RFPSeed,
  RfpSpectrum,
} from "@/lib/types";

// ── version_history append-on-update ──────────────────────────────────────
// 새 버전 항목을 붙인 facet을 반환한다 (불변 — 원본 변경 없음).
// trigger: 상류 facet id 또는 enum(init | digest_update | mode_override)

export type FacetUpdateTrigger = string; // facet id 또는 "init" | "digest_update" | "mode_override"

export interface UpdateFacetOptions {
  author: "human" | "system";
  trigger: FacetUpdateTrigger;
}

/**
 * facet 필드를 업데이트하고 version_history에 새 항목을 append한다.
 * 사람 본문(body) 자동삭제 금지: updates에 body를 명시하지 않으면 기존 body 유지.
 * stale_diff 불변식: status가 clean→stale로 바뀌면 stale_diff 필수 (없으면 throw).
 */
export function updateFacet(
  facet: FacetNode,
  updates: Partial<
    Pick<
      FacetNode,
      | "body"
      | "status"
      | "mode"
      | "mode_override"
      | "persona_comment"
      | "digest_refs"
      | "stale_diff"
      | "rfp_seed_ref"
      | "persona_lens_ref"
    >
  >,
  options: UpdateFacetOptions,
): FacetNode {
  const nextV =
    facet.version_history.length > 0
      ? Math.max(...facet.version_history.map((e) => e.v)) + 1
      : 1;

  const newEntry: FacetVersionEntry = {
    v: nextV,
    timestamp: new Date().toISOString(),
    author: options.author,
    trigger: options.trigger,
  };

  // stale_diff 불변식: clean→stale 전환 시 stale_diff 필수
  const nextStatus = updates.status ?? facet.status;
  if (facet.status === "clean" && nextStatus === "stale") {
    if (!updates.stale_diff) {
      throw new Error(
        `[facet-engine] clean→stale 전환 시 stale_diff 필수 (facet: ${facet.id})`,
      );
    }
  }

  return {
    ...facet,
    ...updates,
    // body는 updates에 명시된 경우만 교체 (자동재생성 방지 — 명시 안 하면 기존 유지)
    body: "body" in updates ? (updates.body ?? facet.body) : facet.body,
    version_history: [...facet.version_history, newEntry],
  };
}

// ── stale 1-hop 전파 ────────────────────────────────────────────────────────
// 상류 facet 변경 시 직속 children(1-hop)만 stale 마킹.
// 전이적 연쇄(손자 이하) 자동 표시 금지.

export interface PropagateStaleOptions {
  changedField: string;
  before: string;
  after: string;
  /**
   * stale된 child에 append할 persona_comment 목록.
   * 생략 시 기본 mock stale-알림 코멘트 1개가 자동 생성됨 (PoC 1차).
   * 상권분석기 실연동 기반 LLM 합성은 phase-2.
   */
  staleComments?: FacetPersonaComment[];
}

/**
 * tree에서 changedFacetId의 children만 stale로 마킹해 새 Map 반환.
 * — 각 child에 stale_diff + version_history 항목 추가
 * — 각 child의 persona_comment 배열에 stale 알림 코멘트 append
 * — 이미 stale인 child는 stale_diff/version_history/persona_comment만 갱신
 * — body는 절대 변경하지 않음 (사람 작업물 보존 원칙)
 * — 전이적 연쇄(손자 이하) 자동 표시 금지 — 1-hop 직속만
 */
export function propagateStale(
  tree: Map<string, FacetNode>,
  changedFacetId: string,
  opts: PropagateStaleOptions,
): Map<string, FacetNode> {
  const changed = tree.get(changedFacetId);
  if (!changed) return tree;

  const result = new Map(tree);
  const triggeredAt = new Date().toISOString();

  // 검토 필요 코멘트: 제공 없으면 기본 mock (PoC 1차)
  const commentsToAdd: FacetPersonaComment[] = opts.staleComments ?? [
    {
      role_persona_id: "strategy-doyun",
      stage: "role",
      body: `상위 단계의 ‘${opts.changedField}’가 바뀌어 이 항목을 다시 봐야 합니다.`,
    },
  ];

  for (const childId of changed.children) {
    const child = result.get(childId);
    if (!child) continue;

    const staleDiff: FacetStaleDiff = {
      changed_field: opts.changedField,
      before: opts.before,
      after: opts.after,
      triggered_at: triggeredAt,
    };

    const updated = updateFacet(
      child,
      {
        status: "stale",
        stale_diff: staleDiff,
        // 기존 persona_comment 보존 + stale 알림 코멘트 append
        persona_comment: [...child.persona_comment, ...commentsToAdd],
      },
      { author: "system", trigger: changedFacetId },
    );
    result.set(childId, updated);
  }

  return result;
}

// ── RFP spectrum → mode 자동매핑 ─────────────────────────────────────────
// none | thin → generate, rich → validate
// provenance != rfp이면 기본 generate (사람 override 가능)

export function resolveMode(
  provenance: FacetNode["provenance"],
  rfpSeed: RFPSeed | null,
): FacetMode {
  if (provenance !== "rfp" || !rfpSeed) return "generate";
  const spectrum: RfpSpectrum = rfpSeed.rfp_spectrum;
  return spectrum === "rich" ? "validate" : "generate";
}

/**
 * computeDefaultMode — facet 단위 mode 자동결정 (사람 override 이전 기본값).
 *
 * 규칙:
 *  1. provenance ≠ rfp → 'generate'
 *  2. rfp_seed_ref 없거나 rfpSeed 미제공 → 'generate'
 *  3. rfp_spectrum = none | thin → 'generate'
 *  4. rfp_spectrum = rich → 'validate'
 *
 * @param facet   - 대상 FacetNode
 * @param rfpSeed - rfp_seed_ref가 가리키는 RFPSeed 엔티티 (provenance=rfp일 때만 의미 있음)
 */
export function computeDefaultMode(
  facet: FacetNode,
  rfpSeed?: RFPSeed | null,
): FacetMode {
  // 규칙 1: provenance가 rfp가 아니면 항상 generate
  if (facet.provenance !== "rfp") return "generate";
  // 규칙 2: rfp_seed_ref 없거나 seed 미제공 → generate
  if (!facet.rfp_seed_ref || !rfpSeed) return "generate";
  // 규칙 3-4: spectrum none/thin → generate, rich → validate
  return rfpSeed.rfp_spectrum === "rich" ? "validate" : "generate";
}

// ── mode_override 우선 적용 ───────────────────────────────────────────────
// 사람이 명시한 mode_override가 있으면 computeDefaultMode 결과보다 우선 적용.
// version_history trigger='mode_override' 로 기록 (updateFacet 호출 측 책임).

/**
 * resolveEffectiveMode — 실제 적용 mode 결정.
 *
 * 우선순위:
 *  1. facet.mode_override 가 있으면 → mode_override (사람 명시 우선)
 *  2. 없으면 → computeDefaultMode(facet, rfpSeed)
 *
 * rfp·비rfp 양쪽에서 동작한다.
 */
export function resolveEffectiveMode(
  facet: FacetNode,
  rfpSeed?: RFPSeed | null,
): FacetMode {
  if (facet.mode_override !== undefined) {
    return facet.mode_override;
  }
  return computeDefaultMode(facet, rfpSeed);
}

// ── facet 초기화 헬퍼 ────────────────────────────────────────────────────
// version_history에 init 항목 자동 삽입

export function initFacet(
  base: Omit<FacetNode, "version_history">,
): FacetNode {
  const initEntry: FacetVersionEntry = {
    v: 1,
    timestamp: new Date().toISOString(),
    author: "system",
    trigger: "init",
  };
  return {
    ...base,
    version_history: [initEntry],
  };
}

// ── seedRFP: RFPSeed → facet 배열 생성 ───────────────────────────────────
// RFPSeed를 기반으로 facet 트리를 생성한다.
// — root concept facet (is_root=true): seed.objective를 body로
// — narrative_parts 각각 → md child facet (seed.id-md-{i})
// — 모든 facet에 rfp_seed_ref = seed.id, provenance = "rfp"
// — mode: rfp_spectrum 자동매핑 (none/thin→generate, rich→validate)
// — updatedSeed.seeded_facet_ids = 생성된 전체 facet id 목록
// 입력 seed는 불변 (원본 변경 없음)

export interface SeedRFPResult {
  facets: FacetNode[];
  updatedSeed: RFPSeed;
}

export function seedRFP(seed: RFPSeed): SeedRFPResult {
  const mode = resolveMode("rfp", seed);

  // root concept facet id
  const rootId = `${seed.id}-concept`;

  // narrative_parts → child facet id 목록
  const narrativeParts = seed.narrative_parts ?? [];
  const childIds = narrativeParts.map((_, i) => `${seed.id}-md-${i}`);

  // 1. keystone root concept facet
  const rootFacet = initFacet({
    id: rootId,
    type: "concept",
    parent: null,
    is_root: true,
    children: childIds,
    status: "clean",
    provenance: "rfp",
    mode,
    body: seed.objective,
    persona_comment: [],
    digest_refs: [],
    rfp_seed_ref: seed.id,
  });

  const facets: FacetNode[] = [rootFacet];

  // 2. narrative_parts → md child facet
  narrativeParts.forEach((part, i) => {
    const childFacet = initFacet({
      id: childIds[i],
      type: "md",
      parent: rootId,
      is_root: false,
      children: [],
      status: "clean",
      provenance: "rfp",
      mode,
      body: part,
      persona_comment: [],
      digest_refs: [],
      rfp_seed_ref: seed.id,
    });
    facets.push(childFacet);
  });

  // 3. updatedSeed: seeded_facet_ids = 생성된 전체 facet id
  const updatedSeed: RFPSeed = {
    ...seed,
    seeded_facet_ids: facets.map((f) => f.id),
  };

  return { facets, updatedSeed };
}
