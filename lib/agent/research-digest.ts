// lib/agent/research-digest.ts
// 원시 리서치 텍스트 → ResearchDigest 자동 압축 함수
// — LLM 호출은 주입 가능 구조 (테스트 시 mock으로 교체)
// — 기본 LLM caller: @anthropic-ai/sdk (CLAUDE.md: claude-opus-4-8, adaptive thinking)
// — 파싱: ResearchDigestSchema (Zod) — 실패 시 throw

import type { ResearchDigest, DigestResearchType } from "@/lib/types";
import { ResearchDigestSchema } from "@/lib/agent/facet-digest-schema";
import { getSetting } from "@/lib/runtime-settings";

// ── LLM 호출 인터페이스 (주입 가능) ─────────────────────────────────────────
// rawText를 입력받아 JSON 문자열(ResearchDigest 형식)을 반환한다.
// 테스트 시 mockLLMCaller로 교체; 프로덕션은 defaultLLMCaller 사용.

export type LLMCaller = (rawText: string, researchType: DigestResearchType) => Promise<string>;

// ── 시스템 프롬프트 ─────────────────────────────────────────────────────────
// research_type별 raw_ref 서브타입 명세를 포함한다.
// 모델 출력: JSON 단일 블록만 (마크다운 래퍼 없음)

const SYSTEM_PROMPT = `당신은 BTL 제안서 리서치 압축 전문가입니다.
입력된 원시 리서치 텍스트를 읽고 아래 JSON 스키마에 정확히 맞는 ResearchDigest 객체 하나를 반환하세요.
JSON 이외의 텍스트(설명, 마크다운 코드블록 등)는 절대 포함하지 마세요 — 순수 JSON만 출력하세요.

ResearchDigest 스키마:
{
  "id": string,           // 고유 id (예: "digest-brand-<uuid>")
  "research_type": "brand" | "area" | "target" | "market",
  "claim": string,        // 1줄 핵심 요약 (한국어, 50자 이내)
  "confidence": number,   // float [0.0, 1.0] — 근거 강도
  "implication": string,  // 컨셉·제안서에 미치는 함의 (한국어, 80자 이내)
  "source": string,       // 출처 라벨 (한국어)
  "raw_ref": {            // research_type별 서브타입 (optional)
    // brand:  { "brand_name": string, "position": string }
    // area:   { "district": string, "coords"?: [number, number] }
    // target: { "segment": string, "size"?: number }
    // market: { "category": string, "trend"?: string }
  }
}

research_type은 입력으로 지정됩니다. raw_ref는 해당 타입의 필드만 포함하세요(여분 키 금지).`;

function buildUserPrompt(rawText: string, researchType: DigestResearchType): string {
  return `research_type: ${researchType}

원시 리서치 텍스트:
${rawText}

위 텍스트를 압축하여 ResearchDigest JSON을 반환하세요.`;
}

// ── 기본 LLM caller (프로덕션) ──────────────────────────────────────────────
// CLAUDE.md 규칙 준수:
//   - 모델: claude-opus-4-8
//   - thinking: adaptive
//   - temperature/top_p/top_k 금지
//   - API 키: getSetting 경유

export const defaultLLMCaller: LLMCaller = async (
  rawText: string,
  researchType: DigestResearchType,
): Promise<string> => {
  const apiKey = getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("[research-digest] ANTHROPIC_API_KEY 미설정");
  }

  // 동적 import: 서버 사이드에서만 실행되므로 번들 분리
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(rawText, researchType),
      },
    ],
  });

  // 텍스트 블록만 추출 (thinking 블록 제외)
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("[research-digest] LLM 응답에 텍스트 블록 없음");
  }
  return textBlock.text;
};

// ── ID 생성 헬퍼 ─────────────────────────────────────────────────────────────
function generateDigestId(researchType: DigestResearchType): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `digest-${researchType}-${ts}${rand}`;
}

// ── JSON 추출 ────────────────────────────────────────────────────────────────
// LLM가 마크다운 코드블록을 감쌀 경우 안전하게 벗겨냄
function extractJSON(raw: string): string {
  const stripped = raw.trim();
  // ```json ... ``` 또는 ``` ... ``` 제거
  const codeBlockMatch = stripped.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return stripped;
}

// ── compressToDigest: 메인 공개 API ─────────────────────────────────────────
/**
 * 원시 리서치 텍스트를 LLM으로 압축하여 ResearchDigest를 반환한다.
 *
 * @param rawText      원시 리서치 텍스트 (제한 없음)
 * @param researchType "brand" | "area" | "target" | "market"
 * @param llmCaller    LLM 호출 함수 (생략 시 defaultLLMCaller 사용)
 *                     테스트에서는 mockLLMCaller를 주입한다.
 * @returns            파싱·검증된 ResearchDigest
 * @throws             LLM 호출 실패 또는 JSON 파싱/스키마 검증 실패 시
 */
export async function compressToDigest(
  rawText: string,
  researchType: DigestResearchType,
  llmCaller: LLMCaller = defaultLLMCaller,
): Promise<ResearchDigest> {
  const rawOutput = await llmCaller(rawText, researchType);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawOutput));
  } catch (e) {
    throw new Error(
      `[research-digest] LLM 출력 JSON 파싱 실패:\n${rawOutput}\n\n원인: ${e}`,
    );
  }

  // id가 없으면 자동 생성 (LLM이 id를 누락할 수 있음)
  if (parsed && typeof parsed === "object" && !("id" in parsed)) {
    (parsed as Record<string, unknown>).id = generateDigestId(researchType);
  }

  // Zod 스키마 검증 (ResearchDigestSchema — 단일 계약)
  const result = ResearchDigestSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `[research-digest] ResearchDigest 스키마 검증 실패:\n${JSON.stringify(result.error.issues, null, 2)}\n입력: ${JSON.stringify(parsed, null, 2)}`,
    );
  }

  return result.data;
}

// ── mock LLM caller 팩토리 (테스트/PoC 용) ──────────────────────────────────
/**
 * 고정 JSON 응답을 반환하는 mock LLM caller를 생성한다.
 * 테스트에서 compressToDigest에 주입하여 LLM 없이 검증.
 */
export function createMockLLMCaller(responseJSON: string): LLMCaller {
  return async (_rawText: string, _researchType: DigestResearchType): Promise<string> => {
    return responseJSON;
  };
}

/**
 * research_type별 기본 mock 응답 맵.
 * 각 타입에 대해 올바른 ResearchDigest JSON 문자열을 반환한다.
 * PoC 1차: mock digest. 상권분석기 실연동은 phase-2.
 */
export const MOCK_DIGEST_RESPONSES: Record<DigestResearchType, string> = {
  brand: JSON.stringify({
    id: "digest-brand-mock-001",
    research_type: "brand",
    claim: "무신사스탠다드, 2030 남성 캐주얼 시장 점유율 1위",
    confidence: 0.85,
    implication: "동일 세그먼트 팝업 경쟁 시 명확한 차별화 포지션 설정 필수",
    source: "무신사 공개 보고서 2025",
    raw_ref: {
      brand_name: "무신사스탠다드",
      position: "2030 남성 캐주얼 1위",
    },
  }),
  area: JSON.stringify({
    id: "digest-area-mock-001",
    research_type: "area",
    claim: "성수동, 주말 유동인구 12만명 — 팝업 최적 상권",
    confidence: 0.9,
    implication: "집객 목표 달성 가능성 높음 — 체험형 구성 우선",
    source: "서울시 유동인구 통계 2025",
    raw_ref: {
      district: "성수동",
      coords: [37.5445, 127.0557],
    },
  }),
  target: JSON.stringify({
    id: "digest-target-mock-001",
    research_type: "target",
    claim: "핵심 타깃: 20대 후반 여성, 소비력 상위 30%",
    confidence: 0.75,
    implication: "가격대 전략 재설정 필요 — 프리미엄 포지셔닝 가능",
    source: "내부 CRM 분석 2025-Q1",
    raw_ref: {
      segment: "20대 후반 여성",
      size: 320000,
    },
  }),
  market: JSON.stringify({
    id: "digest-market-mock-001",
    research_type: "market",
    claim: "팝업 리테일 시장 YoY 34% 성장 — 체험형 전환 가속",
    confidence: 0.8,
    implication: "초기 진입 효과 2년 내 소멸 예상 → 조기 PoC 및 선점 전략 필요",
    source: "리테일 인사이트 코리아 2025",
    raw_ref: {
      category: "팝업 리테일",
      trend: "체험 중심 오프라인 전환",
    },
  }),
};
