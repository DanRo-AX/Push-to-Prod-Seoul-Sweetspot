// lib/agent/btl-engine.ts
// C-BTL 에이전트 엔진 — RFP→기획제안서→견적서 단계 전이 상태 기계
// 각 단계 완료 시 typed artifact SSE 이벤트를 발행한다.

import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentEvent,
  BtlIndustry,
  BtlScopeRequirement,
  BtlScenarioPack,
  BtlStage,
  FieldProvenance,
  PatternCard,
  PersonaRef,
  ProposalDocument,
  QuoteDocument,
  QuoteLine,
  ReviewQueueItem,
  RfpDocument,
} from "@/lib/types";
import { getSetting } from "@/lib/runtime-settings";
import { fetchRagEstimate, type RagEstimate } from "@/lib/agent/btl-rag-estimate";

const MODEL = "claude-opus-4-8";
const MAX_ITERATIONS = 20;
const LOW_CONFIDENCE_THRESHOLD = 0.7;

// ── 단계 전이 라벨 ──
const STAGE_LABELS: Record<BtlStage, string> = {
  rfp_ready: "RFP 분석 완료",
  proposal_drafting: "기획제안서 작성 중",
  proposal_ready: "기획제안서 완료",
  quote_drafting: "견적서 산출 중",
  quote_ready: "견적서 완료",
};

export interface RunBtlAgentOptions {
  message: string;
  pack: BtlScenarioPack;
  onEvent: (e: AgentEvent) => void;
  /** 업로드된 RFP(드래그앤드롭 추출본). 없으면 pack.mockRfp 사용. */
  rfpOverride?: RfpDocument;
}

// ── 패턴카드 매칭: field_path 정확 매칭 → industry + track 태그로 확장 ──
export function matchPatternCards(
  cards: PatternCard[],
  fieldPath: string,
  industry: string,
  tracks: string[],
): PatternCard[] {
  return cards.filter(
    (c) =>
      c.field_path === fieldPath ||
      (c.industry.includes(industry as PatternCard["industry"][number]) &&
        c.track.some((t) => tracks.includes(t))),
  );
}

// ── field_provenance 생성 헬퍼 ──
function makeProvenance(
  fieldPath: string,
  source: FieldProvenance["source"],
  confidence: number,
  personaId?: string,
  cardId?: string,
): FieldProvenance {
  return {
    field_path: fieldPath,
    source,
    persona_id: personaId,
    confidence,
    card_id: cardId,
    editable_by_user: source === "persona",
  };
}

// ── review_queue 항목 생성 (confidence < LOW_CONFIDENCE_THRESHOLD) ──
function maybeEnqueue(
  queue: ReviewQueueItem[],
  fieldPath: string,
  currentValue: string,
  confidence: number,
  personaId: string,
  choices: string[],
): void {
  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    queue.push({
      field_path: fieldPath,
      current_value: currentValue,
      confidence,
      persona_id: personaId,
      choices,
    });
  }
}

// ── 단가 마스터 조회 ──
function lookupUnitPrice(
  pricing: BtlScenarioPack["mockPricing"],
  itemName: string,
): number {
  const entry = pricing.find(
    (p) =>
      p.item_key === itemName ||
      itemName.includes(p.item_key) ||
      p.item_key.includes(itemName),
  );
  return entry?.unit_price ?? 0;
}

// ── 견적서 계산: production_items × 단가 마스터 (RAG 견적기로 금액 보정 가능) ──
export function buildQuoteFromProposal(
  proposal: ProposalDocument,
  pack: BtlScenarioPack,
  ragEstimate?: RagEstimate | null,
): QuoteDocument {
  const OVERHEAD_RATE = 0.08; // 8% 간접비
  const MARGIN_RATE = 0.12; // 12% 마진

  const baseLineItems: QuoteLine[] = proposal.production_items.map((item, i) => {
    const unitPrice =
      item.unit_price_hint ?? lookupUnitPrice(pack.mockPricing, item.item_name);
    const amount = item.qty * unitPrice;
    return {
      line_id: `LINE-${String(i + 1).padStart(3, "0")}`,
      source_item_id: item.item_id,
      name: item.item_name,
      category: item.category,
      qty: item.qty,
      unit_price: unitPrice,
      amount,
    };
  });

  const baseSubtotal = baseLineItems.reduce((sum, l) => sum + l.amount, 0);

  // RAG 견적기 연동: mock 단가는 비현실적으로 낮으므로, RAG 총 추정에서 역산한
  // 목표 subtotal 에 맞춰 line 금액을 비례 스케일한다(항목 구조는 제안서대로 유지).
  const extraAssumptions: string[] = [];
  let lineItems = baseLineItems;
  if (ragEstimate && ragEstimate.mid > 0) {
    const targetSubtotal = Math.round(ragEstimate.mid / (1 + OVERHEAD_RATE + MARGIN_RATE));
    if (baseSubtotal > 0) {
      // mock 단가가 있으면 그 가중치를 유지한 채 RAG 총액에 비례 스케일.
      const factor = targetSubtotal / baseSubtotal;
      lineItems = baseLineItems.map((l) => ({
        ...l,
        unit_price: Math.round(l.unit_price * factor),
        amount: Math.round(l.amount * factor),
      }));
    } else {
      // 업로드 RFP 등 mock 단가 미매칭(subtotal 0) — RAG 목표를 항목에 균등 분배.
      const per = Math.round(targetSubtotal / Math.max(1, baseLineItems.length));
      lineItems = baseLineItems.map((l) => ({
        ...l,
        unit_price: l.qty > 0 ? Math.round(per / l.qty) : per,
        amount: per,
      }));
    }
    extraAssumptions.push(
      `${ragEstimate.source} 기반 산정 — 총 추정 ${ragEstimate.label}`,
      `참고 카테고리(중앙값): 시공 ${ragEstimate.categories.construction.toLocaleString()}원 · 운영 ${ragEstimate.categories.operation.toLocaleString()}원 · 임대 ${ragEstimate.categories.rent.toLocaleString()}원 · 기타 ${ragEstimate.categories.others.toLocaleString()}원`,
    );
  }

  const subtotal = lineItems.reduce((sum, l) => sum + l.amount, 0);
  const overhead = Math.round(subtotal * OVERHEAD_RATE);
  const margin = Math.round(subtotal * MARGIN_RATE);
  const total = subtotal + overhead + margin;

  const issuedAt = new Date().toISOString();
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return {
    quote_id: `QT-${Date.now()}`,
    proposal_id: proposal.proposal_id,
    client_brand: proposal.client_brand,
    line_items: lineItems,
    subtotal,
    overhead,
    margin,
    total,
    currency: "KRW",
    scope_boundary: proposal.scope_boundary,
    assumptions: [
      ...extraAssumptions,
      "부가세(VAT) 별도",
      "설계 변경 시 견적 재산출",
      "자재비 5% 이상 변동 시 재조정 가능",
    ],
    validity: { until: validUntil },
    version: 1,
    issued_at: issuedAt,
  };
}

// ── 메인 BTL 에이전트 실행 ──
export async function runBtlAgent(opts: RunBtlAgentOptions): Promise<void> {
  const { message, pack, onEvent } = opts;
  // 업로드된 RFP 가 있으면 그걸로, 없으면 시나리오 팩의 고정 mockRfp 로 흐름을 시작한다.
  const rfp = opts.rfpOverride ?? pack.mockRfp;

  const apiKey = getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    onEvent({
      type: "status",
      status: "error",
      message:
        "Anthropic API 키가 설정되지 않았습니다. 설정 화면에서 ANTHROPIC_API_KEY를 입력하세요.",
    });
    return;
  }

  const client = new Anthropic({ apiKey });

  onEvent({ type: "status", status: "started" });

  // ── 단계 1: RFP 아티팩트 발행 ──
  onEvent({
    type: "status",
    status: "thinking",
    message: STAGE_LABELS.rfp_ready,
  });

  onEvent({
    type: "tool_start",
    toolUseId: "btl-rfp-load",
    toolName: "read_rfp",
    label: "RFP 문서 분석 중",
    input: { rfp_id: rfp.rfp_id },
  });

  onEvent({
    type: "artifact",
    artifact: { kind: "btl_rfp", rfp },
  });

  onEvent({
    type: "tool_end",
    toolUseId: "btl-rfp-load",
    toolName: "read_rfp",
    summary: `RFP ${rfp.rfp_id} 로드 완료 — ${rfp.project_title}`,
  });

  // ── 단계 2: 기획제안서 작성 (LLM 호출) ──
  onEvent({
    type: "status",
    status: "thinking",
    message: STAGE_LABELS.proposal_drafting,
  });

  onEvent({
    type: "tool_start",
    toolUseId: "btl-proposal-draft",
    toolName: "draft_proposal",
    label: "기획제안서 작성 중 (페르소나 적용)",
    input: { rfp_id: rfp.rfp_id },
  });

  // 시스템 프롬프트: 기획제안서 작성 지시 (rfp 는 함수 상단에서 결정됨)
  const patternCardsJson = JSON.stringify(pack.mockPatternCards, null, 2);
  const pricingJson = JSON.stringify(pack.mockPricing.slice(0, 10), null, 2);

  const proposalSystem = `당신은 BTL 팝업 에이전시의 기획팀장이다. RFP를 분석해 기획제안서를 JSON으로 작성한다.

## 작성 규칙
- 반드시 아래 JSON 스키마를 정확히 따른다
- 가변 필드는 패턴카드를 참조해 채운다 (card_id 반드시 기록)
- confidence 0.0~1.0 범위로 필드별 자신감을 정직하게 평가
- 한국어로 작성
- production_items는 5~8개 작성 (RFP 요건 반영)

## 패턴 카드 (활용 가능)
${patternCardsJson}

## 단가 마스터 (참고)
${pricingJson}

## 출력 형식 (JSON만, 설명 없음)
{
  "proposal_id": "string",
  "proposal_angle": {
    "core_message": "string",
    "why_now": "string",
    "differentiation": "string",
    "evidence_refs": ["string"]
  },
  "concept": {
    "theme": "string",
    "mood": ["string"],
    "key_experience": "string"
  },
  "target_segment": {
    "primary": "string",
    "segments": ["string"],
    "insight": "string"
  },
  "space_plan": {
    "size_pyeong": number,
    "zones": [{"name": "string", "purpose": "string"}],
    "layout_note": "string"
  },
  "production_items": [
    {
      "item_id": "string",
      "item_name": "string",
      "category": "시공|제작물|렌탈|인력|운영|기타",
      "qty": number,
      "spec_note": "string"
    }
  ],
  "schedule": {
    "lead_time_days": number,
    "milestones": ["string"]
  },
  "scope_boundary": {
    "included": ["string"],
    "excluded": ["string"]
  },
  "success_metric": ["string"],
  "field_provenance": [
    {
      "field_path": "string",
      "source": "persona",
      "persona_id": "creative-persona",
      "confidence": number,
      "card_id": "string or null",
      "editable_by_user": true
    }
  ]
}`;

  // 서사 파트 / 의무 견적 골격 — RFP 가 제시했으면 제안서가 반드시 소비해야 하는 구조.
  const narrativeBlock =
    rfp.narrative_parts && rfp.narrative_parts.length > 0
      ? `\n- 전시 서사 파트(반드시 컨셉·존 구성에 반영): ${rfp.narrative_parts
          .map((p) => (p.description ? `${p.name}(${p.description})` : p.name))
          .join(" / ")}`
      : "";
  const quoteSectionsBlock =
    rfp.required_quote_sections && rfp.required_quote_sections.length > 0
      ? `\n- 요구 견적 골격(production_items 가 이 비용 카테고리를 모두 포괄하도록 구성): ${rfp.required_quote_sections
          .map((s) => `${s.name}[${s.items.join("·")}]`)
          .join(" / ")}`
      : "";

  const proposalUserMsg = `다음 RFP를 분석해 기획제안서를 JSON으로 작성하라.

## RFP 요약
- 프로젝트: ${rfp.project_title}
- 클라이언트: ${rfp.client_brand.client_name}
- 산업: ${rfp.client_brand.industry}
- 계약방식: ${rfp.contract_method ?? "미상"}
- 기간: ${rfp.period.start} ~ ${rfp.period.end}
- 장소: ${rfp.venue_requirement.area ?? "미정"} ${rfp.venue_requirement.size_pyeong ?? ""}${rfp.venue_requirement.size_pyeong ? "평" : ""}
- 예산: ${rfp.budget_range ? `${(rfp.budget_range.min ?? 0).toLocaleString()}~${(rfp.budget_range.max ?? 0).toLocaleString()}원` : "미정(제안사가 산정)"}
- 필수 요건: ${rfp.mandatory_requirements.join(", ")}
- 목표: ${rfp.objective}${narrativeBlock}${quoteSectionsBlock}`;

  let proposalJson: ProposalDocument | null = null;
  let thinkingNotified = false;

  try {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: proposalUserMsg },
    ];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: proposalSystem,
        messages,
      });

      stream.on("streamEvent", (event) => {
        if (
          !thinkingNotified &&
          event.type === "content_block_start" &&
          event.content_block.type === "thinking"
        ) {
          thinkingNotified = true;
          onEvent({
            type: "status",
            status: "thinking",
            message: "기획제안서 구상 중...",
          });
        }
      });

      const msg = await stream.finalMessage();

      if (msg.stop_reason !== "tool_use") {
        // 텍스트 응답 → JSON 파싱
        const textBlock = msg.content.find((b) => b.type === "text");
        if (textBlock && textBlock.type === "text") {
          try {
            // JSON 코드블록 또는 순수 JSON 추출
            const raw = textBlock.text;
            const jsonMatch =
              raw.match(/```(?:json)?\n?([\s\S]*?)```/) ??
              raw.match(/(\{[\s\S]*\})/);
            const jsonStr = jsonMatch ? jsonMatch[1] : raw;
            const parsed = JSON.parse(jsonStr.trim());
            proposalJson = parsed as ProposalDocument;
          } catch {
            // JSON 파싱 실패 — 폴백으로 기본 구조 사용
          }
        }
        break;
      }

      messages.push({ role: "assistant", content: msg.content });
      // tool_use 블록은 이 엔진에서 사용하지 않음 (단순 생성)
      break;
    }
  } catch {
    // LLM 호출 실패 → 폴백 구조 사용
  }

  // ── 폴백: LLM 실패 시 정적 기획제안서 ──
  const contributors: PersonaRef[] = [
    {
      persona_id: "creative-persona",
      role: "creative",
      data_sources: ["패턴카드 DB", "과거 프로젝트 레퍼런스"],
      experience_level: 12,
    },
    {
      persona_id: "strategy-persona",
      role: "strategy",
      data_sources: ["RFP 문서", "시장 트렌드 데이터"],
      experience_level: 8,
    },
  ];

  const fieldProvenanceFallback: FieldProvenance[] = [
    makeProvenance(
      "proposal.proposal_angle.why_now",
      "persona",
      0.85,
      "strategy-persona",
      "PC-001",
    ),
    makeProvenance(
      "proposal.proposal_angle.differentiation",
      "persona",
      0.78,
      "creative-persona",
      "PC-002",
    ),
    makeProvenance(
      "proposal.space_plan.zones",
      "persona",
      0.90,
      "creative-persona",
      "PC-003",
    ),
    makeProvenance(
      "proposal.concept.mood",
      "persona",
      0.92,
      "creative-persona",
      "PC-005",
    ),
    makeProvenance(
      "proposal.concept.key_experience",
      "persona",
      0.65,
      "creative-persona",
      undefined,
    ),
    makeProvenance(
      "proposal.success_metric",
      "persona",
      0.88,
      "strategy-persona",
      "PC-007",
    ),
    makeProvenance(
      "proposal.production_items",
      "persona",
      0.72,
      "creative-persona",
      "PC-006",
    ),
  ];

  const reviewQueue: ReviewQueueItem[] = [];
  for (const prov of fieldProvenanceFallback) {
    if (prov.source === "persona") {
      const choices = prov.field_path.includes("key_experience")
        ? [
            "신규 컬렉션 피팅 체험존 운영 (아이템 직접 착용)",
            "AR 스타일링 미러 체험 (신기술 연출)",
            "포토부스 + 즉석 컬렉션 스타일링 촬영",
          ]
        : [];
      maybeEnqueue(
        reviewQueue,
        prov.field_path,
        "(페르소나 생성 값)",
        prov.confidence,
        prov.persona_id ?? "unknown-persona",
        choices,
      );
    }
  }

  const proposal: ProposalDocument = proposalJson
    ? {
        ...proposalJson,
        rfp_id: rfp.rfp_id,
        client_brand: rfp.client_brand,
        contributors,
        field_provenance:
          proposalJson.field_provenance ?? fieldProvenanceFallback,
        review_queue: reviewQueue,
      }
    : {
        proposal_id: `PRP-${Date.now()}`,
        rfp_id: rfp.rfp_id,
        client_brand: rfp.client_brand,
        proposal_angle: {
          core_message: `LUX패션 F/W 컬렉션의 세계관을 '살아있는 런웨이'로 구현 — 방문객이 모델이 되는 팝업`,
          why_now: `F/W 시즌 전환점(8월)은 패션 소비자의 구매 의향이 연중 최고조. MZ 세대는 체험 기반 첫 구매 선호 경향이 강함 (PC-001 참조)`,
          differentiation: `경쟁사 팝업이 '전시형'에 집중하는 반면, LUX팝업은 '착용 체험형 런웨이' — 신규 컬렉션을 직접 입고 포토존에서 촬영하는 참여형 구조 (PC-002 참조)`,
          evidence_refs: [
            "패션 팝업 체험형 vs 전시형 SNS 공유율 비교 (2.3배)",
            "F/W 시즌 팝업 구매 전환율 데이터",
          ],
        },
        concept: {
          theme: "Living Runway — 일상이 런웨이가 되는 순간",
          mood: [
            "다크 모노크롬",
            "레이어드 텍스처",
            "인더스트리얼 소재",
            "웜 스팟 조명",
          ],
          key_experience:
            "신규 컬렉션 아이템 직접 착용 후 AI 포토부스에서 촬영 → 즉시 SNS 공유",
        },
        target_segment: {
          primary: "20-35세 패션 리더 (서울 거주, SNS 활발)",
          segments: [
            "패션 얼리어답터",
            "SNS 콘텐츠 크리에이터",
            "프리미엄 브랜드 구매 의향층",
          ],
          insight:
            "체험→공유→구매 전환 루프를 설계해 방문객이 자연스럽게 브랜드 앰배서더가 되게 유도",
        },
        space_plan: {
          size_pyeong: rfp.venue_requirement.size_pyeong ?? 80,
          zones: [
            {
              name: "파사드·웰컴존",
              purpose: "브랜딩 외벽 + 입장 체크인 + 굿즈 수령",
            },
            {
              name: "메인 전시존",
              purpose: "F/W 컬렉션 전 24종 행거·쇼케이스 전시",
            },
            {
              name: "리빙 런웨이 피팅존",
              purpose: "신규 아이템 착용 체험 + AI 포토부스 촬영",
            },
            {
              name: "카운터·POS",
              purpose: "즉석 구매·사전예약 결제 + 굿즈 증정",
            },
          ],
          layout_note:
            "파사드→전시→피팅→카운터 일방통행 동선. 피팅존과 포토부스를 인접 배치해 체험→공유 흐름 단축",
        },
        production_items: [
          {
            item_id: "ITEM-001",
            item_name: "파사드 외벽 시공",
            category: "시공",
            qty: 1,
            spec_note: "브랜드 컬러 래핑 + 네온 로고 조명",
          },
          {
            item_id: "ITEM-002",
            item_name: "내부 인테리어 시공",
            category: "시공",
            qty: 1,
            spec_note: "인더스트리얼 + 다크 모노크롬 테마 시공 (80평)",
          },
          {
            item_id: "ITEM-003",
            item_name: "포토존 제작",
            category: "제작물",
            qty: 2,
            spec_note: "AI 포토부스 1개 + 브랜드 배경 포토존 1개",
          },
          {
            item_id: "ITEM-004",
            item_name: "행거랙 렌탈",
            category: "렌탈",
            qty: 12,
            spec_note: "24종 컬렉션 전시용 (12일)",
          },
          {
            item_id: "ITEM-005",
            item_name: "조명 장비 렌탈",
            category: "렌탈",
            qty: 1,
            spec_note: "스팟·무드·포토존 조명 풀셋 (12일)",
          },
          {
            item_id: "ITEM-006",
            item_name: "운영 매니저",
            category: "인력",
            qty: 12,
            spec_note: "현장 총괄 1명 × 12일",
          },
          {
            item_id: "ITEM-007",
            item_name: "운영 스태프",
            category: "인력",
            qty: 36,
            spec_note: "3명 × 12일 (시프트 운영)",
          },
          {
            item_id: "ITEM-008",
            item_name: "VIP 행사 운영 인력",
            category: "인력",
            qty: 3,
            spec_note: "VIP 사전 체험 행사 (8.19) 전담",
          },
          {
            item_id: "ITEM-009",
            item_name: "그래픽 제작",
            category: "제작물",
            qty: 1,
            spec_note: "내외부 브랜딩 그래픽 전체",
          },
          {
            item_id: "ITEM-010",
            item_name: "VIP 굿즈 패키지",
            category: "제작물",
            qty: 80,
            spec_note: "VIP 80명 증정용 브랜드 굿즈 세트",
          },
          {
            item_id: "ITEM-011",
            item_name: "기획·디렉팅 비",
            category: "운영",
            qty: 1,
            spec_note: "기획·크리에이티브 디렉팅 전체",
          },
          {
            item_id: "ITEM-012",
            item_name: "설치·철거 인력",
            category: "인력",
            qty: 18,
            spec_note: "설치 3일 + 철거 3일 × 3명",
          },
        ],
        schedule: {
          lead_time_days: 41,
          milestones: [
            "2026-06-25: 제안서 제출",
            "2026-07-05: 계약 완료 (예정)",
            "2026-07-10: 기획 확정·발주",
            "2026-08-01: 제작물 1차 검수",
            "2026-08-15: 현장 시공 시작",
            "2026-08-19: VIP 사전 행사",
            "2026-08-20: 일반 오픈",
            "2026-08-31: 운영 종료",
            "2026-09-03: 철거 완료",
          ],
        },
        scope_boundary: {
          included: [
            "공간 기획 및 크리에이티브 디렉팅",
            "시공·설치·철거",
            "제작물 전체",
            "운영 인력 배치",
            "VIP 행사 운영",
          ],
          excluded: [
            "공간 임대료",
            "VAT",
            "LUX패션 자체 마케팅 비용",
            "PR/광고 집행비",
          ],
        },
        success_metric: [
          "일 방문객 200명 달성 (12일 합계 2,400명 목표)",
          "현장 구매 전환율 10% 이상",
          "SNS 해시태그 노출 누적 10만 건",
          "VIP 행사 취재 3개 매체 이상",
        ],
        contributors,
        field_provenance: fieldProvenanceFallback,
        review_queue: reviewQueue,
      };

  onEvent({
    type: "artifact",
    artifact: { kind: "btl_proposal", proposal },
  });

  onEvent({
    type: "tool_end",
    toolUseId: "btl-proposal-draft",
    toolName: "draft_proposal",
    summary: `기획제안서 완성 — ${proposal.production_items.length}개 제작 항목, ${proposal.review_queue.length}개 검토 필요 필드`,
  });

  // ── 단계 3: 견적서 발행 ──
  onEvent({
    type: "status",
    status: "thinking",
    message: STAGE_LABELS.quote_drafting,
  });

  // RAG 사전견적기 연동 — 실패/오프라인이면 null → mock 단가 폴백(골든런 안전).
  const ragEstimate: RagEstimate | null = await fetchRagEstimate();

  onEvent({
    type: "tool_start",
    toolUseId: "btl-quote-gen",
    toolName: "generate_quote",
    label: ragEstimate
      ? "견적서 산출 중 (RAG 사전견적기 보정)"
      : "견적서 산출 중 (제작 항목 × 단가 마스터)",
    input: { proposal_id: proposal.proposal_id },
  });

  const quote = buildQuoteFromProposal(proposal, pack, ragEstimate);

  onEvent({
    type: "artifact",
    artifact: { kind: "btl_quote", quote },
  });

  onEvent({
    type: "tool_end",
    toolUseId: "btl-quote-gen",
    toolName: "generate_quote",
    summary: `견적서 완성 — 합계 ${quote.total.toLocaleString()}원 (VAT 별도)`,
  });

  // ── 시나리오 완료 이벤트 발행 — 패턴카드 추출 트리거 ──
  // 이 이벤트를 수신한 route 핸들러가 btl_extract_pattern_card 를 호출해
  // 골든런 JSONL 에 패턴카드를 추가한다.
  const appliedCardIds = proposal.field_provenance
    .filter((p) => p.card_id)
    .map((p) => p.card_id!)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  onEvent({
    type: "scenario_complete",
    rfp,
    proposal,
    quote,
    applied_card_ids: appliedCardIds,
  });

  onEvent({
    type: "status",
    status: "done",
    message: `BTL 워크플로우 완료 — RFP → 기획제안서 → 견적서 (${quote.total.toLocaleString()}원)`,
  });
}

// ───────────────────────── btl_extract_pattern_card ─────────────────────────
// 완료된 BTL 런 컨텍스트에서 새 패턴카드 1개를 생성(mint)한다.
// 결정론적(LLM 미사용) — 골든런 재현 가능.

/** 완료된 BTL 런 컨텍스트 — btl_extract_pattern_card 의 입력 */
export interface BtlRunContext {
  rfp: RfpDocument;
  proposal: ProposalDocument;
  quote: QuoteDocument;
  /** 이 런에서 실제 적용된 패턴카드 ID 목록 */
  applied_card_ids: string[];
}

/**
 * 패턴카드 콘텐츠 합성: proposal 의 핵심 인사이트를 재사용 가능한 스니펫으로 압축.
 * 컨셉 테마 + 차별점 + 핵심 체험 + 성과 지표 첫 번째 항목으로 구성.
 */
function buildCardContent(proposal: ProposalDocument): string {
  const { concept, proposal_angle, success_metric } = proposal;
  const parts: string[] = [];

  if (concept.theme) {
    parts.push(`컨셉: ${concept.theme}.`);
  }
  if (proposal_angle.differentiation) {
    parts.push(`차별점: ${proposal_angle.differentiation}`);
  }
  if (concept.key_experience) {
    parts.push(`핵심 체험: ${concept.key_experience}`);
  }
  if (success_metric.length > 0) {
    parts.push(`핵심 지표: ${success_metric[0]}`);
  }

  return parts.join(" | ");
}

/**
 * btl_extract_pattern_card
 *
 * 완료된 BTL 런(RFP→제안서→견적서)에서 새 패턴카드 1개를 추출·반환한다.
 * - 제약: 시나리오 완료 후 정확히 1개 mint (Seed AC6 "exactly one additional card")
 * - 결정론적: LLM 미호출 — 골든런 재현 가능
 * - card_id 형식: PC-NEW-<rfp_id> (테스트에서 동일 픽스처로 동일 값 재현 가능)
 */
export function btl_extract_pattern_card(ctx: BtlRunContext): PatternCard {
  const { rfp, proposal } = ctx;

  // ── 핵심 anchor 필드 결정 ──
  // persona 출처 필드 중 confidence 가 가장 높은 것을 anchor 로 선택.
  // differentiation 이 있으면 우선 선택 (재사용 가치 최고).
  const personaFields = proposal.field_provenance
    .filter((p) => p.source === "persona")
    .sort((a, b) => b.confidence - a.confidence);

  const anchor =
    personaFields.find((p) =>
      p.field_path.includes("differentiation"),
    ) ?? personaFields[0];

  // ── 패턴카드 필드 합성 ──
  const cardId = `PC-NEW-${rfp.rfp_id}`;
  const industry: BtlIndustry[] = [rfp.client_brand.industry];

  // scope_requirement → BtlScopeRequirement[] (유효값만 통과)
  const VALID_TRACKS: BtlScopeRequirement[] = ["기획", "운영", "제작"];
  const track: BtlScopeRequirement[] =
    rfp.scope_requirement.length > 0
      ? (rfp.scope_requirement.filter((t) =>
          VALID_TRACKS.includes(t as BtlScopeRequirement),
        ) as BtlScopeRequirement[])
      : ["기획"];

  const title = `${rfp.client_brand.industry} 팝업 — ${proposal.concept.theme || proposal.concept.key_experience || rfp.project_title}`;
  const content = buildCardContent(proposal);
  const fieldPath =
    anchor?.field_path ?? "proposal.proposal_angle.differentiation";

  return {
    card_id: cardId,
    title,
    content,
    industry,
    track,
    field_path: fieldPath,
    usage_count: 0,
  };
}
