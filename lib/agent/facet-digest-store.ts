// lib/agent/facet-digest-store.ts
// DigestStore: ResearchDigest 독립 엔티티 저장소 (id → ResearchDigest)
// resolveDigestRefs: FacetNode.digest_refs → ResearchDigest[]
// — 임베드 금지: FacetNode에는 id만, 실체는 이 store에 분리 저장
// — 불변 API: addDigest는 새 Map 반환 (원본 변경 없음)

import type { FacetNode, ResearchDigest } from "@/lib/types";

// ── DigestStore 타입 ─────────────────────────────────────────────────────────

export type DigestStore = Map<string, ResearchDigest>;

// ── 팩토리 ───────────────────────────────────────────────────────────────────

/**
 * 빈 DigestStore 생성
 */
export function createDigestStore(): DigestStore {
  return new Map<string, ResearchDigest>();
}

// ── 추가 ─────────────────────────────────────────────────────────────────────

/**
 * ResearchDigest를 store에 추가한다 (불변 — 새 Map 반환).
 * 동일 id가 있으면 덮어씀.
 */
export function addDigest(store: DigestStore, digest: ResearchDigest): DigestStore {
  const next = new Map(store);
  next.set(digest.id, digest);
  return next;
}

// ── 단건 조회 ─────────────────────────────────────────────────────────────────

/**
 * store에서 단일 ResearchDigest를 id로 조회.
 * 없으면 undefined 반환.
 */
export function getDigest(store: DigestStore, id: string): ResearchDigest | undefined {
  return store.get(id);
}

// ── 참조 일괄 해석 ────────────────────────────────────────────────────────────

/**
 * FacetNode.digest_refs에 나열된 id들을 store에서 조회하여 ResearchDigest 배열로 반환.
 * — 순서: digest_refs 배열 순 유지
 * — 존재하지 않는 id는 건너뜀 (참조 무결성 경고만, throw 하지 않음)
 *   phase-2에서 상권분석기 실연동 시 동일 interface 재사용.
 */
export function resolveDigestRefs(
  facet: FacetNode,
  store: DigestStore,
): ResearchDigest[] {
  return facet.digest_refs.flatMap((id) => {
    const digest = store.get(id);
    if (!digest) {
      // missing id 건너뜀 — 참조 무결성 위반 시 별도 경고 채널 사용
      return [];
    }
    return [digest];
  });
}
