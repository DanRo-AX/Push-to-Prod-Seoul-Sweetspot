// lib/agent/btl-regen.ts
// Sub-AC 2b-ii: 제안서 재생성 트리거.
// ChoiceSelector가 방출한 resolved field values를 받아 proposal에 패치하고
// 견적서를 재계산한다. LLM 미호출 — 결정론적, 골든런 재현 가능.
//
// AC 3: production_items 편집 → 견적서 line_items 필드 인터록.
// applyProductionItemEdits / triggerProductionItemsInterlock 포함.

import type {
  AgentEvent,
  BtlScenarioPack,
  FieldProvenance,
  ProductionItem,
  ProposalDocument,
  QuoteDocument,
} from "@/lib/types";
import { buildQuoteFromProposal } from "@/lib/agent/btl-engine";

// ──────────────────────────────────────────────
// field_path → 탐색 경로 변환
// "proposal.concept.key_experience" → ["concept", "key_experience"]
// ──────────────────────────────────────────────

function toPathParts(fieldPath: string): string[] {
  const stripped = fieldPath.startsWith("proposal.")
    ? fieldPath.slice("proposal.".length)
    : fieldPath;
  return stripped.split(".");
}

// ──────────────────────────────────────────────
// 불변 깊이 패치 (최대 3단계 경로 지원)
// ──────────────────────────────────────────────

function deepPatch(
  obj: Record<string, unknown>,
  path: string[],
  value: string,
): Record<string, unknown> {
  if (path.length === 0) return obj;

  const [head, ...rest] = path;

  if (rest.length === 0) {
    // 1단계: 직접 대입
    return { ...obj, [head]: value };
  }

  const nested = obj[head];
  const nestedObj =
    nested !== null && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : {};

  return {
    ...obj,
    [head]: deepPatch(nestedObj, rest, value),
  };
}

// ──────────────────────────────────────────────
// applyResolvedValues
// ──────────────────────────────────────────────

/**
 * resolved field values를 proposal에 패치한다.
 *
 * 패치 효과:
 * - 해당 필드의 실제 값을 선택된 후보값으로 교체
 * - field_provenance에서 해당 필드를 source:"user", confidence:1.0으로 갱신
 * - review_queue에서 해당 필드 제거 (사람이 확정했으므로 더 이상 검토 불필요)
 */
export function applyResolvedValues(
  proposal: ProposalDocument,
  resolved: Record<string, string>,
): ProposalDocument {
  if (Object.keys(resolved).length === 0) return proposal;

  // 1) 필드 값 패치
  let patched = proposal as unknown as Record<string, unknown>;
  for (const [fieldPath, value] of Object.entries(resolved)) {
    const parts = toPathParts(fieldPath);
    patched = deepPatch(patched, parts, value);
  }

  const resolvedPaths = new Set(Object.keys(resolved));

  // 2) field_provenance 갱신: 적용된 필드는 user 출처로 업그레이드
  const updatedProvenance: FieldProvenance[] = proposal.field_provenance.map(
    (prov) => {
      if (resolvedPaths.has(prov.field_path)) {
        return {
          ...prov,
          source: "user" as const,
          confidence: 1.0,
          editable_by_user: true,
        };
      }
      return prov;
    },
  );

  // 3) review_queue 정리: 확정된 항목 제거
  const remainingQueue = proposal.review_queue.filter(
    (item) => !resolvedPaths.has(item.field_path),
  );

  return {
    ...(patched as unknown as ProposalDocument),
    field_provenance: updatedProvenance,
    review_queue: remainingQueue,
  };
}

// ──────────────────────────────────────────────
// RegenOutput
// ──────────────────────────────────────────────

export interface RegenOutput {
  /** resolved values가 반영된 수정 기획제안서 */
  proposal: ProposalDocument;
  /** 수정 기획제안서로 재계산된 견적서 */
  quote: QuoteDocument;
  /**
   * SSE artifact 이벤트 목록.
   * useAgentStream의 events 배열에 push하여 UI 상태를 변이한다.
   */
  events: AgentEvent[];
}

// ──────────────────────────────────────────────
// triggerProposalRegen
// ──────────────────────────────────────────────

/**
 * triggerProposalRegen
 *
 * ChoiceSelector의 onConfirm 콜백이 전달한 resolved values를 받아
 * 제안서·견적서를 재산출하고 SSE 이벤트를 반환한다.
 *
 * 호출 흐름:
 *   ChoiceSelector.onConfirm(resolved)
 *     → triggerProposalRegen(currentProposal, resolved, pack)
 *       → applyResolvedValues → buildQuoteFromProposal
 *         → RegenOutput { proposal, quote, events }
 *   caller: events를 useAgentStream 상태에 push → UI 패널 업데이트
 *
 * 결정론적(LLM 미호출).
 */
export function triggerProposalRegen(
  currentProposal: ProposalDocument,
  resolved: Record<string, string>,
  pack: BtlScenarioPack,
): RegenOutput {
  const revisedProposal = applyResolvedValues(currentProposal, resolved);
  const revisedQuote = buildQuoteFromProposal(revisedProposal, pack);

  const fieldCount = Object.keys(resolved).length;
  const events: AgentEvent[] = [
    {
      type: "status",
      status: "thinking",
      message: `검토 값 반영 중 — ${fieldCount}개 필드 업데이트`,
    },
    {
      type: "artifact",
      artifact: { kind: "btl_proposal", proposal: revisedProposal },
    },
    {
      type: "artifact",
      artifact: { kind: "btl_quote", quote: revisedQuote },
    },
    {
      type: "status",
      status: "done",
      message: "검토 완료 — 기획제안서·견적서 재산출됨",
    },
  ];

  return { proposal: revisedProposal, quote: revisedQuote, events };
}

// ══════════════════════════════════════════════════════════
// AC 3: production_items 편집 → 견적서 line_items 필드 인터록
// ══════════════════════════════════════════════════════════

/**
 * ProductionItemEdit: production_items 단위 편집 오퍼레이션
 *
 * 각 오퍼레이션은 item_id를 기준으로 처리한다.
 * 'add' 오퍼레이션은 완전한 ProductionItem을 받는다.
 */
export type ProductionItemEdit =
  | { op: "update_qty"; item_id: string; qty: number }
  | { op: "update_name"; item_id: string; item_name: string }
  | { op: "add"; item: ProductionItem }
  | { op: "remove"; item_id: string };

/**
 * applyProductionItemEdits
 *
 * production_items에 편집 오퍼레이션을 순서대로 적용하고
 * 새 ProposalDocument를 반환한다.
 *
 * - 불변 — 원본 proposal 수정 없음
 * - field_provenance: production_items 필드를 user 출처로 갱신
 * - 견적서 재계산은 buildQuoteFromProposal에 위임 (field interlock)
 */
export function applyProductionItemEdits(
  proposal: ProposalDocument,
  edits: ProductionItemEdit[],
): ProposalDocument {
  if (edits.length === 0) return proposal;

  let items = [...proposal.production_items];

  for (const edit of edits) {
    switch (edit.op) {
      case "update_qty":
        items = items.map((item) =>
          item.item_id === edit.item_id ? { ...item, qty: edit.qty } : item,
        );
        break;
      case "update_name":
        items = items.map((item) =>
          item.item_id === edit.item_id
            ? { ...item, item_name: edit.item_name }
            : item,
        );
        break;
      case "add":
        items = [...items, edit.item];
        break;
      case "remove":
        items = items.filter((item) => item.item_id !== edit.item_id);
        break;
    }
  }

  // production_items 필드 프로베넌스를 user 출처로 갱신
  const existingPaths = new Set(
    proposal.field_provenance.map((p) => p.field_path),
  );
  const updatedProvenance: FieldProvenance[] = proposal.field_provenance.map(
    (prov) =>
      prov.field_path === "proposal.production_items"
        ? { ...prov, source: "user" as const, confidence: 1.0 }
        : prov,
  );
  // 기존 provenance에 없으면 user 출처 항목 추가
  if (!existingPaths.has("proposal.production_items")) {
    updatedProvenance.push({
      field_path: "proposal.production_items",
      source: "user" as const,
      confidence: 1.0,
      editable_by_user: true,
    });
  }

  return {
    ...proposal,
    production_items: items,
    field_provenance: updatedProvenance,
  };
}

/**
 * triggerProductionItemsInterlock
 *
 * production_items 편집을 proposal에 적용하고
 * 견적서 line_items를 자동으로 재계산한다.
 *
 * Field interlock 경로:
 *   ProductionItem.item_id → QuoteLine.source_item_id
 *   ProductionItem.item_name → lookupUnitPrice → QuoteLine.unit_price
 *   ProductionItem.qty → QuoteLine.amount = qty × unit_price
 *
 * 결정론적(LLM 미호출) — 골든런 재현 가능.
 */
export function triggerProductionItemsInterlock(
  currentProposal: ProposalDocument,
  edits: ProductionItemEdit[],
  pack: BtlScenarioPack,
): RegenOutput {
  const revisedProposal = applyProductionItemEdits(currentProposal, edits);
  const revisedQuote = buildQuoteFromProposal(revisedProposal, pack);

  const editCount = edits.length;
  const events: AgentEvent[] = [
    {
      type: "status",
      status: "thinking",
      message: `제작 항목 수정 중 — ${editCount}개 변경`,
    },
    {
      type: "artifact",
      artifact: { kind: "btl_proposal", proposal: revisedProposal },
    },
    {
      type: "artifact",
      artifact: { kind: "btl_quote", quote: revisedQuote },
    },
    {
      type: "status",
      status: "done",
      message: `제작 항목 반영 완료 — 견적서 재산출 (${revisedQuote.total.toLocaleString()}원)`,
    },
  ];

  return { proposal: revisedProposal, quote: revisedQuote, events };
}
