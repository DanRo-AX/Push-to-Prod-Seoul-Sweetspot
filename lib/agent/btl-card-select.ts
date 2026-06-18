// lib/agent/btl-card-select.ts
// Sub-AC 5.2: LLM 카드 선택 + Provenance 기록
//
// filterCardsByTags() 로 추린 후보 카드 중 LLM이 최적 카드를 선택하고
// RFP 컨텍스트에 맞게 문구를 조정한다.
// 결과 field_provenance에 source + card_id + confidence 를 기록한다.
// → golden-run 재현: 적용 결과는 btl_proposal artifact SSE 이벤트로 기록됨.

import Anthropic from "@anthropic-ai/sdk";
import type { FieldProvenance, PatternCard } from "@/lib/types";

const MODEL = "claude-opus-4-8";

// ── 입출력 타입 ──────────────────────────────────────────────────────────────

export interface CardSelectionInput {
  /** 어느 필드에 적용할지 (예: "proposal.proposal_angle.differentiation") */
  field_path: string;
  /** RFP 요약 컨텍스트 (산업, 프로젝트 제목, 목표 등) */
  rfp_context: string;
  /** filterCardsByTags() 로 추린 후보 패턴카드 */
  candidates: PatternCard[];
  /** 이 선택을 수행하는 페르소나 ID */
  persona_id: string;
}

export interface CardSelectionOutput {
  /** LLM이 RFP 컨텍스트에 맞게 조정한 핵심 문구 */
  adapted_text: string;
  /** source + card_id + confidence 가 모두 기록된 provenance */
  field_provenance: FieldProvenance;
}

// LLM이 반환해야 하는 JSON 스키마 (내부용)
interface LlmSelectionResult {
  selected_card_id: string;
  adapted_text: string;
  confidence: number;
  reason: string;
}

// ── 시스템 프롬프트 ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 BTL 팝업 에이전시의 기획 페르소나다.
주어진 패턴카드 후보 중 대상 필드에 가장 적합한 카드를 선택하고,
RFP 컨텍스트(클라이언트·산업·목표)에 맞게 문구를 조정한다.

## 반드시 JSON만 반환한다 (코드블록 없이, 설명 없이)
{
  "selected_card_id": "string — 선택한 카드 card_id",
  "adapted_text": "string — RFP 컨텍스트에 맞게 조정한 문구 (1~3문장, 한국어)",
  "confidence": 0.0~1.0,
  "reason": "string — 선택 이유 한 줄"
}`;

// ── JSON 추출 헬퍼 ───────────────────────────────────────────────────────────

function extractJson(text: string): LlmSelectionResult | null {
  try {
    // ```json ... ``` 코드블록 또는 순수 { ... } 추출
    const match =
      text.match(/```(?:json)?\s*\n?([\s\S]*?)```/) ??
      text.match(/(\{[\s\S]*\})/);
    const jsonStr = match ? match[1].trim() : text.trim();
    return JSON.parse(jsonStr) as LlmSelectionResult;
  } catch {
    return null;
  }
}

// ── 메인 함수 ────────────────────────────────────────────────────────────────

/**
 * selectAndAdaptCard
 *
 * 후보 패턴카드 중 LLM이 최적 카드를 선택하고 RFP 컨텍스트에 맞게 문구를 조정한다.
 * 결과의 field_provenance 에는 source="persona", card_id, confidence 가 모두 기록된다.
 *
 * @param input   카드 선택 입력 (필드 경로, RFP 컨텍스트, 후보 카드, 페르소나 ID)
 * @param client  Anthropic SDK 클라이언트 (테스트에서 mock 주입 가능)
 * @returns       적용된 문구 + field_provenance
 */
export async function selectAndAdaptCard(
  input: CardSelectionInput,
  client: Anthropic,
): Promise<CardSelectionOutput> {
  const { field_path, rfp_context, candidates, persona_id } = input;

  // ── 후보 없으면 빈 provenance로 즉시 반환 ──
  if (candidates.length === 0) {
    return {
      adapted_text: "",
      field_provenance: {
        field_path,
        source: "persona",
        persona_id,
        confidence: 0.5,
        editable_by_user: true,
        // card_id 없음 — 카드 미적용
      },
    };
  }

  // ── 후보 카드 직렬화 (title + content + card_id 만 포함) ──
  const candidatesJson = JSON.stringify(
    candidates.map((c) => ({
      card_id: c.card_id,
      title: c.title,
      content: c.content,
      field_path: c.field_path,
    })),
    null,
    2,
  );

  const userMsg = `## 대상 필드
${field_path}

## RFP 컨텍스트
${rfp_context}

## 후보 패턴카드 (${candidates.length}개)
${candidatesJson}

위 후보 중 "${field_path}" 에 가장 적합한 카드를 선택하고, RFP 컨텍스트에 맞게 문구를 조정하라.`;

  // ── LLM 호출 ──
  let parsed: LlmSelectionResult | null = null;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    });

    // thinking 블록 건너뛰고 text 블록만 파싱
    const textBlock = msg.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      parsed = extractJson(textBlock.text);
    }
  } catch {
    // LLM 호출 실패 → 아래 폴백 처리
  }

  // ── 폴백: LLM 실패 또는 JSON 파싱 실패 ──
  if (!parsed) {
    const fallback = candidates[0];
    return {
      adapted_text: fallback.content,
      field_provenance: {
        field_path,
        source: "persona",
        persona_id,
        confidence: 0.6,
        card_id: fallback.card_id,
        editable_by_user: true,
      },
    };
  }

  // ── selected_card_id 유효성 검증 ──
  // LLM이 후보에 없는 card_id를 반환할 경우 첫 번째 카드로 교정
  const validCard = candidates.find((c) => c.card_id === parsed!.selected_card_id);
  const resolvedCardId = validCard ? parsed.selected_card_id : candidates[0].card_id;

  // confidence 범위 클램프 (0~1)
  const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.7));

  return {
    adapted_text: parsed.adapted_text ?? "",
    field_provenance: {
      field_path,
      source: "persona",
      persona_id,
      confidence,
      card_id: resolvedCardId,
      editable_by_user: true,
    },
  };
}
