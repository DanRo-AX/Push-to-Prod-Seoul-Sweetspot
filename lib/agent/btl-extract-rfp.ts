// lib/agent/btl-extract-rfp.ts — 업로드된 RFP 문서(텍스트 또는 PDF)를 LLM 으로
// RfpDocument(lib/types.ts 계약)로 추출한다. 채팅창 드래그앤드롭 업로드의 "RFP 분석" 단계.
//
// 설계:
//   · PDF 는 Claude 네이티브 document 블록(base64)으로 그대로 넘긴다 — pdf 파싱 라이브러리
//     의존 없음(빌드 네트워크/번들 리스크 회피).
//   · 텍스트류(txt/md/json/csv/docx 추출본)는 text 블록으로 넘긴다.
//   · 모델/사고: claude-opus-4-8 + adaptive thinking (프로젝트 규칙). temperature 등 금지.
//   · 구조화: emit_rfp 도구로 RfpDocument 스키마를 강제 유도하고, tool_use 블록을 파싱한다.
//     (도구 호출이 없으면 텍스트에서 JSON 을 best-effort 로 파싱하는 폴백)

import Anthropic from "@anthropic-ai/sdk";
import type { RfpDocument } from "@/lib/types";

const MODEL = "claude-opus-4-8";

export interface ExtractRfpInput {
  /** 텍스트 기반 문서 본문(txt/md/json/csv 또는 docx 추출본) */
  text?: string;
  /** PDF 원본 base64 (data 부분만, prefix 제외) */
  pdfBase64?: string;
  /** 원본 파일명 — rfp_id 생성 힌트 */
  filename?: string;
}

const EMIT_RFP_TOOL: Anthropic.Tool = {
  name: "emit_rfp",
  description:
    "추출한 RFP 를 RfpDocument 구조로 반환한다. 모든 필드는 원문 근거 기반으로 채우되, 원문에 없으면 합리적 기본값/빈값을 쓴다.",
  input_schema: {
    type: "object",
    properties: {
      rfp_id: { type: "string", description: "RFP 식별자. 원문에 없으면 파일명/제목 기반으로 생성(예: RFP-2026-XXX-001)" },
      client_name: { type: "string", description: "발주 고객사명" },
      brand_name: { type: "string", description: "행사 브랜드명(고객사와 다를 수 있음)" },
      industry: {
        type: "string",
        enum: ["패션", "뷰티", "F&B", "캐릭터", "리빙", "엔터", "기타"],
        description: "브랜드 산업군",
      },
      project_title: { type: "string", description: "프로젝트/행사 제목" },
      objective: { type: "string", description: "행사 목적·목표(원문 요약)" },
      target_audience: { type: "string", description: "요구된 타깃 관객" },
      period_start: { type: "string", description: "희망 시작일 ISO(YYYY-MM-DD). 미상이면 빈 문자열" },
      period_end: { type: "string", description: "희망 종료일 ISO. 미상이면 빈 문자열" },
      venue_area: { type: "string", description: "희망 지역/장소. 미상이면 빈 문자열" },
      venue_size_pyeong: { type: "number", description: "희망 규모(평). 미상이면 0" },
      venue_type: { type: "string", description: "공간 유형(예: 독립 공간, 몰 내). 미상이면 빈 문자열" },
      budget_min: { type: "number", description: "예산 하한(원). 미상이면 0" },
      budget_max: { type: "number", description: "예산 상한(원). 미상이면 0" },
      scope_requirement: {
        type: "array",
        items: { type: "string", enum: ["기획", "운영", "제작"] },
        description: "요구 업무 범위",
      },
      mandatory_requirements: {
        type: "array",
        items: { type: "string" },
        description: "필수 요건 목록",
      },
      evaluation_criteria: {
        type: "array",
        items: { type: "string" },
        description: "평가 기준(있으면)",
      },
      submission_deadline: { type: "string", description: "제출 마감 ISO. 없으면 빈 문자열" },
      contract_method: {
        type: "string",
        enum: ["수의계약", "제안", "경쟁입찰", "비딩", "기타"],
        description: "계약 방식(수의계약/제안=단독, 경쟁입찰/비딩=경쟁). 미상이면 기타",
      },
      period_options: {
        type: "array",
        description: "기간 우선순위(1순위/2순위 등). 하나면 1개만",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "예: 1순위, 2순위(대안)" },
            start: { type: "string", description: "ISO YYYY-MM-DD" },
            end: { type: "string", description: "ISO YYYY-MM-DD" },
            priority: { type: "number", description: "1=1순위" },
          },
        },
      },
      narrative_parts: {
        type: "array",
        description: "RFP 가 제시한 전시/캠페인 서사 파트(예: 5개 파트). 제안 컨셉의 척추 — 반드시 원문대로 추출",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "파트명(예: 평범한 오늘)" },
            description: { type: "string", description: "파트 설명(있으면)" },
          },
        },
      },
      required_quote_sections: {
        type: "array",
        description: "RFP 가 요구한 의무 견적 비용 골격(카테고리 + 세부 항목). 견적서가 이 구조에 맞춰야 함",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "비용 카테고리명" },
            items: { type: "array", items: { type: "string" }, description: "세부 비용 항목" },
          },
        },
      },
      deliverables: {
        type: "array",
        items: { type: "string" },
        description: "납품 산출물(도면/시공백서, 디자인 원본, 영상 원본, 디지털 아카이빙, KPI 보고서 등)",
      },
      terms: {
        type: "array",
        items: { type: "string" },
        description: "유의사항·권리귀속·계약 조건(IP 귀속, 자료 미반환, 총액 일체포함, 평가 미공개 등). 리스크 검토용",
      },
      raw_text_full: {
        type: "string",
        description: "문서 전체 본문을 가능한 한 그대로 옮긴 텍스트(특히 PDF). schema-on-read 보존용 — 누락 없이",
      },
      // ── 분석 레이어(판단) — 추출과 함께 영업기획 관점으로 평가 ──
      fit_score: {
        type: "number",
        description: "자사 적합도 0~100(우리 강점·레퍼런스 대비 이 건을 딸 만한가). 단서 없으면 보수적 추정.",
      },
      fit_rationale: { type: "string", description: "적합도 근거 1~2문장." },
      evaluation_weights: {
        type: "array",
        description: "평가기준별 배점(%). 원문에 배점 있으면 그대로, 없으면 추정.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "평가 항목명" },
            weight: { type: "number", description: "배점(%)" },
          },
        },
      },
      risks: {
        type: "array",
        description: "수주·수행 리스크 + 대응(terms 의 판단판).",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "리스크" },
            mitigation: { type: "string", description: "대응 방안" },
          },
        },
      },
      win_themes: {
        type: "array",
        items: { type: "string" },
        description: "수주 전략 포인트(왜 우리가 이겨야 하는가).",
      },
    },
    required: [
      "client_name",
      "brand_name",
      "industry",
      "project_title",
      "objective",
      "scope_requirement",
    ],
  },
};

const SYSTEM = `당신은 BTL 팝업 에이전시의 영업기획 담당이다. 업로드된 RFP(제안요청서) 문서를 읽고
핵심 정보를 추출해 emit_rfp 도구로 구조화한다.

규칙:
- 반드시 emit_rfp 도구를 호출한다(자유 서술 금지).
- 원문에 명시된 내용을 우선한다. 추정이 필요하면 보수적으로 채우고, 정말 단서가 없으면 빈 값/0 을 쓴다.
- 한국어로 채운다.
- objective 는 2~4문장으로 요약한다.
- scope_requirement 는 기획/운영/제작 중 해당하는 것만 배열로.
- 추출에 더해 영업기획 판단도 채운다: fit_score(적합도)·fit_rationale·evaluation_weights(배점)·
  risks(리스크+대응)·win_themes(수주전략). 원문 근거 우선, 없으면 보수적 추정.`;

interface EmitRfpArgs {
  rfp_id?: string;
  client_name: string;
  brand_name: string;
  industry: string;
  project_title: string;
  objective: string;
  target_audience?: string;
  period_start?: string;
  period_end?: string;
  venue_area?: string;
  venue_size_pyeong?: number;
  venue_type?: string;
  budget_min?: number;
  budget_max?: number;
  scope_requirement?: string[];
  mandatory_requirements?: string[];
  evaluation_criteria?: string[];
  submission_deadline?: string;
  contract_method?: string;
  period_options?: { label?: string; start?: string; end?: string; priority?: number }[];
  narrative_parts?: { name?: string; description?: string }[];
  required_quote_sections?: { name?: string; items?: string[] }[];
  deliverables?: string[];
  terms?: string[];
  fit_score?: number;
  fit_rationale?: string;
  evaluation_weights?: { label?: string; weight?: number }[];
  risks?: { label?: string; mitigation?: string }[];
  win_themes?: string[];
  raw_text_full?: string;
}

function slugId(filename?: string): string {
  const base = (filename ?? "").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").toUpperCase().slice(0, 16);
  return `RFP-UPLOAD-${base || "DOC"}`;
}

function toRfpDocument(args: EmitRfpArgs, rawText: string, filename?: string): RfpDocument {
  const scope = (args.scope_requirement ?? []).filter(
    (s): s is RfpDocument["scope_requirement"][number] => s === "기획" || s === "운영" || s === "제작",
  );
  const budget =
    (args.budget_min ?? 0) > 0 || (args.budget_max ?? 0) > 0
      ? { min: args.budget_min || undefined, max: args.budget_max || undefined, currency: "KRW" }
      : null;

  const CONTRACT_METHODS: RfpDocument["contract_method"][] = [
    "수의계약", "제안", "경쟁입찰", "비딩", "기타",
  ];
  const contract_method = CONTRACT_METHODS.includes(
    args.contract_method as RfpDocument["contract_method"],
  )
    ? (args.contract_method as RfpDocument["contract_method"])
    : undefined;

  const period_options = (args.period_options ?? [])
    .filter((p) => p.start || p.end)
    .map((p, i) => ({
      label: p.label || `${i + 1}순위`,
      start: p.start ?? "",
      end: p.end ?? "",
      priority: p.priority ?? i + 1,
    }));

  const narrative_parts = (args.narrative_parts ?? [])
    .filter((n) => n.name)
    .map((n) => ({ name: n.name!, description: n.description || undefined }));

  const required_quote_sections = (args.required_quote_sections ?? [])
    .filter((s) => s.name)
    .map((s) => ({ name: s.name!, items: (s.items ?? []).filter(Boolean) }));

  // PDF 는 input.text 가 없어 rawText 가 placeholder 였다 — Claude 가 옮긴 raw_text_full 우선.
  const preservedRaw =
    args.raw_text_full && args.raw_text_full.trim().length > 0
      ? args.raw_text_full
      : rawText;

  return {
    rfp_id: args.rfp_id?.trim() || slugId(filename),
    received_at: new Date().toISOString(),
    client_brand: {
      client_name: args.client_name,
      brand_name: args.brand_name,
      industry: args.industry as RfpDocument["client_brand"]["industry"],
    },
    project_title: args.project_title,
    objective: args.objective,
    target_audience: args.target_audience ?? "",
    period:
      period_options.length > 0
        ? { start: period_options[0].start, end: period_options[0].end }
        : { start: args.period_start ?? "", end: args.period_end ?? "" },
    venue_requirement: {
      area: args.venue_area || undefined,
      size_pyeong: args.venue_size_pyeong || undefined,
      type: args.venue_type || undefined,
    },
    budget_range: budget,
    scope_requirement: scope.length > 0 ? scope : ["기획"],
    mandatory_requirements: args.mandatory_requirements ?? [],
    evaluation_criteria: args.evaluation_criteria ?? [],
    submission_deadline: args.submission_deadline || undefined,
    raw_text: preservedRaw.slice(0, 40000),
    contract_method,
    period_options: period_options.length > 0 ? period_options : undefined,
    narrative_parts: narrative_parts.length > 0 ? narrative_parts : undefined,
    required_quote_sections:
      required_quote_sections.length > 0 ? required_quote_sections : undefined,
    deliverables: (args.deliverables ?? []).filter(Boolean).length > 0
      ? args.deliverables!.filter(Boolean)
      : undefined,
    terms: (args.terms ?? []).filter(Boolean).length > 0
      ? args.terms!.filter(Boolean)
      : undefined,
    // 분석 레이어
    fit_score: typeof args.fit_score === "number" ? Math.max(0, Math.min(100, Math.round(args.fit_score))) : undefined,
    fit_rationale: args.fit_rationale || undefined,
    evaluation_weights: (args.evaluation_weights ?? [])
      .filter((w) => w.label)
      .map((w) => ({ label: w.label!, weight: Number(w.weight) || 0 })),
    risks: (args.risks ?? [])
      .filter((r) => r.label)
      .map((r) => ({ label: r.label!, mitigation: r.mitigation || "" })),
    win_themes: (args.win_themes ?? []).filter(Boolean),
  };
}

/** 업로드된 RFP 문서를 RfpDocument 로 추출한다. */
export async function extractRfpFromDocument(
  input: ExtractRfpInput,
  apiKey: string,
): Promise<RfpDocument> {
  if (!input.text && !input.pdfBase64) {
    throw new Error("추출할 문서 내용이 없습니다(text 또는 pdfBase64 필요).");
  }

  const client = new Anthropic({ apiKey });

  const content: Anthropic.ContentBlockParam[] = [];
  if (input.pdfBase64) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 },
    });
  }
  if (input.text) {
    content.push({ type: "text", text: `다음은 RFP 문서 본문이다:\n\n${input.text.slice(0, 60000)}` });
  }
  content.push({
    type: "text",
    text: "이 RFP 를 emit_rfp 도구로 구조화해 반환하라.",
  });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    tools: [EMIT_RFP_TOOL],
    messages: [{ role: "user", content }],
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "emit_rfp",
  );
  if (!toolUse) {
    throw new Error("RFP 추출 실패 — 모델이 구조화된 결과를 반환하지 않았습니다. 다른 파일로 다시 시도하세요.");
  }

  const rawText = input.text ?? "(PDF 원본 — 본문 텍스트 미보존)";
  return toRfpDocument(toolUse.input as EmitRfpArgs, rawText, input.filename);
}
