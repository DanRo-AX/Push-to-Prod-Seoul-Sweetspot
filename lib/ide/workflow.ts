// lib/ide/workflow.ts — BTL 업무 워크플로 슬롯 정의(자동화와 무관한 "업무 프레임워크"의 척추).
//
// 핵심 철학: 자동화를 다 들어내도 단계마다 필요한 문서는 동일하다. 실무자는 자기 폴더
// 하나로 일하고, 폴더의 특정 파일을 워크플로 슬롯에 **수동 지정**한다. 자동 감지/자동
// 표시 없음 — 슬롯에 바인딩된 파일만 중앙에 뜬다. 파일 출처(에이전트 생성/사람 작성)는
// 무관하며 슬롯이 단일 척추다.

export type WorkflowSlotId = "rfp" | "proposal" | "quote" | "operation" | "proposal_doc" | "contract";

export interface WorkflowSlot {
  id: WorkflowSlotId;
  /** 표시 라벨(한국어) */
  label: string;
  /** 워크플로 순서(중앙 탭 정렬) */
  order: number;
  /** 한 줄 설명 — 이 단계에 어떤 문서가 들어가는지 */
  hint: string;
  /** 직전 슬롯(제안서→견적서 같은 연결 표시용). 없으면 시작 단계 */
  upstream?: WorkflowSlotId;
  /** 우리 스키마 typed 뷰로 렌더 가능한 산출물 kind(있으면). 없으면 일반 파일 프리뷰 */
  artifactKind?: "btl_rfp" | "btl_proposal" | "btl_quote";
}

// BTL 첫 시나리오 워크플로: RFP → 기획제안서 → 견적서 (계약서는 다음 단계).
export const BTL_WORKFLOW: WorkflowSlot[] = [
  {
    id: "rfp",
    label: "RFP",
    order: 1,
    hint: "발주처 제안요청서 — 흐름의 입력",
    artifactKind: "btl_rfp",
  },
  {
    id: "proposal",
    label: "기획안",
    order: 2,
    hint: "RFP 기반 기획·컨셉(제안서의 구성)",
    upstream: "rfp",
    artifactKind: "btl_proposal",
  },
  {
    id: "quote",
    label: "견적서",
    order: 3,
    hint: "제작 항목 × 단가 — 비용 명세",
    upstream: "proposal",
    artifactKind: "btl_quote",
  },
  {
    id: "operation",
    label: "운영안",
    order: 4,
    hint: "수주 후 현장 운영 — 인력·동선·안전·일정·비상",
    upstream: "quote",
  },
  {
    id: "proposal_doc",
    label: "제안서(합성)",
    order: 5,
    hint: "기획안·운영안·견적을 묶은 최종 제안서",
    upstream: "operation",
  },
  {
    id: "contract",
    label: "계약서",
    order: 6,
    hint: "견적 확정 후 계약·정산 (예정)",
    upstream: "proposal_doc",
  },
];

export function workflowSlot(id: WorkflowSlotId): WorkflowSlot | undefined {
  return BTL_WORKFLOW.find((s) => s.id === id);
}

// ── 슬롯 바인딩 모델 ──
// 실무자가 폴더의 한 파일을 슬롯에 지정한 결과. 파일 핸들은 클라이언트 상태로만 들고,
// 직렬화 시에는 경로/이름만 남긴다(핸들은 재선택 필요).
export interface SlotBinding {
  slotId: WorkflowSlotId;
  /** 폴더 기준 표시 경로(예: "2026-KMI/01_RFP/kmi-rfp.pdf") */
  path: string;
  /** 파일명 */
  name: string;
  /** 확장자 소문자(점 제외) */
  ext: string;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}
