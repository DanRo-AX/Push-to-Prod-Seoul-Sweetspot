// lib/agent/choice-selector-logic.ts
// ChoiceSelector 컴포넌트의 순수 상태 로직.
// DOM 없이 node 환경에서 테스트 가능하도록 로직을 분리한다.

import type { ReviewQueueItem } from "@/lib/types";

// ──────────────────────────────────────────────
// 상태 타입
// ──────────────────────────────────────────────

export interface ChoiceSelectorState {
  items: ReviewQueueItem[];
  /** fieldPath → 현재 선택된 후보값 */
  selections: Record<string, string>;
}

// ──────────────────────────────────────────────
// 팩토리 / 리듀서
// ──────────────────────────────────────────────

/**
 * 초기 상태 생성.
 * choices가 없는 항목은 포함하되 selections 초기값 없음.
 */
export function createChoiceSelectorState(
  items: ReviewQueueItem[],
): ChoiceSelectorState {
  return { items, selections: {} };
}

/**
 * 특정 fieldPath에 대한 선택값을 업데이트한다.
 * 해당 fieldPath가 items에 없거나 choice가 choices 목록에 없으면 무시한다.
 */
export function selectChoice(
  state: ChoiceSelectorState,
  fieldPath: string,
  choice: string,
): ChoiceSelectorState {
  const item = state.items.find((i) => i.field_path === fieldPath);
  if (!item) return state;                          // 존재하지 않는 필드
  if (!item.choices.includes(choice)) return state; // 유효하지 않은 후보값

  return {
    ...state,
    selections: { ...state.selections, [fieldPath]: choice },
  };
}

/**
 * 현재까지 선택 완료된 fieldPath → 선택값 맵을 반환한다.
 * 아직 선택 안 된 항목은 포함하지 않는다.
 */
export function getResolvedValues(
  state: ChoiceSelectorState,
): Record<string, string> {
  return { ...state.selections };
}

/**
 * 모든 항목(choices가 1개 이상인 항목에 한해)이 선택 완료되었는지 확인한다.
 */
export function isFullyResolved(state: ChoiceSelectorState): boolean {
  const resolvable = state.items.filter((i) => i.choices.length > 0);
  return resolvable.every((i) => i.field_path in state.selections);
}

/**
 * 특정 fieldPath에 대한 현재 선택값 반환. 미선택이면 undefined.
 */
export function getSelection(
  state: ChoiceSelectorState,
  fieldPath: string,
): string | undefined {
  return state.selections[fieldPath];
}

/**
 * 선택 취소 (fieldPath 제거).
 */
export function clearSelection(
  state: ChoiceSelectorState,
  fieldPath: string,
): ChoiceSelectorState {
  const { [fieldPath]: _, ...rest } = state.selections;
  return { ...state, selections: rest };
}
