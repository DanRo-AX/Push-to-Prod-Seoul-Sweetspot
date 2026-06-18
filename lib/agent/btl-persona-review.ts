// lib/agent/btl-persona-review.ts
// Sub-AC 2a: Low-confidence 필드 감지 + 페르소나 선택지 생성
//
// 페르소나가 채운 가변 필드 중 confidence < 0.7인 항목을 감지하고
// 필드별로 2-3개의 선택지를 생성해 review_queue를 구성한다.

import type { FieldProvenance, ReviewQueueItem } from "@/lib/types";

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

// 페르소나가 채우는 주요 가변 필드 경로 목록
// proposal_angle, concept 중심 — 가장 창의성 의존도가 높은 필드
export const PERSONA_VARIABLE_FIELDS: readonly string[] = [
  "proposal.proposal_angle.core_message",
  "proposal.proposal_angle.why_now",
  "proposal.proposal_angle.differentiation",
  "proposal.concept.theme",
  "proposal.concept.mood",
  "proposal.concept.key_experience",
];

// 필드별 선택지 템플릿 (2-3개)
// 인간 리뷰어가 클릭으로 해결할 수 있도록 구체적이고 선택 가능한 문장
const FIELD_CHOICES: Record<string, string[]> = {
  "proposal.proposal_angle.core_message": [
    "브랜드 세계관을 '살아있는 런웨이'로 구현 — 방문객이 주인공이 되는 팝업",
    "일상 속 한정 순간 — 방문하지 않으면 경험할 수 없는 컬렉션 첫 공개",
    "컬렉션을 '입는 경험'으로 — 전시에서 착용 체험형으로의 전환",
  ],
  "proposal.proposal_angle.why_now": [
    "F/W 시즌 전환점(8월) — MZ 패션 소비자의 구매 의향이 연중 최고조",
    "경쟁 브랜드 팝업 공백기 — 성수동 팝업 밀집 시즌 전 선점 기회",
    "신컬렉션 디지털 론칭 직후 — 오프라인 첫 체험 창구로 시너지 극대화",
  ],
  "proposal.proposal_angle.differentiation": [
    "경쟁사 전시형 대비 '착용 체험형 런웨이' — SNS 공유율 2.3배 우위",
    "AI 포토부스 + 즉석 SNS 공유 → 방문객이 자연 브랜드 앰배서더로 전환",
    "POS 연동 즉석 구매 루프 — 체험→구매 마찰을 단계별로 최소화",
  ],
  "proposal.concept.theme": [
    "Living Runway — 일상이 런웨이가 되는 순간",
    "Archive Moment — 컬렉션을 기억하는 방식, 오직 이 공간에서만",
    "Into the Collection — 컬렉션 세계 속으로 걸어 들어가는 경험",
  ],
  "proposal.concept.mood": [
    "다크 모노크롬 + 웜 스팟 조명 + 인더스트리얼 소재 (강렬·세련)",
    "클린 화이트 + 골드 액센트 + 미니멀 럭셔리 (프리미엄·절제)",
    "텍스처 레이어드 + 뉴트럴 팔레트 + 소프트 조명 (편안·고급)",
  ],
  "proposal.concept.key_experience": [
    "신규 컬렉션 피팅 체험존 — 아이템 직접 착용 후 AI 포토부스 촬영",
    "AR 스타일링 미러 체험 — 신기술 연출로 MZ 세대 공유욕 자극",
    "포토부스 + 즉석 스타일링 촬영 — SNS 즉시 공유 유도 (태그 이벤트 연동)",
  ],
};

// 기본 선택지 (FIELD_CHOICES에 없는 경우 폴백)
const DEFAULT_CHOICES: string[] = [
  "(현재 값 유지) 페르소나 초안 그대로 사용",
  "(대안 A) 보수적 — 클라이언트 RFP 요건 중심으로 재작성",
  "(대안 B) 공격적 — 차별화 요소 극대화, 도전적 문구로 변경",
];

/**
 * detectLowConfidenceFields
 *
 * field_provenance 배열에서 다음 조건을 모두 만족하는 항목을 반환한다:
 *   - source === "persona"
 *   - confidence < threshold (기본 0.7)
 *   - targetFields가 지정된 경우, 해당 경로에 포함된 필드만
 *
 * @param provenance  ProposalDocument.field_provenance
 * @param threshold   신뢰도 기준 (기본 LOW_CONFIDENCE_THRESHOLD = 0.7)
 * @param targetFields 검사할 필드 경로 목록 (미지정 시 전체)
 */
export function detectLowConfidenceFields(
  provenance: FieldProvenance[],
  threshold: number = LOW_CONFIDENCE_THRESHOLD,
  targetFields?: readonly string[],
): FieldProvenance[] {
  return provenance.filter(
    (p) =>
      p.source === "persona" &&
      p.confidence < threshold &&
      (targetFields === undefined || targetFields.includes(p.field_path)),
  );
}

/**
 * generatePersonaChoices
 *
 * 특정 field_path에 대해 2-3개의 페르소나 선택지 문자열을 반환한다.
 * FIELD_CHOICES 테이블에 없는 경로는 DEFAULT_CHOICES로 폴백.
 *
 * @param fieldPath  대상 필드 경로 (예: "proposal.concept.key_experience")
 */
export function generatePersonaChoices(fieldPath: string): string[] {
  return FIELD_CHOICES[fieldPath] ?? DEFAULT_CHOICES;
}

/**
 * buildPersonaReview
 *
 * proposal_angle, concept 가변 필드 중 confidence < threshold인 항목을
 * 감지하고 각 필드에 2-3개 선택지를 생성해 ReviewQueueItem[] 반환.
 *
 * @param provenance     ProposalDocument.field_provenance
 * @param currentValues  field_path → 현재 값 맵 (표시용)
 * @param threshold      신뢰도 기준 (기본 LOW_CONFIDENCE_THRESHOLD = 0.7)
 */
export function buildPersonaReview(
  provenance: FieldProvenance[],
  currentValues: Record<string, string> = {},
  threshold: number = LOW_CONFIDENCE_THRESHOLD,
): ReviewQueueItem[] {
  const lowConfFields = detectLowConfidenceFields(
    provenance,
    threshold,
    PERSONA_VARIABLE_FIELDS,
  );

  return lowConfFields.map((p) => ({
    field_path: p.field_path,
    current_value: currentValues[p.field_path] ?? "(페르소나 생성 값)",
    confidence: p.confidence,
    persona_id: p.persona_id ?? "unknown-persona",
    choices: generatePersonaChoices(p.field_path),
  }));
}
