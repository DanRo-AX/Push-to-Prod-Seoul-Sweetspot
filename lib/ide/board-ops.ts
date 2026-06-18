// lib/ide/board-ops.ts — 보드 '동작(operations)' 어휘(공유). 수동 UI 와 채팅이 같은 op 를 호출한다.
//
// 채팅 오케스트레이터(/api/btl/orchestrate)가 사용자 의도를 op 로 옮기고, 클라가 보드에서 실행한다.
// 모든 op 는 손으로도(버튼/드래그) 할 수 있는 동작 = 포용성.

export type BoardOp =
  | { op: "add_card"; slot: string }                       // 보드에 빈 카드 추가
  | { op: "draft_card"; slot: string }                     // RFP 기반 AI 초안으로 그 카드 채우기(before)
  | { op: "draft_all" }                                    // 활성 워크플로의 빈 초안가능 카드 전부 채우기
  | { op: "revise_card"; slot?: string }                   // 방금 받은 군집 코멘트를 반영해 카드 수정
  | { op: "persona_feedback"; types?: string[]; content?: string } // 콘텐츠를 군집으로 sharp 검토
  | { op: "none" };                                        // 동작 없음(대화만)

export interface OrchestrateResult {
  reply: string;     // 채팅에 보일 한국어 답
  ops: BoardOp[];    // 클라가 순서대로 실행
}
