// lib/ide/workflow-packs.ts — 워크플로 '팩' 레지스트리.
//
// 이 툴의 정체: BTL 전용이 아니라 워크플로-무관(agnostic) 작업 환경(PRD §1·P5). 바뀌는 건
// (a) 슬롯 셋, (b) 페르소나 로스터, (c) 리서치 facet 뿐 — 코어(폴더→슬롯→카드→논의)는 하나.
// 그 사실을 '코드로 드러내기' 위해 워크플로를 데이터(팩)로 둔다. BTL 은 한 인스턴스일 뿐이고,
// SNS/콘텐츠 워크플로는 슬롯 정의만 둔 '증거'(데모에선 미구현, 팩 교체로 된다는 증명).

import { BTL_WORKFLOW } from "./workflow";
import { BTL_CARDS, SNS_CARDS, type CardSpec } from "./card-spec";

/** 팩이 UI 에서 쓰는 슬롯의 최소 형태(라벨/순서/힌트/연결). 강타입 BTL 슬롯도 이 형태에 포함된다. */
export interface PackSlot {
  id: string;
  label: string;
  order: number;
  hint: string;
  upstream?: string;
}

export interface WorkflowPack {
  /** 팩 식별자(예: "btl" | "sns"). */
  id: string;
  /** 한국어 라벨. */
  label: string;
  /** 한 줄 설명 — 어떤 최종 산출물로 가는 흐름인가. */
  description: string;
  /** 데모 노출 여부. */
  available: boolean;
  /** 업무 모양 — composition(부분→합성) / loop(반복) / single / divergent. */
  shape: WorkflowShape;
  /** 문서타입 슬롯(이 워크플로의 척추). */
  slots: PackSlot[];
  /** 슬롯별 카드 정의(시그널·섹션·소스). 카드를 데이터로 선언. */
  cards: CardSpec[];
  /** 트리거(입력 카드 + 발화 조건) — 사람이 로드·추출하면 시동. 없을 수도. */
  trigger?: WorkflowTrigger;
  /** composition: 트리거 후 생성될 구성(중간) 카드 slot 목록. */
  composes?: string[];
  /** composition: 최종 합성 카드 slot(구성 참조 합본). */
  output?: string;
}

// 업무 모양 — 우선 composition·loop 지원.
export type WorkflowShape = "composition" | "loop" | "single" | "divergent";

/** 워크플로 트리거 — 입력 카드 + 발화 조건(사람이 로드·추출하면 시동). */
export interface WorkflowTrigger {
  card: string;
  fires_on: "extract" | "load";
}

// BTL 제안 — 첫(그리고 데모의 유일한) 구현 워크플로. 슬롯은 강타입 BTL_WORKFLOW 그대로.
export const BTL_PACK: WorkflowPack = {
  id: "btl",
  label: "BTL 제안",
  description: "RFP(트리거) → 기획안·운영안·견적(구성) → 제안서(합성)",
  available: true,
  shape: "composition",
  slots: BTL_WORKFLOW,
  cards: BTL_CARDS,
  trigger: { card: "rfp", fires_on: "extract" },
  composes: ["proposal", "operation", "quote"],
  output: "proposal_doc",
};

// SNS·콘텐츠 마케팅 — '증거' 팩. 슬롯 정의만 — 코어 교체로 된다는 걸 보여주기 위함.
export const SNS_PACK: WorkflowPack = {
  id: "sns",
  label: "SNS·콘텐츠",
  description: "콘텐츠 아이디어 → 군집 피드백 루프(반복)",
  available: true,
  shape: "loop",
  // 루프형 — 단위는 게시글(콘텐츠) 한 개. 카드 안에서 군집 피드백 루프가 돈다.
  slots: [
    { id: "content", label: "콘텐츠", order: 1, hint: "게시글 아이디어/초안 — 군집 피드백으로 깎기" },
  ],
  cards: SNS_CARDS,
};

export const WORKFLOW_PACKS: WorkflowPack[] = [BTL_PACK, SNS_PACK];

/** 활성 워크플로 팩 — 데모 기본값(컨텍스트 미사용 경로용). 선택은 ActiveWorkflowProvider. */
export function getActivePack(): WorkflowPack {
  return BTL_PACK;
}

/** id 로 팩 조회. */
export function getPack(id: string): WorkflowPack | undefined {
  return WORKFLOW_PACKS.find((p) => p.id === id);
}
