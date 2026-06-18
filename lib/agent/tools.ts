// octopus 에이전트 도구 정의 + 실행기
// 도구 스키마는 Anthropic.Tool 형태로 정의하고, 실행 결과는 모델에게 돌려줄 문자열로 반환한다.
// 아티팩트/승인/발송 등 부수효과는 ToolContext.onEvent 로 SSE 스트림에 흘려보낸다.

import type Anthropic from "@anthropic-ai/sdk";
import type {
  AgentEvent,
  AttributionReport,
  Bid,
  BidLineItem,
  ColdEmail,
  ContentAttribution,
  ContentCalendar,
  ContentPerformanceReport,
  CopyCritiqueReport,
  CopyIssue,
  CrmLead,
  EmailSequencePlan,
  EmailSequenceStep,
  FollowerGrowthReport,
  FunnelReport,
  FunnelStage,
  GeneratedVisual,
  InstagramPublishDraft,
  InstagramPublishResult,
  KeywordJourneyNode,
  KeywordJourneyReport,
  KeywordReport,
  KeywordRow,
  LeadJourneyReport,
  LeadSession,
  MorningBriefing,
  InstagramPost,
  OnImageText,
  ReelPlan,
  NewsletterDraft,
  NewsletterPerformanceReport,
  NewsletterPerformanceRow,
  NewsletterSection,
  NewsletterSegmentRecommendation,
  OperationPlan,
  PostPerformance,
  Proposal,
  RfpAnalysis,
  ScenarioPack,
  SubjectLabReport,
  SubjectScoreRow,
  SubjectVariant,
  TrackingAuditReport,
  TrackingGap,
  VisualSet,
} from "@/lib/types";
import { getSetting } from "@/lib/runtime-settings";
import { generateViaHiggsfield, generateVideoViaHiggsfield } from "./higgsfield";
import { saveImageLocally, saveBufferLocally } from "./save-image";
import { renderCard } from "./card-render";
import { uploadPublic } from "./upload";
import {
  COLD_OPENER_ANTIPATTERNS,
  NEWSLETTER_OPENRATE_BENCHMARK,
  PREHEADER_MAX,
  PREHEADER_MIN,
  SPAM_TERMS,
  SUBJECT_MOBILE_MAX,
  estimateReadSeconds,
  projectOpenScore,
  scanTone,
  scoreSubject,
} from "./copy-rules";
import { createApproval, createInstagramApproval } from "./approvals";
import {
  fetchInstagramInsights,
  fetchSearchConsole,
  publishInstagramMedia,
  publishInstagramCarousel,
  queryGaBigQuery,
  renderSiteDom,
} from "./connectors";
import { sendColdEmail } from "./email";
import { aspectFor, buildHiggsfieldPrompt, type VisualFormat } from "./visual-prompt";

export interface ToolContext {
  scenario: ScenarioPack;
  onEvent: (e: AgentEvent) => void;
}

// 도구 실행 시작 시 피드에 표시할 한국어 라벨 (이모지 없이 텍스트만)
export const TOOL_LABELS: Record<string, string> = {
  publish_briefing: "아침 브리핑 발행 중",
  analyze_rfp: "RFP 분석 중",
  draft_proposal: "제안서 작성 중",
  build_bid: "비딩 견적 산출 중",
  plan_operations: "운영안 수립 중",
  generate_visual: "콘텐츠 비주얼 생성 중",
  draft_instagram_with_visuals: "인스타 콘텐츠+비주얼 생성 중",
  draft_instagram_posts: "인스타그램 콘텐츠 작성 중",
  publish_instagram_post: "인스타그램 발행 승인 요청 중",
  draft_newsletter: "뉴스레터 초안 작성 중",
  propose_cold_emails: "콜드메일 발송 승인 요청 중",
  show_metrics: "성과 지표 불러오는 중",
  list_outbound_contacts: "아웃바운드 타겟 탐색 중",
  read_crm: "CRM 리드 조회 중",
  analyze_keywords: "키워드 포트폴리오 분석 중",
  analyze_funnel: "전환 퍼널 분석 중",
  track_content_performance: "콘텐츠 D+1/D+7 성과 추적 중",
  schedule_follow_ups: "팔로업 대상 산출 중",
  plan_content_calendar: "콘텐츠 캘린더 작성 중",
  monitor_competitors: "경쟁·멘션 모니터링 중",
  analyze_lead_journey: "리드 여정 패턴 분석 중",
  analyze_keyword_journey: "키워드 탐색 경로 분석 중",
  analyze_content_attribution: "콘텐츠 기여도 분석 중",
  track_follower_growth: "채널 성장 추이 집계 중",
  query_ga_bigquery: "GA4 BigQuery 조회 중",
  fetch_search_console: "Search Console 성과 조회 중",
  fetch_instagram_insights: "인스타그램 인사이트 조회 중",
  audit_tracking_setup: "사이트 추적 설정 감사 중",
  optimize_subject_lines: "제목 A/B 후보 생성 중",
  critique_copy: "카피 자체 점검 중",
  plan_email_sequence: "이메일 시퀀스 설계 중",
  analyze_newsletter_performance: "뉴스레터 발송 성과 분석 중",
};

// 도구 실행 완료 시 피드에 표시할 한국어 요약
export const TOOL_END_SUMMARIES: Record<string, string> = {
  publish_briefing: "아침 브리핑을 아티팩트 패널에 게시했습니다",
  analyze_rfp: "RFP 분석을 아티팩트 패널에 표시했습니다",
  draft_proposal: "제안서 초안을 아티팩트 패널에 표시했습니다",
  build_bid: "비딩 견적을 아티팩트 패널에 표시했습니다",
  plan_operations: "운영안을 아티팩트 패널에 표시했습니다",
  generate_visual: "콘텐츠 비주얼을 아티팩트 패널에 표시했습니다",
  draft_instagram_with_visuals: "인스타 콘텐츠+비주얼을 폰 목업에 게시했습니다",
  draft_instagram_posts: "인스타그램 초안을 폰 목업에 게시했습니다",
  publish_instagram_post: "인스타그램 발행 승인 플로우가 완료되었습니다",
  draft_newsletter: "뉴스레터 초안을 아티팩트 패널에 게시했습니다",
  propose_cold_emails: "콜드메일 승인 플로우가 완료되었습니다",
  show_metrics: "성과 대시보드를 표시했습니다",
  list_outbound_contacts: "아웃바운드 연락처를 로드했습니다",
  read_crm: "CRM 리드 현황을 로드했습니다",
  analyze_keywords: "키워드 기회 리포트를 아티팩트 패널에 표시했습니다",
  analyze_funnel: "전환 퍼널 리포트를 아티팩트 패널에 표시했습니다",
  track_content_performance: "콘텐츠 성과 리포트를 아티팩트 패널에 표시했습니다",
  schedule_follow_ups: "팔로업 큐를 로드했습니다",
  plan_content_calendar: "주간 콘텐츠 캘린더를 아티팩트 패널에 게시했습니다",
  monitor_competitors: "경쟁 인텔 피드를 로드했습니다",
  analyze_lead_journey: "리드 여정 리포트를 아티팩트 패널에 표시했습니다",
  analyze_keyword_journey: "키워드 탐색 경로 리포트를 아티팩트 패널에 표시했습니다",
  analyze_content_attribution: "콘텐츠 기여 리포트를 아티팩트 패널에 표시했습니다",
  track_follower_growth: "채널 성장 리포트를 아티팩트 패널에 표시했습니다",
  query_ga_bigquery: "GA4 BigQuery 조회를 완료했습니다",
  fetch_search_console: "Search Console 데이터를 로드했습니다",
  fetch_instagram_insights: "인스타그램 인사이트를 로드했습니다",
  audit_tracking_setup: "추적 감사 리포트를 아티팩트 패널에 표시했습니다",
  optimize_subject_lines: "제목 스코어링 표를 아티팩트 패널에 표시했습니다",
  critique_copy: "카피 점검 리포트를 아티팩트 패널에 표시했습니다",
  plan_email_sequence: "이메일 시퀀스를 아티팩트 패널에 표시했습니다",
  analyze_newsletter_performance: "뉴스레터 성과 리포트를 아티팩트 패널에 표시했습니다",
};

// ── 비주얼 생성 보조(Higgsfield) ─────────────────────────────────────────
// 미연결/실패 시 목업 비주얼 — 오프라인 안전한 SVG data-URI(프롬프트 라벨 표기).
function mockVisual(prompt: string, aspect: string): string {
  const { w, h } =
    aspect === "9:16"
      ? { w: 720, h: 1280 }
      : aspect === "16:9"
        ? { w: 1280, h: 720 }
        : aspect === "4:5"
          ? { w: 1080, h: 1350 }
          : { w: 1000, h: 1000 };
  const short = prompt.length > 48 ? `${prompt.slice(0, 47)}…` : prompt;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2a2e"/><stop offset="1" stop-color="#0f0f12"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<text x="50%" y="46%" fill="#d9472a" font-family="sans-serif" font-size="${Math.round(w * 0.06)}" font-weight="700" text-anchor="middle">AI 비주얼 · 목업</text>` +
    `<text x="50%" y="54%" fill="#9a9a9a" font-family="sans-serif" font-size="${Math.round(w * 0.032)}" text-anchor="middle">${esc(short)}</text>` +
    `<text x="50%" y="92%" fill="#6a6a6a" font-family="sans-serif" font-size="${Math.round(w * 0.026)}" text-anchor="middle">Higgsfield 미연결 — 설정에서 키 입력 시 실제 생성</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function buildTools(): Anthropic.Tool[] {
  return [
    {
      name: "publish_briefing",
      description:
        "아침 전략 브리핑을 우측 아티팩트 패널에 발행한다. 사용자가 아침 브리핑, 오늘의 트렌드, 전략 보고를 요청하거나 하루 업무를 시작하자고 할 때 호출하라. 항목 3~5개와 콘텐츠 소재로 이어지는 '오늘의 픽' 1개를 포함할 것. " +
        "각 항목 source 에는 monitor_competitors 로 조회한 실제 피드의 출처·날짜를 인용하고 근거 없는 항목을 지어내지 않는다. " +
        "성과 지표나 단계별 전환 분석은 반환하지 않는다(그건 show_metrics·analyze_funnel). 이 도구는 텍스트 브리핑만 발행하며 발송은 하지 않는다.",
      input_schema: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO 날짜 (예: 2026-06-11)" },
          items: {
            type: "array",
            description: "브리핑 항목 3~5개",
            items: {
              type: "object",
              properties: {
                headline: { type: "string", description: "헤드라인 한 줄" },
                summary: { type: "string", description: "2~3문장 요약" },
                source: { type: "string", description: "출처 설명 또는 URL" },
                recommendedAction: {
                  type: "string",
                  description: "그래서 오늘 뭘 할지 — 실행 가능한 액션 한 줄",
                },
              },
              required: ["headline", "summary", "source", "recommendedAction"],
            },
          },
          todaysPick: {
            type: "string",
            description: "오늘의 추천 액션 1개 — 콘텐츠 소재로 연결되는 항목",
          },
        },
        required: ["date", "items", "todaysPick"],
      },
      input_examples: [
        {
          date: "2026-06-11",
          items: [
            { headline: "성수동 팝업 트래픽이 주말에 집중된다", summary: "최근 멘션 피드에서 성수동 방문 관련 게시물이 금~일에 몰렸다. 주말 시향 슬롯 노출을 늘릴 시점이다.", source: "instagram 멘션 피드 (2026-06-09)", recommendedAction: "주말 시향 잔여석을 강조한 스토리 1건 예약" },
            { headline: "경쟁 캔들 브랜드가 공방 체험을 띄운다", summary: "인근 브랜드가 캔들 공방 체험 콘텐츠로 저장 수를 늘렸다. 우리는 '핸드포어드 과정' 각도로 차별화 가능.", source: "naver_blog 멘션 (2026-06-08)", recommendedAction: "작업실 25분 포어링 릴스 컨셉 확정" },
            { headline: "'시향 예약' 검색이 미노출 상태", summary: "핵심 전환 키워드인 시향 예약이 아직 순위에 없다. 예약 안내 글의 검색 최적화가 필요하다.", source: "analyze_keywords 리포트", recommendedAction: "시향 예약 안내 글 제목·본문 키워드 보강" },
          ],
          todaysPick: "작업실 25분 포어링 릴스 — 시향 예약 CTA 로 연결",
        },
        {
          date: "2026-06-11",
          items: [
            { headline: "리브랜딩 신규 라인 반응이 30대에서 올라온다", summary: "무광 그릇 게시물이 30대 신규 유입에서 저장이 늘었다. 확장 타겟 공략을 이어갈 근거.", source: "instagram 멘션 피드 (2026-06-10)", recommendedAction: "1인 플레이팅 캐러셀 1건 기획" },
            { headline: "단골층 이탈 신호 없음 — 유지 콘텐츠 병행 필요", summary: "기존 40-50대 단골 채널 반응은 안정적이나 리브랜딩 소외감 방지용 메시지가 필요하다.", source: "read_crm 단골 세그먼트", recommendedAction: "단골 대상 '변하지 않는 것' 메시지 1건" },
          ],
          todaysPick: "1인 플레이팅 캐러셀 — 그릇 맛집 키워드로 연결",
        },
      ],
    },
    {
      name: "analyze_rfp",
      description:
        "들어온 RFP(제안요청서)를 구조화 분석해 우측 보드에 'RFP 분석' 산출물로 표시한다. 사용자가 RFP 분석/검토/입찰 검토를 요청하면 호출하라. " +
        "사용자가 RFP 본문을 붙여넣었으면 그 내용을, 없으면 시나리오 지침의 샘플 RFP를 분석한다. " +
        "핵심 요건(우선순위), 평가 기준과 배점(합 100 권장), 자사 적합도(0~100)와 근거, 리스크와 대응, 수주 전략 포인트를 채운다. 근거 없는 수치는 지어내지 않는다. " +
        "제안서 작성(draft_proposal)·견적(build_bid)은 별도 도구다 — 이 도구는 분석만 한다.",
      input_schema: {
        type: "object",
        properties: {
          client: { type: "string", description: "발주처/브랜드" },
          title: { type: "string", description: "팝업/사업명" },
          summary: { type: "string", description: "한 줄 요약" },
          period: { type: "string", description: "운영 기간 (예: 2026-08-01 ~ 08-31, 4주)" },
          venue: { type: "string", description: "장소·규모 (예: 성수동 1F, 약 60평)" },
          budget: { type: "string", description: "예산 범위 (예: 1.2억 ~ 1.5억)" },
          requirements: {
            type: "array",
            description: "핵심 요건",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                detail: { type: "string" },
                priority: { type: "string", enum: ["must", "should", "nice"] },
              },
              required: ["label", "detail", "priority"],
            },
          },
          evalCriteria: {
            type: "array",
            description: "평가 기준 + 배점(%) — 합 100 권장",
            items: {
              type: "object",
              properties: { label: { type: "string" }, weight: { type: "number" } },
              required: ["label", "weight"],
            },
          },
          fitScore: { type: "number", description: "자사 적합도 0~100" },
          fitRationale: { type: "string", description: "적합도 근거 한두 문장" },
          risks: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, mitigation: { type: "string" } },
              required: ["label", "mitigation"],
            },
          },
          winThemes: { type: "array", items: { type: "string" }, description: "수주 전략 포인트 2~4개" },
        },
        required: [
          "client", "title", "summary", "period", "venue", "budget",
          "requirements", "evalCriteria", "fitScore", "fitRationale", "risks", "winThemes",
        ],
      },
    },
    {
      name: "draft_proposal",
      description:
        "팝업 스토어 제안서 초안을 우측 보드에 '제안서' 산출물로 작성한다. 사용자가 제안서 작성/기획안을 요청하거나 RFP 분석 후 제안 단계로 넘어갈 때 호출하라. " +
        "가능하면 먼저 analyze_rfp 로 요건·평가기준을 확인하고, 제안서가 그 평가기준을 직접 겨냥하도록 구성한다. " +
        "컨셉, 타깃 세그먼트, 공간 구성(존), 방문 동선(순서), 일정, 목표 KPI, 예산 개요, 차별점을 채운다. 정밀 견적은 build_bid 가 담당한다.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "제안 팝업명" },
          client: { type: "string" },
          concept: { type: "string", description: "컨셉 한 단락" },
          targetSegments: { type: "array", items: { type: "string" } },
          zones: {
            type: "array",
            description: "공간 구성(존)",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                purpose: { type: "string" },
                experience: { type: "string" },
              },
              required: ["name", "purpose", "experience"],
            },
          },
          journey: { type: "array", items: { type: "string" }, description: "방문 동선 단계(순서)" },
          schedule: {
            type: "array",
            items: {
              type: "object",
              properties: { phase: { type: "string" }, period: { type: "string" } },
              required: ["phase", "period"],
            },
          },
          kpis: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, target: { type: "string" } },
              required: ["label", "target"],
            },
          },
          budgetOutline: {
            type: "array",
            items: {
              type: "object",
              properties: { item: { type: "string" }, amount: { type: "string" } },
              required: ["item", "amount"],
            },
          },
          winThemes: { type: "array", items: { type: "string" }, description: "차별점 2~4개" },
        },
        required: [
          "title", "client", "concept", "targetSegments", "zones",
          "journey", "schedule", "kpis", "budgetOutline", "winThemes",
        ],
      },
    },
    {
      name: "build_bid",
      description:
        "비딩 견적을 우측 보드에 '비딩 견적' 산출물로 산출한다. 사용자가 견적/비딩/입찰가 산정을 요청하거나 제안 후 가격 단계로 넘어갈 때 호출하라. " +
        "카테고리별 항목과 금액(원)을 채우고 마진율(%)을 지정하면, 소계·총액은 도구가 계산한다(직접 계산해 넣지 말 것). 경쟁력 코멘트와 견적 전제를 함께 제시한다.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          client: { type: "string" },
          lineItems: {
            type: "array",
            description: "견적 항목",
            items: {
              type: "object",
              properties: {
                category: { type: "string", description: "카테고리 (예: 공간·시공, 운영, 마케팅)" },
                item: { type: "string" },
                qty: { type: "string", description: "수량/단위 (선택, 없으면 빈 문자열)" },
                amount: { type: "number", description: "금액(원)" },
                note: { type: "string", description: "비고 (선택, 없으면 빈 문자열)" },
              },
              required: ["category", "item", "qty", "amount", "note"],
            },
          },
          marginPct: { type: "number", description: "마진율(%)" },
          competitiveness: { type: "string", description: "가격 경쟁력 코멘트 한두 문장" },
          assumptions: { type: "array", items: { type: "string" }, description: "견적 전제 2~4개" },
        },
        required: ["title", "client", "lineItems", "marginPct", "competitiveness", "assumptions"],
      },
    },
    {
      name: "plan_operations",
      description:
        "팝업 현장 운영안을 우측 보드에 '운영안' 산출물로 수립한다. 사용자가 운영 계획/현장 운영/인력·동선·안전·일정을 요청하거나 제안·견적 후 운영 단계로 넘어갈 때 호출하라. " +
        "가능하면 먼저 analyze_rfp/draft_proposal 의 요건·공간·KPI 를 반영한다. " +
        "운영 시간·일 목표, 인력(역할/인원/시프트/업무), 동선·혼잡 관리(구역별 수용/대기), 안전(위험요소→통제→담당), 일정(준비~철수), 비상·우천·혼잡 대응을 채운다. 인력 수·동선 수용은 방문 목표에 근거한다.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          client: { type: "string" },
          summary: { type: "string", description: "운영 개요 한 줄" },
          hours: { type: "string", description: "운영 시간 (예: 목~일 11:00-20:00)" },
          dailyTarget: { type: "string", description: "일 운영 목표 (방문/전환 등)" },
          staffing: {
            type: "array",
            description: "인력 구성",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                count: { type: "number" },
                shift: { type: "string" },
                duty: { type: "string" },
              },
              required: ["role", "count", "shift", "duty"],
            },
          },
          flow: {
            type: "array",
            description: "동선·혼잡 관리 (구역별)",
            items: {
              type: "object",
              properties: {
                zone: { type: "string" },
                action: { type: "string" },
                capacity: { type: "string", description: "수용/대기 관리 (예: 동시 15명/대기 10분)" },
              },
              required: ["zone", "action", "capacity"],
            },
          },
          safety: {
            type: "array",
            description: "안전 (위험요소→통제→담당)",
            items: {
              type: "object",
              properties: {
                hazard: { type: "string" },
                control: { type: "string" },
                owner: { type: "string" },
              },
              required: ["hazard", "control", "owner"],
            },
          },
          schedule: {
            type: "array",
            description: "일정 (준비~철수)",
            items: {
              type: "object",
              properties: {
                phase: { type: "string" },
                period: { type: "string" },
                detail: { type: "string" },
              },
              required: ["phase", "period", "detail"],
            },
          },
          contingencies: { type: "array", items: { type: "string" }, description: "비상/우천/혼잡 대응 2~4개" },
        },
        required: [
          "title", "client", "summary", "hours", "dailyTarget",
          "staffing", "flow", "safety", "schedule", "contingencies",
        ],
      },
    },
    {
      name: "generate_visual",
      description:
        "Higgsfield 로 콘텐츠 비주얼(이미지/영상)을 생성해 우측 보드에 표시한다. 사용자가 키비주얼·포스터·콘텐츠 이미지·썸네일·영상 등 '실제 비주얼 생성'을 요청하거나, 인스타그램/제안서/팝업 키비주얼에 들어갈 이미지를 만들어 달라고 할 때 호출하라. " +
        "각 비주얼마다 영어 또는 한국어로 구체적인 생성 프롬프트(피사체·스타일·조명·구도)를 prompts 배열에 담는다(1~4개). aspect 는 용도에 맞게 1:1(피드)·9:16(스토리/릴스)·16:9(가로) 중 고른다. " +
        "draft_instagram_posts 는 캡션/기획 초안이고, 이 도구는 실제 비주얼 자체를 생성한다(역할이 다르다). Higgsfield 키가 없으면 목업으로 표시된다.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "이 비주얼 세트의 용도/제목" },
          brief: { type: "string", description: "연출·콘셉트 한 줄" },
          aspect: { type: "string", enum: ["1:1", "9:16", "16:9"], description: "비율" },
          prompts: {
            type: "array",
            description: "생성 프롬프트 1~4개 (피사체·스타일·조명·구도를 구체적으로)",
            items: { type: "string" },
          },
        },
        required: ["title", "brief", "aspect", "prompts"],
      },
      input_examples: [
        {
          title: "NOVA EAU 성수 팝업 키비주얼",
          brief: "시향 체험 중심 무드 — 따뜻한 텅스텐 조명의 미니멀 부티크",
          aspect: "1:1",
          prompts: [
            "minimal perfume boutique interior, warm tungsten lighting, glass bottles on a marble plinth, soft shadows, editorial photography, 50mm",
            "close-up of a perfume bottle with mist, dark moody background, cinematic product shot",
          ],
        },
      ],
    },
    {
      name: "draft_instagram_with_visuals",
      description:
        "인스타그램 콘텐츠(피드/캐러셀/릴스)를 캡션 + '실제 비주얼'까지 한 번에 만들어 폰 목업에 게시한다. 인스타 콘텐츠 요청의 기본 도구다(캡션만 빠르게 원하면 draft_instagram_posts). " +
        "각 게시물에 format(feed/carousel/reel)을 정하고, imageBrief 에는 영어로 구체적 장면·스타일·조명·구도(=이미지 생성 프롬프트의 핵심)를 쓴다. " +
        "onImageText 에는 이미지 위에 새길 한국어 카피(headline·sub·badge)를 넣어 '실제 게시물처럼 비주얼에 글자가 박히게' 한다. " +
        "carousel 이면 slides[](슬라이드별 imageBrief/onImageText), reel 이면 reel(hook·scenes·audioSuggestion·cta·durationSec)을 채운다. " +
        "비율은 형식이 정한다(feed/carousel 4:5, reel 9:16). Higgsfield 미연결이면 비주얼은 목업 플레이스홀더로 표시된다. 발송/예약·발행은 하지 않는다(실제 발행은 publish_instagram_post 승인 게이트).",
      input_schema: {
        type: "object",
        properties: {
          posts: {
            type: "array",
            description: "게시물 목록 (2~3개 권장 — 이미지 생성은 시간이 걸린다)",
            items: {
              type: "object",
              properties: {
                concept: { type: "string", description: "게시물 기획 의도 한 줄" },
                caption: { type: "string", description: "본문 캡션(게시물 글)" },
                hashtags: { type: "array", items: { type: "string" }, description: "'#' 제외 태그" },
                suggestedPostTime: { type: "string", description: "추천 게시 시각" },
                format: { type: "string", enum: ["feed", "carousel", "reel"], description: "게시물 형식 (기본 feed)" },
                imageBrief: { type: "string", description: "커버 비주얼 생성 프롬프트 — 영어로 피사체·스타일·조명·구도 구체적으로" },
                onImageText: {
                  type: "object",
                  description: "이미지 위에 새길 한국어 카피 (실제 게시물 느낌)",
                  properties: {
                    headline: { type: "string", description: "비주얼에 크게 들어갈 핵심 카피" },
                    sub: { type: "string", description: "보조 카피(작게)" },
                    badge: { type: "string", description: "코너 뱃지 (예: D-3, 신메뉴, 한정)" },
                  },
                  required: ["headline"],
                },
                slides: {
                  type: "array",
                  description: "캐러셀 슬라이드(format=carousel 일 때, 2~4장)",
                  items: {
                    type: "object",
                    properties: {
                      imageBrief: { type: "string", description: "이 슬라이드 비주얼 프롬프트(영어)" },
                      onImageText: {
                        type: "object",
                        properties: {
                          headline: { type: "string" },
                          sub: { type: "string" },
                          badge: { type: "string" },
                        },
                        required: ["headline"],
                      },
                    },
                    required: ["imageBrief"],
                  },
                },
                reel: {
                  type: "object",
                  description: "릴스 기획(format=reel 일 때) — 9:16 커버와 함께 제시",
                  properties: {
                    hook: { type: "string", description: "0~3초 후킹 멘트" },
                    scenes: {
                      type: "array",
                      description: "장면별 샷 리스트",
                      items: {
                        type: "object",
                        properties: {
                          timecode: { type: "string", description: "예: 0:00–0:03" },
                          visual: { type: "string", description: "이 장면 화면" },
                          onScreenText: { type: "string", description: "이 장면 자막" },
                        },
                        required: ["timecode", "visual"],
                      },
                    },
                    audioSuggestion: { type: "string", description: "추천 오디오/BGM 무드" },
                    cta: { type: "string", description: "마지막 행동 유도" },
                    durationSec: { type: "number", description: "목표 길이(초)" },
                  },
                  required: ["hook", "scenes", "audioSuggestion", "cta", "durationSec"],
                },
              },
              required: ["concept", "caption", "hashtags", "imageBrief", "suggestedPostTime"],
            },
          },
        },
        required: ["posts"],
      },
    },
    {
      name: "publish_instagram_post",
      description:
        "생성한 인스타그램 게시물을 '실제로' 발행한다 — 단, 반드시 사람의 승인 버튼을 거친다(human-in-the-loop). 콜드메일과 동일하게 승인 없이는 절대 발행되지 않는다. " +
        "draft_instagram_with_visuals 로 만든 게시물의 공개 이미지 URL(imageUrl, http(s) — 로컬 경로 아님)과 캡션을 넘긴다. " +
        "사용자가 '이거 올려/발행/게시해줘'라고 명시할 때만 호출하라. 이미지가 목업(data-URI)이거나 토큰 미설정이면 mock 발행으로 처리하고 그 사실을 알린다. " +
        "피드 단일=mediaType IMAGE+imageUrl, 캐러셀(여러 장)=mediaType CAROUSEL+imageUrls(슬라이드 공개 URL 2~10장), 릴스=mediaType REELS+videoUrl(reelVideoUrl). " +
        "캐러셀이면 draft_instagram_with_visuals 가 만든 슬라이드들의 공개 URL 을 imageUrls 에 순서대로 넘긴다.",
      input_schema: {
        type: "object",
        properties: {
          caption: { type: "string", description: "발행 본문 캡션" },
          hashtags: { type: "array", items: { type: "string" }, description: "'#' 제외 태그(캡션 끝에 붙는다)" },
          imageUrl: { type: "string", description: "피드 단일 발행/릴스 커버의 공개 http(s) URL" },
          imageUrls: { type: "array", items: { type: "string" }, description: "캐러셀 슬라이드 공개 URL 들(2~10장, 순서대로) — mediaType=CAROUSEL 일 때" },
          videoUrl: { type: "string", description: "릴스 발행용 공개 mp4 URL (mediaType=REELS 일 때, reelVideoUrl)" },
          mediaType: { type: "string", enum: ["IMAGE", "CAROUSEL", "REELS"], description: "기본 IMAGE. 여러 장이면 CAROUSEL, 영상이면 REELS" },
          concept: { type: "string", description: "기획 의도(승인 카드 표시용)" },
        },
        required: ["caption"],
      },
    },
    {
      name: "draft_instagram_posts",
      description:
        "인스타그램 게시물 초안을 우측 아티팩트 패널(폰 목업)에 게시한다. 사용자가 인스타그램/SNS 콘텐츠, 피드 게시물, 릴스 기획을 요청하면 호출하라. 보통 2~3개의 게시물을 한 번에 제안한다. " +
        "새 초안 전에 track_content_performance 로 상위 포맷을 확인해 1번 게시물에 반영하라. " +
        "이메일·뉴스레터 카피는 반환하지 않는다(그건 draft_newsletter). 발송/예약 게시는 하지 않으며 캡션 초안만 만든다.",
      input_schema: {
        type: "object",
        properties: {
          posts: {
            type: "array",
            description: "인스타그램 게시물 초안 목록 (2~3개 권장)",
            items: {
              type: "object",
              properties: {
                concept: { type: "string", description: "게시물 기획 의도 한 줄" },
                caption: { type: "string", description: "본문 캡션 (이모지 포함 가능)" },
                hashtags: {
                  type: "array",
                  items: { type: "string" },
                  description: "'#' 제외한 해시태그 문자열 목록",
                },
                imageBrief: {
                  type: "string",
                  description: "이미지 연출 브리프 (디자이너/AI 이미지 생성용)",
                },
                suggestedPostTime: {
                  type: "string",
                  description: "추천 게시 시각 (예: 수요일 19:00)",
                },
              },
              required: [
                "concept",
                "caption",
                "hashtags",
                "imageBrief",
                "suggestedPostTime",
              ],
            },
          },
        },
        required: ["posts"],
      },
      input_examples: [
        {
          posts: [
            {
              concept: "작업실 25분 포어링 과정 릴스 (직전 상위 저장 포맷 반영)",
              caption: "한 배치가 부어지는 25분. 달이 뜨는 시간을 손으로 담습니다.",
              hashtags: ["성수동팝업", "핸드포어드캔들", "소이캔들", "달무드"],
              imageBrief: "저조도 작업실, 캔들 왁스가 몰드에 부어지는 클로즈업 슬로모션",
              suggestedPostTime: "수요일 19:00",
            },
            {
              concept: "시향 예약 안내 캐러셀",
              caption: "직접 맡아보면 다릅니다. 문라이트 시향 세션, 주말 예약 오픈.",
              hashtags: ["시향예약", "성수데이트", "캔들공방체험"],
              imageBrief: "팝업 시향 테이블에 정렬된 캔들 3종, 따뜻한 텅스텐 조명",
              suggestedPostTime: "금요일 12:00",
            },
          ],
        },
        {
          posts: [
            {
              concept: "1인 플레이팅 캐러셀 (30대 확장 타겟)",
              caption: "혼밥도 한 끼다. 무광 그릇 한 점으로 달라지는 식탁.",
              hashtags: ["그릇맛집", "혼밥플레이팅", "무광그릇", "온그릇"],
              imageBrief: "자연광 식탁, 1인 무광 그릇에 담긴 집밥 오버헤드 컷",
              suggestedPostTime: "일요일 11:00",
            },
            {
              concept: "단골 대상 '변하지 않는 것' 리브랜딩 메시지",
              caption: "로고는 바뀌었지만 가마 앞 손길은 그대로입니다.",
              hashtags: ["수제도자기그릇", "온그릇", "리브랜딩"],
              imageBrief: "물레 위 손, 유약 발색이 다른 그릇 라인업 정물",
              suggestedPostTime: "화요일 20:00",
            },
          ],
        },
      ],
    },
    {
      name: "draft_newsletter",
      description:
        "옵트인 구독자에게 보낼 정기 뉴스레터 초안을 우측 아티팩트 패널에 게시한다. 사용자가 뉴스레터·이메일 매거진·구독자 메일을 요청하면 호출하라. " +
        "단발 콜드 아웃바운드가 아니라 구독자 대상 정기 콘텐츠다 — 콜드메일은 propose_cold_emails 를 쓴다(역할이 다르다). " +
        "구조 계약: 제목 변형 2~5개(서로 다른 심리 트리거 angle), 제목 비반복 프리헤더(40~90자), 프레임워크 1개(AIDA/PAS/BAB/curation) 의식적 선택, " +
        "섹션은 hook→featured/news→tip/spotlight/community→cta 순의 스캐너 우선 구조(짧은 단락·볼드 키프레이즈), CTA 1개(핵심 전환으로 연결). " +
        "news/featured 섹션에는 '왜 중요한가' 한 줄과 출처 URL 을 가능한 한 채운다(소스에 없는 주장·수치 날조 금지). " +
        "톤 금지: em-dash(—)·과장어(amazing/incredible)·jargon. " +
        "글자수·스팸 위험·예상 읽기시간·톤 위반 플래그는 도구가 계산해 반환하므로 그 수치를 그대로 인용하라(직접 계산 금지). " +
        "가능하면 호출 전에 track_content_performance(상위 포맷 반영)·analyze_keywords(섹션 keywordRef)·monitor_competitors(news 섹션 근거)·analyze_newsletter_performance(차기 제목/세그먼트)를 먼저 호출하라. " +
        "발송은 하지 않는다 — 초안 게시까지만 한다(실발송 게이트는 별도). 제목 후보만 단독으로 더 뽑는 작업은 optimize_subject_lines 를 쓴다.",
      input_schema: {
        type: "object",
        properties: {
          subjectVariants: {
            type: "array",
            description: "제목 A/B 후보 2~5개 (서로 다른 angle)",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "제목 문구 (모바일 40자 이내 권장, 느낌표/대문자 남발 금지)" },
                angle: { type: "string", enum: ["curiosity", "urgency", "personalization", "social_proof", "direct_benefit"] },
              },
              required: ["text", "angle"],
            },
          },
          preheaderText: { type: "string", description: "프리헤더 — 제목을 반복하지 않고 생각을 완성, 40~90자" },
          framework: { type: "string", enum: ["AIDA", "PAS", "BAB", "curation"] },
          sections: {
            type: "array",
            description: "구조화 본문 섹션 (스캐너 우선 순서)",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["hook", "featured", "news", "tip", "spotlight", "community", "cta"] },
                heading: { type: "string", description: "섹션 헤딩 (hook 은 생략 가능)" },
                bodyMarkdown: { type: "string", description: "섹션 본문 (짧은 단락·**볼드** 키프레이즈)" },
                whyItMatters: { type: "string", description: "이 소식이 독자에게 왜 중요한가 한 줄 (news/featured 권장)" },
                sourceUrl: { type: "string", description: "출처 URL (news 권장 — 없는 주장 날조 금지)" },
                keywordRef: { type: "string", description: "연결된 타겟 키워드 (선택)" },
              },
              required: ["kind", "bodyMarkdown"],
            },
          },
          cta: {
            type: "object",
            properties: {
              label: { type: "string", description: "CTA 버튼/링크 문구" },
              url: { type: "string" },
              goal: { type: "string", enum: ["engagement", "sales", "education", "community"] },
            },
            required: ["label", "goal"],
          },
          segment: { type: "string", description: "대상 세그먼트 라벨 (선택)" },
        },
        required: ["subjectVariants", "preheaderText", "framework", "sections", "cta"],
      },
      input_examples: [
        {
          subjectVariants: [
            { text: "성수 팝업, 시향 예약 D-7", angle: "urgency" },
            { text: "당신의 밤을 바꿀 향, 미리 만나보세요", angle: "direct_benefit" },
          ],
          preheaderText: "연무장길 작업실에서 25분간 손으로 붓는 캔들, 이번 주말만",
          framework: "PAS",
          sections: [
            { kind: "hook", bodyMarkdown: "퇴근길에 향 하나로 하루를 닫아본 적 있으세요?" },
            { kind: "featured", heading: "문라이트 시향 세션", bodyMarkdown: "이번 팝업의 핵심은 **직접 맡아보는 것**입니다.", whyItMatters: "온라인 후기보다 한 번의 시향이 예약 전환을 만듭니다.", keywordRef: "시향 예약" },
          ],
          cta: { label: "시향 세션 예약하기", goal: "sales" },
        },
        {
          subjectVariants: [
            { text: "온그릇이 달라졌습니다", angle: "curiosity" },
            { text: "10년 단골들이 먼저 알아본 변화", angle: "social_proof" },
          ],
          preheaderText: "같은 흙, 새로운 결 — 리브랜딩 첫 컬렉션을 소개합니다",
          framework: "BAB",
          sections: [
            { kind: "hook", bodyMarkdown: "그릇 하나가 식탁의 공기를 바꿉니다." },
            { kind: "news", heading: "새 컬렉션 공개", bodyMarkdown: "이번 라인은 **무광 유약**으로 손맛을 살렸습니다.", whyItMatters: "기존 고객의 재구매와 신규 유입을 동시에 노린 변화입니다." },
          ],
          cta: { label: "새 컬렉션 보기", goal: "education" },
        },
      ],
    },
    {
      name: "propose_cold_emails",
      description:
        "콜드메일 초안을 제출하고 사람의 발송 승인을 요청한다. 콜드메일/아웃바운드 메일 발송이 필요할 때 반드시 이 도구를 통해야 한다 — 다른 발송 경로는 존재하지 않는다. 호출 전에 list_outbound_contacts 로 타겟을 조회해 각 수신자에 맞게 개인화하라. 결과로 승인/거부와 발송 내역이 반환된다. " +
        "첫 줄은 'I hope this finds you well'·'안녕하세요, 저는' 같은 상투구로 시작하지 않는다(수신자 맥락으로 시작). " +
        "구독자 정기 콘텐츠는 반환하지 않는다(그건 draft_newsletter). 여러 통의 카덴스 설계는 plan_email_sequence 가 먼저 한다 — 이 도구는 실제 발송 승인만 처리한다.",
      input_schema: {
        type: "object",
        properties: {
          emails: {
            type: "array",
            description: "승인 요청할 콜드메일 초안 목록",
            items: {
              type: "object",
              properties: {
                to: { type: "string", description: "수신 이메일 주소" },
                company: { type: "string", description: "수신 브랜드/회사명" },
                subject: { type: "string", description: "메일 제목" },
                bodyText: { type: "string", description: "메일 본문 (개인화 필수)" },
                followUpInDays: {
                  type: "number",
                  description: "무응답 시 팔로업까지 일수",
                },
              },
              required: ["to", "company", "subject", "bodyText", "followUpInDays"],
            },
          },
        },
        required: ["emails"],
      },
      input_examples: [
        {
          emails: [
            {
              to: "owner@example.com",
              company: "연무장 로스터스",
              subject: "연무장길 카페 공간에 어울리는 향 한 가지",
              bodyText: "지난주 연무장 로스터스의 우드톤 인테리어를 보고 연락드립니다. 매장 분위기에 맞춘 캔들 큐레이션을 샘플로 먼저 보내드리고 싶습니다. 부담 없이 시향만 해보셔도 좋습니다.",
              followUpInDays: 4,
            },
            {
              to: "manager@example.com",
              company: "성수 스테이 04",
              subject: "객실 첫인상을 결정하는 향 제안",
              bodyText: "성수 스테이 04의 미니멀한 객실 사진을 인상 깊게 봤습니다. 체크인 순간의 향을 위한 룸 캔들 라인을 제안드립니다. 레퍼런스 매장 리스트를 함께 첨부할 수 있습니다.",
              followUpInDays: 5,
            },
          ],
        },
        {
          emails: [
            {
              to: "buyer@example.com",
              company: "당산 비스트로",
              subject: "당산 비스트로 플레이팅에 맞는 무광 그릇",
              bodyText: "당산 비스트로의 코스 플레이팅을 보고 무광 도자기 식기가 잘 어울리겠다고 생각했습니다. 1인 코스용 샘플 세트를 먼저 보내드릴 수 있습니다. 가마마다 발색이 미세하게 다른 점이 매장 시그니처가 됩니다.",
              followUpInDays: 4,
            },
          ],
        },
      ],
    },
    {
      name: "show_metrics",
      description:
        "주차별 성과 지표 대시보드를 우측 아티팩트 패널에 표시한다. 사용자가 성과, 지표, 결과, 대시보드, 팔로워/구독자 추이를 물어보면 호출하라. 단계별 전환·병목은 다루지 않는다(그건 analyze_funnel). 입력은 없다.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "list_outbound_contacts",
      description:
        "아웃바운드 타겟 연락처 목록을 JSON 으로 반환한다. 콜드메일을 작성하기 전, 수신자별 개인화 컨텍스트(최근 활동/특징)가 필요할 때 호출하라. 조회 전용이며 발송하지 않는다(발송은 propose_cold_emails). 입력은 없다.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "read_crm",
      description:
        "CRM 리드 파이프라인 현황을 JSON 으로 반환한다. 리드 상태/스코어 질문에 답하거나 팔로업 대상을 고를 때 호출하라. 입력은 없다.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "analyze_keywords",
      description:
        "추적 중인 검색 키워드 포트폴리오를 분석해 기회 키워드 리포트를 아티팩트 패널에 표시한다. 사용자가 키워드, 검색량, SEO, 순위, '뭘 노려야 하나'를 물으면 호출하라. 기회 스코어는 도구가 계산해 반환하므로 그 수치를 그대로 인용하라. 브리핑·콘텐츠 캘린더의 소재 선정 근거로도 사용하라. audience 축: B2B = 문의 전환 키워드(도입·납품·제휴 의도), B2C = 소비자 구매 의도. 입력은 선택이다.",
      input_schema: {
        type: "object",
        properties: {
          sortBy: {
            type: "string",
            enum: ["opportunity", "volume", "rankDelta"],
            description: "정렬 기준 (기본 opportunity)",
          },
          intent: {
            type: "string",
            enum: ["정보", "탐색", "거래"],
            description: "이 인텐트만 필터 (선택)",
          },
          audience: {
            type: "string",
            enum: ["B2B", "B2C"],
            description: "검색 주체 필터 (선택) — B2B 는 문의 전환 키워드",
          },
        },
      },
    },
    {
      name: "analyze_funnel",
      description:
        "유입부터 핵심 전환(시향 예약/구매)까지의 단계별 퍼널을 분석해 아티팩트 패널에 표시한다. 사용자가 전환율, 퍼널, 유저 여정, '어디서 이탈하나'를 물으면 호출하라. 주차별 추이는 show_metrics, 단계별 전환은 이 도구 — 역할이 다르다. 전환율과 병목 단계는 도구가 계산한다. 입력은 없다.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "track_content_performance",
      description:
        "발행된 인스타그램 게시물의 D+1/D+7 성과를 추적해 아티팩트 패널에 표시하고, 상위 성과 패턴을 반환한다. 사용자가 '지난 포스트 어땠어', 콘텐츠 성과, 반응을 물으면 호출하라. 새 인스타그램 초안을 만들기 전에도 먼저 호출해 상위 패턴을 다음 초안 컨셉에 반영하라 — 이것이 에이전트의 학습 루프다. 입력은 없다.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "schedule_follow_ups",
      description:
        "CRM 리드의 stage와 마지막 접촉일 기준으로 오늘 팔로업해야 할 리드 큐를 JSON으로 반환한다. 사용자가 팔로업, 후속 메일, '오늘 누구 챙겨야 해'를 물으면 호출하라. due 목록의 리드에게 보낼 팔로업 메일은 반드시 propose_cold_emails 로 초안을 제출해 승인을 받아라 — 이 도구는 발송하지 않는다.",
      input_schema: {
        type: "object",
        properties: {
          asOf: { type: "string", description: "기준일 ISO date (기본: 오늘)" },
        },
      },
    },
    {
      name: "plan_content_calendar",
      description:
        "인스타그램·뉴스레터·블로그를 아우르는 주간 콘텐츠 캘린더를 아티팩트 패널에 게시한다. 사용자가 콘텐츠 계획, 주간 플랜, 캘린더, 발행 일정을 요청하면 호출하라. 가능하면 호출 전에 analyze_keywords 로 기회 키워드를 조회해 각 항목의 keywordRef 에 연결하라. 항목은 5~8개, 핵심 전환 목표(시향 예약/신규 고객층 구매)와의 연결을 objective 에 명시할 것. " +
        "각 항목의 실제 카피/캡션/본문은 반환하지 않는다(그건 draft_instagram_posts·draft_newsletter — 캘린더는 일정·주제·목표만). 발행은 하지 않으며 계획만 게시한다.",
      input_schema: {
        type: "object",
        properties: {
          weekLabel: {
            type: "string",
            description: "예: 6월 3주차 (팝업 D-7 주간)",
          },
          entries: {
            type: "array",
            description: "캘린더 항목 5~8개",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "ISO 날짜" },
                channel: {
                  type: "string",
                  enum: ["instagram", "newsletter", "blog"],
                },
                title: { type: "string", description: "콘텐츠 한 줄 제목" },
                objective: {
                  type: "string",
                  description: "이 콘텐츠가 핵심 전환으로 이어지는 경로 한 줄",
                },
                status: {
                  type: "string",
                  enum: ["planned", "drafted", "published"],
                },
                keywordRef: {
                  type: "string",
                  description: "연결된 타겟 키워드 (선택)",
                },
              },
              required: ["date", "channel", "title", "objective", "status"],
            },
          },
        },
        required: ["weekLabel", "entries"],
      },
      input_examples: [
        {
          weekLabel: "6월 3주차 (팝업 D-7 주간)",
          entries: [
            { date: "2026-06-15", channel: "instagram", title: "작업실 25분 포어링 릴스", objective: "핸드포어드 과정으로 신뢰 형성 → 시향 예약 관심 유도", status: "planned", keywordRef: "핸드포어드 캔들" },
            { date: "2026-06-16", channel: "newsletter", title: "시향 세션 사전 예약 오픈 안내", objective: "구독자를 시향 예약 전환으로 직접 연결", status: "planned", keywordRef: "시향 예약" },
            { date: "2026-06-17", channel: "blog", title: "성수동 팝업 가이드 — 연무장길 코스", objective: "성수 검색 유입 → 팝업 방문·시향 예약", status: "planned", keywordRef: "성수동 팝업" },
            { date: "2026-06-19", channel: "instagram", title: "향 노트로 읽는 세 가지 라인 캐러셀", objective: "제품 이해도 상승 → 구매·시향 고려", status: "planned", keywordRef: "소이캔들 추천" },
            { date: "2026-06-21", channel: "instagram", title: "주말 시향 잔여석 스토리", objective: "주말 방문 슬롯 시향 예약 마감 압박", status: "planned" },
          ],
        },
        {
          weekLabel: "6월 2주차 (신규 라인 출시 주간)",
          entries: [
            { date: "2026-06-08", channel: "newsletter", title: "「오늘」 라인 출시 소식", objective: "단골 유지 + 30대 신규 구매 유도", status: "drafted", keywordRef: "무광 그릇" },
            { date: "2026-06-09", channel: "instagram", title: "1인 플레이팅 캐러셀", objective: "혼밥 플레이팅 검색층 유입 → 1인 식기 구매", status: "planned", keywordRef: "혼밥 플레이팅" },
            { date: "2026-06-11", channel: "blog", title: "혼밥도 한 끼 — 1인 그릇 고르는 법", objective: "그릇 맛집 검색 유입 → 신규 30대 전환", status: "planned", keywordRef: "그릇 맛집" },
            { date: "2026-06-13", channel: "instagram", title: "단골 대상 '변하지 않는 것' 메시지", objective: "리브랜딩 소외감 방지로 단골 유지", status: "planned" },
          ],
        },
      ],
    },
    {
      name: "monitor_competitors",
      description:
        "주변 경쟁 브랜드·팝업·관련 트렌드 멘션 피드를 JSON으로 반환한다. 아침 브리핑을 작성하기 전, 또는 사용자가 경쟁사·트렌드·요즘 분위기를 물을 때 호출하라. 브리핑 항목의 source 필드에는 이 피드의 source/date 를 인용하라. 입력은 없다.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "analyze_lead_journey",
      description:
        "전환(문의·예약)까지의 리드 여정 패턴을 분석해 아티팩트 패널에 표시한다. 전환 유저의 평균 방문 횟수·소요 일수·체류 시간과, 미전환 고관여 핫리드 목록을 도구가 계산한다. 사용자가 '문의까지 보통 몇 번 방문하나', 리드 여정, 핫리드, 영업 우선순위를 물으면 호출하라. 입력은 없다.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "analyze_keyword_journey",
      description:
        "키워드 탐색 경로('A 를 검색한 사람이 다음에 뭘 검색하나')를 분석해 아티팩트 패널에 표시한다. 시드 키워드의 다음 검색 전이율과 B2B/B2C 의도로 갈라지는 신호를 함께 보여준다. 사용자가 검색 여정, 다음 검색어, 키워드 경로를 물으면 호출하라.",
      input_schema: {
        type: "object",
        properties: {
          seedKeyword: {
            type: "string",
            description: "분석 시작 키워드 (미지정 시 대표 시드)",
          },
        },
      },
    },
    {
      name: "analyze_content_attribution",
      description:
        "키워드 타겟 콘텐츠별 문의 기여(세션 → 문의 전환율)를 분석해 아티팩트 패널에 표시한다. 전환율은 도구가 계산하므로 그대로 인용하라. 사용자가 '어떤 글이 문의를 만들었나', 콘텐츠 기여, 글별 전환 효율을 물으면 호출하라. 입력은 없다.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "track_follower_growth",
      description:
        "채널별(인스타그램 팔로워·뉴스레터 구독자) 일별 성장 시계열과 주간 성장률을 아티팩트 패널에 표시한다. 사용자가 팔로워 추이, 구독자 증가, 채널 성장 속도를 물으면 호출하라. 주차별 종합 지표는 show_metrics — 역할이 다르다. 입력은 없다.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "query_ga_bigquery",
      description:
        "GA4 → BigQuery export 테이블에 읽기 전용 SQL(SELECT/WITH)을 실행해 결과를 JSON 으로 반환한다. BigQuery 설정 시 실데이터, 아니면 mock 으로 폴백한다 — 결과의 source 필드가 \"mock\" 이면 모의 데이터다. 사용자가 GA 원본 데이터, 세션 로그 커스텀 분석을 요청하면 호출하라.",
      input_schema: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "실행할 BigQuery SQL (SELECT/WITH 만 허용)",
          },
        },
        required: ["sql"],
      },
    },
    {
      name: "fetch_search_console",
      description:
        "Google Search Console 검색 성과(쿼리별 클릭·노출·평균 순위)를 JSON 으로 반환한다. 서비스계정 키 설정 시 실데이터, 아니면 mock 으로 폴백한다 — 결과의 source 필드가 \"mock\" 이면 모의 데이터다. 사용자가 실제 검색 노출·클릭 데이터를 요청하면 호출하라.",
      input_schema: {
        type: "object",
        properties: {
          siteUrl: {
            type: "string",
            description:
              "Search Console 속성 URL (예: https://example.com/ 또는 sc-domain:example.com) — 선택",
          },
          days: {
            type: "number",
            description: "조회 기간 일수 (기본 28)",
          },
        },
      },
    },
    {
      name: "fetch_instagram_insights",
      description:
        "Instagram Graph API 에서 최근 미디어 인사이트(좋아요·댓글 등)를 JSON 으로 반환한다. 액세스 토큰 설정 시 실데이터, 아니면 mock 으로 폴백한다 — 결과의 source 필드가 \"mock\" 이면 모의 데이터다. 사용자가 실제 인스타그램 반응 데이터를 요청하면 호출하라. 입력은 없다.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "audit_tracking_setup",
      description:
        "공개 웹사이트 URL 의 렌더된 DOM 을 분석해 미추적 이벤트 후보를 발굴하고, GTM 태그 설정 JSON 이 포함된 추적 감사 리포트를 아티팩트 패널에 표시한다. 분석 전용 — 사이트에 어떤 쓰기도 하지 않는다. 사용자가 '우리 사이트 추적 잘 되고 있나', GA/GTM 점검, 이벤트 셋업 감사를 요청하면 호출하라. http(s) 공개 URL 만 허용된다 (localhost/사설 IP 불가).",
      input_schema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "분석할 공개 http(s) URL",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "optimize_subject_lines",
      description:
        "뉴스레터/이메일 본문 요지를 입력하면 심리 트리거별 제목 후보를 스코어링해 제목 A/B 랩 표를 아티팩트 패널에 표시한다. 사용자가 '제목 더 뽑아줘'·'제목 A/B'·'제목 최적화'·'어떤 제목이 나아'를 물으면 호출하라. " +
        "모델이 angle 별로 후보를 제시하면 도구가 글자수·모바일 잘림·스팸 위험·예상 상대오픈 점수를 결정론적으로 계산해 표로 정리한다(예상 오픈은 휴리스틱 추정값이므로 그대로 인용하되 '추정'이라고 밝혀라). " +
        "뉴스레터 본문 전체 작성은 draft_newsletter 가 한다(역할이 다르다 — 이 도구는 제목만 다룬다). 본문/섹션/CTA 는 생성하지 않으며 발송도 하지 않는다.",
      input_schema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "제목을 뽑을 본문/메일의 요지 한 줄" },
          goal: { type: "string", enum: ["open", "click"], description: "최적화 목표 (기본 open)" },
          variants: {
            type: "array",
            description: "제목 후보 (서로 다른 angle 권장, 5~10개)",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "제목 문구 (모바일 40자 이내 권장)" },
                angle: { type: "string", enum: ["curiosity", "urgency", "personalization", "social_proof", "direct_benefit"] },
              },
              required: ["text", "angle"],
            },
          },
        },
        required: ["topic", "variants"],
      },
      input_examples: [
        {
          topic: "성수 팝업 시향 예약 마감 임박 안내",
          goal: "open",
          variants: [
            { text: "성수 팝업, 시향 예약 잔여석 안내", angle: "urgency" },
            { text: "퇴근길에 향 하나로 하루를 닫는 법", angle: "curiosity" },
            { text: "예약자 전원 티라이트 증정", angle: "direct_benefit" },
            { text: "이번 주말 다녀간 분들이 가장 많이 고른 향", angle: "social_proof" },
            { text: "당신의 방에 어울리는 달의 향", angle: "personalization" },
          ],
        },
        {
          topic: "온그릇 리브랜딩 신규 라인 출시 소식",
          goal: "click",
          variants: [
            { text: "온그릇이 달라졌습니다", angle: "curiosity" },
            { text: "10년 단골들이 먼저 알아본 변화", angle: "social_proof" },
            { text: "1인 식탁을 위한 무광 그릇, 처음 공개", angle: "direct_benefit" },
            { text: "당신의 식탁에 맞는 한 점을 골라드려요", angle: "personalization" },
          ],
        },
      ],
    },
    {
      name: "critique_copy",
      description:
        "이미 작성된 카피(뉴스레터/콜드메일/인스타 캡션)를 톤·스팸·길이·출처 체크리스트로 결정론 점검하고, 위반 항목과 수정 제안을 카피 점검 리포트로 아티팩트 패널에 표시한다. " +
        "사용자가 '검토해줘'·'톤 점검'·'발송 전 확인'을 요청하면, 또는 draft_newsletter 의 toneFlags 가 비어 있지 않을 때 호출하라. " +
        "통과 점수와 위반 카운트는 도구가 계산하므로 그대로 인용하라. em-dash·과장어/jargon·스팸어·제목 길이·콜드메일 첫 줄 상투구·출처 누락 등을 검사한다. " +
        "콘텐츠를 새로 생성하지는 않는다 — 점검과 수정 제안만 한다(생성은 draft_newsletter/draft_instagram_posts/propose_cold_emails). 발송도 하지 않는다.",
      input_schema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["newsletter", "cold_email", "instagram"], description: "점검할 카피 종류" },
          text: { type: "string", description: "점검할 본문 카피 (마크다운 가능)" },
          subject: { type: "string", description: "제목/메일 제목 (있으면 길이·스팸도 점검)" },
          preheader: { type: "string", description: "프리헤더 (뉴스레터일 때 길이 점검, 선택)" },
        },
        required: ["kind", "text"],
      },
      input_examples: [
        {
          kind: "newsletter",
          subject: "이번 주 무료 시향 100% 보장 — 지금 바로!",
          text: "이 amazing 한 향은 game-changing 입니다. 놓치면 후회합니다 — 지금 예약하세요.",
        },
        {
          kind: "cold_email",
          subject: "협업 제안",
          text: "안녕하세요, 저는 달무드의 마케터입니다. 바쁘신 와중에 메일 드립니다. 저희 캔들을 소개하고 싶습니다.",
        },
      ],
    },
    {
      name: "plan_email_sequence",
      description:
        "콜드 또는 너처 멀티터치 이메일 시퀀스(메일별 발송 시점·프레임워크·목표·CTA)를 설계해 이메일 시퀀스 타임라인을 아티팩트 패널에 표시한다. " +
        "사용자가 '시퀀스'·'팔로업 흐름'·'웰컴 시리즈'·'며칠 간격으로 보낼까'를 요청하면 호출하라. " +
        "도구는 카덴스 정합성(dayOffset 단조 증가)과 본문 개요 단어수 가드만 계산한다 — 실문장은 모델이 개요로 제시한다. " +
        "콜드 기본 카덴스: Day1 훅 → Day3 가치 → Day7 사회적 증거 → Day14 관점 전환 → Day21 종료. 너처 기본: 즉시 → 24h → 48h 웰컴. " +
        "실제 발송은 하지 않는다 — 이 도구는 계획만 한다. 각 메일의 실제 발송은 반드시 propose_cold_emails 승인 게이트를 거친다(다른 발송 경로는 존재하지 않는다). 단발 1통은 propose_cold_emails 가 직접 다룬다.",
      input_schema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["cold", "nurture"], description: "콜드 아웃바운드 vs 옵트인 너처" },
          audience: { type: "string", description: "시퀀스 대상 설명" },
          steps: {
            type: "array",
            description: "시퀀스 메일 단계 (dayOffset 오름차순 권장)",
            items: {
              type: "object",
              properties: {
                dayOffset: { type: "number", description: "시작일 기준 발송 시점 (Day0=즉시)" },
                framework: { type: "string", enum: ["AIDA", "PAS", "BAB", "PPPP"] },
                objective: { type: "string", description: "이 메일의 목표 한 줄" },
                subject: { type: "string", description: "메일 제목" },
                bodyOutline: { type: "string", description: "본문 개요 (실문장이 아닌 골격)" },
                cta: { type: "string", description: "이 메일의 행동 요청" },
              },
              required: ["dayOffset", "framework", "objective", "subject", "bodyOutline", "cta"],
            },
          },
        },
        required: ["type", "audience", "steps"],
      },
      input_examples: [
        {
          type: "cold",
          audience: "성수 인근 카페·스테이 사장 (캔들 납품 제안)",
          steps: [
            { dayOffset: 1, framework: "PAS", objective: "공간 향에 대한 문제 제기로 관심 유도", subject: "성수 OO카페, 공간 첫인상의 마지막 1%", bodyOutline: "최근 방문 인상 → 공간 향의 부재 → 달무드 큐레이션 한 줄 제안", cta: "샘플 시향 키트 받아보기" },
            { dayOffset: 3, framework: "BAB", objective: "도입 전후 변화를 그려 가치 전달", subject: "향이 머무는 공간의 차이", bodyOutline: "전: 무취 공간 → 후: 머무는 시간이 길어진 매장 사례 → 납품 방식", cta: "10분 통화 일정 잡기" },
            { dayOffset: 7, framework: "AIDA", objective: "사회적 증거로 신뢰 확보", subject: "성수 편집숍들이 먼저 선택한 이유", cta: "레퍼런스 매장 리스트 보기", bodyOutline: "관심 → 레퍼런스 매장 → 도입 효과 → 행동" },
          ],
        },
        {
          type: "nurture",
          audience: "신규 뉴스레터 구독자 (시향 예약 유도 웰컴)",
          steps: [
            { dayOffset: 0, framework: "AIDA", objective: "환영 + 브랜드 한 줄 소개", subject: "달무드에 오신 걸 환영합니다", bodyOutline: "환영 → 브랜드 모티프(달이 뜨는 하룻밤) → 다음 메일 예고", cta: "대표 향 3종 둘러보기" },
            { dayOffset: 1, framework: "PAS", objective: "시향의 가치를 설명해 예약 유도", subject: "향은 직접 맡아봐야 압니다", bodyOutline: "온라인 한계 → 시향 세션 소개 → 잔여석 안내", cta: "문라이트 시향 세션 예약" },
          ],
        },
      ],
    },
    {
      name: "analyze_newsletter_performance",
      description:
        "과거 뉴스레터 발송의 오픈율·CTR·이탈을 벤치마크 대비 분석하고, 차기 제목 트리거와 타겟 세그먼트를 추천해 뉴스레터 성과 리포트를 아티팩트 패널에 표시한다. " +
        "사용자가 '지난 뉴스레터 어땠어'·'오픈율'·'구독자 반응'을 물으면 호출하라. 새 뉴스레터 초안을 만들기 전에도 먼저 호출해 차기 제목·세그먼트에 반영하라 — 이것이 뉴스레터의 학습 루프다(인스타의 track_content_performance 와 동형). " +
        "오픈율·CTR·평균·추세는 도구가 계산하므로 그대로 인용하라(직접 계산 금지). 인스타그램 게시물 성과는 track_content_performance 가 다룬다(역할이 다르다 — 이 도구는 이메일 발송만). " +
        "입력은 없다(시나리오 mock 발송 로그·세그먼트를 사용). 발송은 하지 않는다.",
      input_schema: { type: "object", properties: {} },
    },
  ];
}

// ───────────── 순수 빌더 — 시나리오 팩에서 결정론적으로 리포트를 계산한다 ─────────────
// executeTool 과 GET /api/workspace 가 같은 계산을 공유한다 (동작 불변 리팩토링).

// 키워드 포트폴리오 분석 — 기회 스코어는 전부 여기서 결정론적으로 계산 (모델 계산 금지)
export function buildKeywordReport(
  scenario: ScenarioPack,
  opts?: { sortBy?: string; intent?: string; audience?: string },
): KeywordReport {
  const sortBy = opts?.sortBy ?? "opportunity";
  const intent = opts?.intent;
  const audience = opts?.audience;
  const pack = scenario.mockKeywords;

  const INTENT_SCORE: Record<KeywordRow["intent"], number> = {
    거래: 10,
    탐색: 6,
    정보: 3,
  };

  let rows: KeywordRow[] = pack.seeds.map((seed) => {
    // 전주 대비 순위 변동 (양수 = 상승, 둘 다 null 이면 0)
    const rankDelta = (seed.prevRank ?? 0) - (seed.rank ?? seed.prevRank ?? 0);
    // 경쟁사는 상위인데 우리는 못 잡은 키워드
    const competitorGap =
      seed.competitorRank !== null &&
      (seed.rank === null || seed.rank > seed.competitorRank);
    // opportunityScore (0~100) = volume(최대40) + gap(30) + position(최대20) + intent(최대10)
    const volumeScore = Math.min(
      40,
      Math.round((40 * Math.log10(seed.monthlySearches + 1)) / 4.7),
    );
    const gapScore = competitorGap ? 30 : 0;
    const positionScore =
      seed.rank !== null && seed.rank >= 11 && seed.rank <= 20
        ? 20
        : seed.rank === null
          ? 10
          : 0;
    const opportunityScore = Math.min(
      100,
      volumeScore + gapScore + positionScore + INTENT_SCORE[seed.intent],
    );
    return {
      keyword: seed.keyword,
      monthlySearches: seed.monthlySearches,
      rank: seed.rank,
      rankDelta,
      intent: seed.intent,
      audience: seed.audience,
      competitorGap,
      opportunityScore,
    };
  });

  if (intent) rows = rows.filter((row) => row.intent === intent);
  if (audience) rows = rows.filter((row) => row.audience === audience);
  rows.sort((a, b) =>
    sortBy === "volume"
      ? b.monthlySearches - a.monthlySearches
      : sortBy === "rankDelta"
        ? b.rankDelta - a.rankDelta
        : b.opportunityScore - a.opportunityScore,
  );

  return {
    brandName: scenario.mockGa.brandName,
    capturedAt: new Date().toISOString().slice(0, 10),
    totalTracked: pack.totalTracked,
    note: pack.note,
    rows,
  };
}

// 전환 퍼널 분석 — 단계별 전환율과 병목은 여기서 계산한다
export function buildFunnelReport(scenario: ScenarioPack): FunnelReport {
  const journey = scenario.mockJourney;
  const stages: FunnelStage[] = journey.stages.map((s, i) => ({
    stage: s.stage,
    count: s.count,
    conversionFromPrev:
      i === 0
        ? null
        : Math.round((s.count / journey.stages[i - 1].count) * 1000) / 10,
  }));

  let bottleneckStage = "";
  let minRate = Infinity;
  for (const s of stages) {
    if (s.conversionFromPrev !== null && s.conversionFromPrev < minRate) {
      minRate = s.conversionFromPrev;
      bottleneckStage = s.stage;
    }
  }

  return {
    brandName: scenario.mockGa.brandName,
    period: journey.period,
    source: journey.source,
    note: journey.note,
    stages,
    bottleneckStage,
  };
}

// D+1/D+7 성과 추적 — 저장률 계산·정렬은 여기서, 모델은 결과만 인용한다
export function buildContentPerformanceReport(
  scenario: ScenarioPack,
): ContentPerformanceReport {
  const pack = scenario.mockPostPerformance;
  const posts: PostPerformance[] = pack.posts
    .map((post) => ({
      ...post,
      saveRateD7: post.metricsD7
        ? Math.round((post.metricsD7.saves / post.metricsD7.reach) * 10000) /
          100
        : null,
    }))
    // saveRateD7 내림차순, D+7 미집계(null)는 뒤로
    .sort((a, b) => (b.saveRateD7 ?? -1) - (a.saveRateD7 ?? -1));

  return {
    brandName: scenario.mockGa.brandName,
    note: pack.note,
    posts,
    topPattern: posts[0].format, // 상위 성과 포맷
  };
}

// 리드 여정 분석 — 전환 유저 패턴 통계·핫리드 선별을 결정론적으로 계산 (모델 계산 금지)
export function buildLeadJourneyReport(scenario: ScenarioPack): LeadJourneyReport {
  const pack = scenario.mockLeadJourney;
  const sessions = pack.sessions;
  const converted = sessions.filter((s) => s.converted);
  const denom = converted.length || 1;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const avgVisitsBeforeConversion = round1(
    converted.reduce((sum, s) => sum + s.visits, 0) / denom,
  );
  const avgDaysToConversion = round1(
    converted.reduce((sum, s) => sum + s.daysToConversion, 0) / denom,
  );
  // 방문 1회당 평균 체류 분 (전환 유저 기준)
  const avgSessionMinutes = round1(
    converted.reduce((sum, s) => sum + s.totalMinutes / Math.max(1, s.visits), 0) /
      denom,
  );

  // highEngagementThreshold = 전체 세션 체류분(totalMinutes) 상위 25% 경계값
  const sortedMinutes = sessions
    .map((s) => s.totalMinutes)
    .sort((a, b) => b - a);
  const quartileIdx = Math.max(0, Math.ceil(sortedMinutes.length * 0.25) - 1);
  const highEngagementThreshold = sortedMinutes[quartileIdx] ?? 0;

  // 핫리드 = 미전환 중 체류분 상위 3~5명 (4~5번째는 임계치 이상일 때만 포함)
  const hotLeads: LeadSession[] = sessions
    .filter((s) => !s.converted)
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 5)
    .filter((s, i) => i < 3 || s.totalMinutes >= highEngagementThreshold);

  return {
    brandName: scenario.mockGa.brandName,
    period: pack.period,
    source: pack.source,
    note: pack.note,
    stats: {
      avgVisitsBeforeConversion,
      avgDaysToConversion,
      avgSessionMinutes,
      highEngagementThreshold,
    },
    hotLeads,
  };
}

// 키워드 탐색 경로 — 시드 노드 + 1단계 확장 트리와 B2B/B2C 분기 신호를 조립
export function buildKeywordJourneyReport(
  scenario: ScenarioPack,
  seedKeyword?: string,
): KeywordJourneyReport {
  const pack = scenario.mockKeywordJourney;
  const seeds = pack.seeds;
  if (seeds.length === 0) {
    throw new Error("키워드 탐색 경로 데이터가 비어 있습니다 (mock-keyword-journey.json)");
  }

  const root =
    (seedKeyword
      ? (seeds.find((s) => s.keyword === seedKeyword) ??
        seeds.find(
          (s) =>
            s.keyword.includes(seedKeyword) || seedKeyword.includes(s.keyword),
        ))
      : undefined) ?? seeds[0];

  // 시드 노드 + 다음 검색어 중 자체 전이 데이터가 있는 노드를 1단계 확장 (next 는 전이율 내림차순)
  const nextKeywords = new Set(root.next.map((t) => t.keyword));
  const nodes: KeywordJourneyNode[] = [
    root,
    ...seeds.filter(
      (s) => s.keyword !== root.keyword && nextKeywords.has(s.keyword),
    ),
  ].map((n) => ({
    keyword: n.keyword,
    next: [...n.next].sort((a, b) => b.rate - a.rate),
  }));

  // 시드와 관련된 신호만 추리되, 매칭이 없으면 전체 신호를 전달
  const pickSignals = (all: string[]): string[] => {
    const matched = all.filter((s) => s.includes(root.keyword));
    return matched.length > 0 ? matched : all;
  };

  return {
    brandName: scenario.mockGa.brandName,
    seedKeyword: root.keyword,
    note: pack.note,
    nodes,
    b2bSignals: pickSignals(pack.b2bSignals ?? []),
    b2cSignals: pickSignals(pack.b2cSignals ?? []),
  };
}

// 콘텐츠 기여 분석 — 전환율 계산·정렬·인사이트 템플릿을 결정론적으로 처리
export function buildAttributionReport(scenario: ScenarioPack): AttributionReport {
  const pack = scenario.mockAttribution;
  if (pack.rows.length === 0) {
    throw new Error("콘텐츠 기여 데이터가 비어 있습니다 (mock-attribution.json)");
  }

  const topConverters: ContentAttribution[] = pack.rows
    .map((row) => ({
      ...row,
      conversionRate: Math.round((row.inquiries / row.sessions) * 1000) / 10,
    }))
    .sort((a, b) => b.conversionRate - a.conversionRate);

  const top = topConverters[0];
  const insight = `"${top.keyword}" 타겟 글 "${top.title}"이 세션 ${top.sessions}건에서 문의 ${top.inquiries}건(전환율 ${top.conversionRate}%)으로 1위 — 같은 검색 의도를 겨냥한 후속 콘텐츠가 문의 전환에 가장 효율적이다.`;

  return {
    brandName: scenario.mockGa.brandName,
    period: pack.period,
    note: pack.note,
    topConverters,
    insight,
  };
}

// 채널 성장 시계열 — 최근 7일 성장률을 결정론적으로 계산
export function buildFollowerGrowthReport(
  scenario: ScenarioPack,
): FollowerGrowthReport {
  const pack = scenario.mockFollowerGrowth;
  const snapshots = pack.snapshots;
  if (snapshots.length === 0) {
    throw new Error("채널 성장 데이터가 비어 있습니다 (mock-follower-growth.json)");
  }

  const last = snapshots[snapshots.length - 1];
  const base = snapshots[Math.max(0, snapshots.length - 8)]; // 7일 전 스냅샷
  const weeklyGrowthRatePct =
    base.instagram > 0
      ? Math.round(((last.instagram - base.instagram) / base.instagram) * 1000) / 10
      : last.instagram > 0
        ? 100
        : 0;

  return {
    brandName: scenario.mockGa.brandName,
    note: pack.note,
    snapshots,
    weeklyGrowthRatePct,
  };
}

// GTM 가져오기용 GA4 이벤트 태그 설정 JSON 조립 (audit_tracking_setup 전용)
function buildGtmTagConfig(
  eventName: string,
  parameters: Record<string, string>,
  trigger: { type: string; condition: string },
): unknown {
  return {
    tag: {
      name: `GA4 이벤트 - ${eventName}`,
      type: "gaawe",
      parameter: [
        { type: "TEMPLATE", key: "eventName", value: eventName },
        { type: "TAG_REFERENCE", key: "measurementId", value: "GA4 구성 태그" },
        {
          type: "LIST",
          key: "eventParameters",
          list: Object.entries(parameters).map(([name, value]) => ({
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "name", value: name },
              { type: "TEMPLATE", key: "value", value },
            ],
          })),
        },
      ],
    },
    trigger,
  };
}

// 추적 설정 감사 — 렌더된 HTML 을 정규식으로 파싱해 기존 신호·미추적 갭·커버리지를 계산.
// 분석 전용: 사이트에 어떤 쓰기도 하지 않는다.
export function buildTrackingAuditReport(
  url: string,
  html: string,
  via: "chrome" | "fetch",
): TrackingAuditReport {
  // 1) 기존 추적 신호 탐지
  const gtmId = /GTM-[A-Z0-9]{4,}/.exec(html)?.[0] ?? null;
  const hasGtm = gtmId !== null || /googletagmanager\.com\/gtm\.js/i.test(html);
  const hasGa =
    /googletagmanager\.com\/gtag\/js/i.test(html) || /\bgtag\s*\(/.test(html);
  const ga4Id = hasGa ? (/\bG-[A-Z0-9]{6,12}\b/.exec(html)?.[0] ?? null) : null;
  const hasDataLayer = /\bdataLayer\b/.test(html);
  const hasMetaPixel = /fbevents\.js|\bfbq\s*\(/.test(html);
  const hasNaverLog = /wcslog\.js/i.test(html);

  const existingSignals: string[] = [];
  if (hasGtm)
    existingSignals.push(`GTM 컨테이너 스니펫${gtmId ? ` (${gtmId})` : ""}`);
  if (hasGa) existingSignals.push(`GA4 gtag 스니펫${ga4Id ? ` (${ga4Id})` : ""}`);
  if (hasDataLayer) existingSignals.push("dataLayer 선언");
  if (hasMetaPixel) existingSignals.push("Meta Pixel (fbevents.js)");
  if (hasNaverLog) existingSignals.push("네이버 프리미엄로그 (wcslog.js)");

  // 2) 추적 후보 요소 탐지 (정규식 — 외부 DOM 파서 의존성 없음)
  const formCount = (html.match(/<form\b/gi) ?? []).length;
  const telCount = (html.match(/href=["']tel:/gi) ?? []).length;
  const mailtoCount = (html.match(/href=["']mailto:/gi) ?? []).length;
  const buttonCount =
    (html.match(/<button\b/gi) ?? []).length +
    (html.match(/<input\b[^>]*type=["']submit["']/gi) ?? []).length;
  const pageHost = new URL(url).hostname;
  let externalLinkCount = 0;
  for (const m of html.matchAll(/href=["'](https?:\/\/[^"'\s>]+)["']/gi)) {
    try {
      if (new URL(m[1]).hostname !== pageHost) externalLinkCount += 1;
    } catch {
      // 깨진 href 는 무시
    }
  }

  // 3) 미추적 이벤트 갭 — DOM 만으로는 이벤트 연결 여부를 확정할 수 없으므로 후보로 제시
  const gaps: TrackingGap[] = [];
  if (formCount > 0) {
    const params = {
      form_id: "{{Form ID}}",
      form_destination: "{{Page URL}}",
    };
    gaps.push({
      element: `폼 ${formCount}개 (문의/예약 제출 추정)`,
      recommendedEvent: "generate_lead",
      parameters: params,
      priority: "critical",
      gtmTagConfig: buildGtmTagConfig("generate_lead", params, {
        type: "FORM_SUBMISSION",
        condition: "모든 폼 제출 (필요 시 Form ID 로 한정)",
      }),
    });
  }
  if (telCount > 0) {
    const params = { link_url: "{{Click URL}}" };
    gaps.push({
      element: `전화 연결 링크 ${telCount}개 (tel:)`,
      recommendedEvent: "phone_call_click",
      parameters: params,
      priority: "high",
      gtmTagConfig: buildGtmTagConfig("phone_call_click", params, {
        type: "LINK_CLICK",
        condition: "Click URL 이 tel: 로 시작",
      }),
    });
  }
  if (mailtoCount > 0) {
    const params = { link_url: "{{Click URL}}" };
    gaps.push({
      element: `이메일 링크 ${mailtoCount}개 (mailto:)`,
      recommendedEvent: "email_click",
      parameters: params,
      priority: "high",
      gtmTagConfig: buildGtmTagConfig("email_click", params, {
        type: "LINK_CLICK",
        condition: "Click URL 이 mailto: 로 시작",
      }),
    });
  }
  if (buttonCount > 0) {
    const params = {
      button_text: "{{Click Text}}",
      page_location: "{{Page URL}}",
    };
    gaps.push({
      element: `버튼 ${buttonCount}개 (CTA 클릭 후보)`,
      recommendedEvent: "cta_click",
      parameters: params,
      priority: "high",
      gtmTagConfig: buildGtmTagConfig("cta_click", params, {
        type: "CLICK",
        condition: "Click Element 가 button 또는 submit",
      }),
    });
  }
  if (externalLinkCount > 0) {
    const params = {
      link_url: "{{Click URL}}",
      link_domain: "{{Click URL Hostname}}",
    };
    gaps.push({
      element: `외부 링크 ${externalLinkCount}개 (아웃바운드)`,
      recommendedEvent: "outbound_click",
      parameters: params,
      priority: "low",
      gtmTagConfig: buildGtmTagConfig("outbound_click", params, {
        type: "LINK_CLICK",
        condition: "Click URL Hostname 이 자사 도메인과 다름",
      }),
    });
  }

  // 4) 커버리지 점수 (0~100) = 기반 신호 가점 + 기본 20 - 갭 감점
  const foundation =
    (hasGa ? 40 : 0) +
    (hasGtm ? 30 : 0) +
    (hasDataLayer ? 10 : 0) +
    (hasMetaPixel || hasNaverLog ? 5 : 0);
  const penalty = gaps.reduce(
    (sum, gap) =>
      sum + (gap.priority === "critical" ? 15 : gap.priority === "high" ? 8 : 3),
    0,
  );
  const coverageScore = Math.max(0, Math.min(100, foundation + 20 - penalty));

  return { url, fetchedVia: via, coverageScore, existingSignals, gaps };
}

// ───────────── 뉴스레터/카피 순수 빌더 — 모든 파생 수치를 코드가 계산 (모델 인용만) ─────────────
// 방법론 상수·헬퍼는 lib/agent/copy-rules.ts 가 단일 출처(브랜드 데이터와 직교 교체).

// 뉴스레터 마감 빌더 — 모델이 만든 카피 입력을 받아 글자수·스팸위험·읽기시간·톤플래그를
// 결정론적으로 채워 완성된 NewsletterDraft 를 반환한다. (모델 계산 금지)
export function finalizeNewsletterDraft(input: {
  subjectVariants: { text: string; angle: SubjectVariant["angle"] }[];
  preheaderText: string;
  framework: NewsletterDraft["framework"];
  sections: NewsletterSection[];
  cta: NewsletterDraft["cta"];
  segment?: string;
}): NewsletterDraft {
  // 제목 후보: copy-rules.scoreSubject 로 글자수·모바일 잘림·스팸 위험을 채운다
  const subjectVariants: SubjectVariant[] = input.subjectVariants.map((v) => {
    const score = scoreSubject(v.text);
    return {
      text: v.text,
      angle: v.angle,
      charCount: score.charCount,
      truncatedOnMobile: score.truncatedOnMobile,
      spamRisk: score.spamRisk,
      spamFlags: score.spamFlags,
    };
  });

  // 읽기 시간: 본문(헤딩+바디) 코드포인트 기준으로 copy-rules.estimateReadSeconds 가 산출
  const bodyText = input.sections
    .map((s) => `${s.heading ?? ""} ${s.bodyMarkdown}`)
    .join(" ");
  const estimatedReadSeconds = estimateReadSeconds(bodyText);

  // 톤 플래그: em-dash·과장어·jargon·스팸어 (소스 날조는 코드로 못 잡으니 SYSTEM_BASE 로 가드)
  const allText = input.sections
    .map((s) => `${s.heading ?? ""} ${s.bodyMarkdown} ${s.whyItMatters ?? ""}`)
    .join(" ");
  const toneFlags = scanTone(allText).flags;

  // 하위호환 bodyMarkdown 합성 (기존 NewsletterPreview 의 미니 마크다운 렌더·리플레이 보존)
  const bodyMarkdown =
    input.sections
      .map((s) => {
        const h = s.heading ? `## ${s.heading}\n` : "";
        const why = s.whyItMatters ? `\n**왜 중요한가** ${s.whyItMatters}` : "";
        const src = s.sourceUrl ? `\n출처: ${s.sourceUrl}` : "";
        return `${h}${s.bodyMarkdown}${why}${src}`;
      })
      .join("\n\n") + `\n\n## ${input.cta.label}`;

  return {
    subjectVariants,
    preheaderText: input.preheaderText,
    preheaderCharCount: [...input.preheaderText].length,
    framework: input.framework,
    sections: input.sections,
    cta: input.cta,
    estimatedReadSeconds,
    toneFlags,
    segment: input.segment,
    // 하위호환 필드 — 빌더가 항상 채운다
    subject: subjectVariants[0]?.text ?? "",
    preheader: input.preheaderText,
    bodyMarkdown,
  };
}

// 제목 A/B 랩 빌더 — 후보별 글자수·스팸·예상 상대오픈을 계산해 점수 내림차순 표로 정리.
// 예상 오픈은 휴리스틱 추정값("추정" 라벨). copy-rules 의 scoreSubject/projectOpenScore 재사용.
export function buildSubjectLab(input: {
  topic: string;
  goal?: SubjectLabReport["goal"];
  variants: { text: string; angle: SubjectVariant["angle"] }[];
}): SubjectLabReport {
  const rows: SubjectScoreRow[] = input.variants
    .map((v) => {
      const score = scoreSubject(v.text);
      return {
        text: v.text,
        angle: v.angle,
        charCount: score.charCount,
        truncatedOnMobile: score.truncatedOnMobile,
        spamRisk: score.spamRisk,
        spamFlags: score.spamFlags,
        projectedOpenScore: projectOpenScore(v.angle, score),
      };
    })
    .sort((a, b) => b.projectedOpenScore - a.projectedOpenScore);

  // A/B 로 테스트할 제목 2개 = 상위 2개 (가능하면 서로 다른 angle)
  const recommended: string[] = [];
  for (const row of rows) {
    if (recommended.length >= 2) break;
    recommended.push(row.text);
  }

  return {
    topic: input.topic,
    goal: input.goal ?? "open",
    note: `제목 ${rows.length}개를 글자수·스팸 위험·예상 상대오픈으로 채점 (예상 오픈은 angle 가중·길이/스팸 페널티 기반 휴리스틱 추정값, 절대 오픈율 아님)`,
    rows,
    recommended,
  };
}

// 카피 자체 점검 빌더 — 톤·스팸·길이·출처·콜드 첫 줄 룰셋으로 위반 목록·통과 점수를 결정론 산출.
// 콘텐츠를 새로 생성하지 않는다(점검·제안만). copy-rules 상수/헬퍼 재사용.
export function buildCopyCritique(
  kind: CopyCritiqueReport["target"],
  text: string,
  subject?: string,
  preheader?: string,
): CopyCritiqueReport {
  const issues: CopyIssue[] = [];
  const lower = text.toLowerCase();
  const subjLower = (subject ?? "").toLowerCase();

  // 1) 톤 위반 (em-dash·과장어/jargon·스팸어) — 본문+제목
  const tone = scanTone(`${subject ?? ""} ${text}`);
  if (tone.emDash) {
    issues.push({
      rule: "em-dash 사용",
      severity: "warning",
      evidence: "본문에 em-dash(—)가 있습니다",
      suggestion: "em-dash 대신 쉼표·마침표·줄바꿈으로 끊어 읽기 부담을 줄이세요.",
    });
  }
  for (const flag of tone.flags) {
    if (flag.startsWith("과장어/jargon:")) {
      const term = flag.split(":")[1];
      issues.push({
        rule: "과장어/jargon",
        severity: "warning",
        evidence: `"${term}" 사용`,
        suggestion: `"${term}" 같은 공허한 표현 대신 구체적 사실·수치로 신뢰를 만드세요.`,
      });
    }
  }

  // 2) 스팸어 (제목/본문)
  for (const term of SPAM_TERMS) {
    const inSubj = subjLower.includes(term.toLowerCase());
    const inBody = lower.includes(term.toLowerCase());
    if (inSubj || inBody) {
      issues.push({
        rule: "스팸 트리거 단어",
        severity: inSubj ? "critical" : "warning",
        evidence: `${inSubj ? "제목" : "본문"}에 "${term}"`,
        suggestion: `"${term}" 는 스팸 필터를 자극합니다. 더 담백한 표현으로 바꾸세요.`,
      });
    }
  }

  // 3) 제목 길이/스팸 (있을 때)
  if (subject) {
    const score = scoreSubject(subject);
    if (score.truncatedOnMobile) {
      issues.push({
        rule: "제목 모바일 잘림",
        severity: "warning",
        evidence: `제목 ${score.charCount}자 (모바일 ${SUBJECT_MOBILE_MAX}자 초과)`,
        suggestion: `핵심 키워드를 앞 ${SUBJECT_MOBILE_MAX}자 안에 배치하세요.`,
      });
    }
  }

  // 3b) 프리헤더 길이 (뉴스레터에서 제공된 경우 — 40~90자 권장)
  if (kind === "newsletter" && preheader !== undefined) {
    const len = [...preheader].length;
    if (len < PREHEADER_MIN || len > PREHEADER_MAX) {
      issues.push({
        rule: "프리헤더 길이",
        severity: "info",
        evidence: `프리헤더 ${len}자 (권장 ${PREHEADER_MIN}~${PREHEADER_MAX}자)`,
        suggestion: `프리헤더는 제목을 반복하지 않으면서 ${PREHEADER_MIN}~${PREHEADER_MAX}자로 생각을 완성하세요.`,
      });
    }
  }

  // 4) 콜드메일 첫 줄 상투구
  if (kind === "cold_email") {
    for (const anti of COLD_OPENER_ANTIPATTERNS) {
      if (lower.includes(anti.toLowerCase())) {
        issues.push({
          rule: "콜드메일 첫 줄 상투구",
          severity: "critical",
          evidence: `"${anti}" 류로 시작`,
          suggestion: "자기소개·인사말 대신 수신자의 최근 활동/맥락 한 줄로 시작하세요.",
        });
        break;
      }
    }
  }

  // 5) 출처 누락 (뉴스레터에서 외부 주장에 URL 이 없을 때 — http(s) 링크 부재로 휴리스틱 판정)
  if (kind === "newsletter" && !/https?:\/\//i.test(text)) {
    issues.push({
      rule: "출처 누락",
      severity: "info",
      evidence: "본문에 출처 URL 이 없습니다",
      suggestion: "외부 소식·수치를 인용했다면 출처 URL 을 덧붙여 신뢰도를 높이세요(없는 주장 날조 금지).",
    });
  }

  // 통과 점수: 100 - (critical 20 / warning 10 / info 3)
  const penalty = issues.reduce(
    (sum, i) =>
      sum + (i.severity === "critical" ? 20 : i.severity === "warning" ? 10 : 3),
    0,
  );
  const passScore = Math.max(0, 100 - penalty);

  // severity 우선순위 정렬
  const order = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  const criticalN = issues.filter((i) => i.severity === "critical").length;
  const summary =
    issues.length === 0
      ? "결정론 룰셋 점검 통과 — 톤·스팸·길이·출처에서 발견된 위반이 없습니다."
      : `위반 ${issues.length}건(critical ${criticalN}건) 발견 — 통과 점수 ${passScore}점. 우선순위 항목부터 수정하세요.`;

  return {
    target: kind,
    note: "톤·스팸·길이·출처·콜드 첫 줄을 결정론 룰셋으로 점검 (콘텐츠 생성 아님, 점검·제안만)",
    passScore,
    issues,
    summary,
  };
}

// 멀티터치 이메일 시퀀스 빌더 — 카덴스 정합(dayOffset 단조)·단어수 가드만 계산.
// 발송하지 않는다(계획만). 실발송은 propose_cold_emails 승인 게이트만.
export function buildEmailSequencePlan(input: {
  type: EmailSequencePlan["type"];
  audience: string;
  steps: Omit<EmailSequenceStep, "wordCount" | "cadenceWarning">[];
}): EmailSequencePlan {
  let prevOffset = -Infinity;
  const steps: EmailSequenceStep[] = input.steps.map((s) => {
    const wordCount = s.bodyOutline.trim().split(/\s+/).filter(Boolean).length;
    let cadenceWarning: string | undefined;
    if (s.dayOffset <= prevOffset) {
      cadenceWarning = `발송 시점(Day${s.dayOffset})이 직전 메일(Day${prevOffset === -Infinity ? 0 : prevOffset}) 이후가 아닙니다 — 카덴스를 단조 증가로 재정렬하세요.`;
    } else if (wordCount > 120) {
      cadenceWarning = `본문 개요가 ${wordCount}단어로 깁니다 — 콜드/너처 메일은 짧게 유지하세요.`;
    }
    prevOffset = s.dayOffset;
    return { ...s, wordCount, cadenceWarning };
  });

  const totalDays = steps.reduce((max, s) => Math.max(max, s.dayOffset), 0);

  return {
    type: input.type,
    audience: input.audience,
    note: "카덴스/단어수는 도구가 계산. 발송하지 않음 — 각 메일 실발송은 propose_cold_emails 승인 게이트만 사용.",
    steps,
    totalDays,
  };
}

// 뉴스레터 발송 성과 빌더 — 오픈율/CTR 을 코드가 계산(track_content_performance 패턴),
// 벤치마크 위생 경보·추세·차기 제목 트리거·세그먼트 추천을 결정론 산출. 발송하지 않는다.
export function buildNewsletterPerformanceReport(
  scenario: ScenarioPack,
): NewsletterPerformanceReport {
  const pack = scenario.mockNewsletterPerformance;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  // 최신 우선 정렬 후 오픈율/CTR·플래그 계산
  const sorted = [...pack.records].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
  const rows: NewsletterPerformanceRow[] = sorted.map((r) => {
    const openRate = r.delivered > 0 ? round1((r.opens / r.delivered) * 100) : 0;
    const ctr = r.delivered > 0 ? round1((r.clicks / r.delivered) * 100) : 0;
    const flags: string[] = [];
    if (openRate < NEWSLETTER_OPENRATE_BENCHMARK)
      flags.push(`오픈율 ${NEWSLETTER_OPENRATE_BENCHMARK}% 미만`);
    // 오픈 대비 클릭 전환이 낮으면 CTR 저조 플래그 (열었으나 클릭 안 함)
    if (r.opens > 0 && r.clicks / r.opens < 0.1) flags.push("CTR 저조");
    return {
      sentAt: r.sentAt,
      subject: r.subject,
      delivered: r.delivered,
      opens: r.opens,
      clicks: r.clicks,
      openRate,
      ctr,
      flags,
    };
  });

  const n = rows.length || 1;
  const avgOpenRate = round1(rows.reduce((s, r) => s + r.openRate, 0) / n);
  const avgCtr = round1(rows.reduce((s, r) => s + r.ctr, 0) / n);

  // 추세: 최신 vs 직전 발송 오픈율 비교
  const latest = rows[0];
  const prev = rows[1];
  const trend = !prev
    ? "직전 발송 데이터가 없어 추세를 비교할 수 없습니다."
    : latest.openRate > prev.openRate
      ? `최신 발송 오픈율 ${latest.openRate}% 로 직전(${prev.openRate}%) 대비 상승 추세.`
      : latest.openRate < prev.openRate
        ? `최신 발송 오픈율 ${latest.openRate}% 로 직전(${prev.openRate}%) 대비 하락 — 제목 트리거를 점검하세요.`
        : `최신 발송 오픈율이 직전과 동일(${latest.openRate}%) — 변화를 주려면 제목 angle 을 바꿔보세요.`;

  // 차기 제목 트리거: 평균 오픈율 기준으로 휴리스틱 추천 (벤치마크 미달이면 호기심/사회적 증거 강화)
  const nextSubjectTriggers: SubjectVariant["angle"][] =
    avgOpenRate < NEWSLETTER_OPENRATE_BENCHMARK
      ? ["curiosity", "social_proof", "personalization"]
      : ["personalization", "direct_benefit", "urgency"];

  // 세그먼트 추천: 큰 세그먼트 우선 + 관심 키워드 기반 사유 합성
  const recommendedSegments: NewsletterSegmentRecommendation[] =
    scenario.mockNewsletterAudience.segments
      .slice()
      .sort((a, b) => b.size - a.size)
      .slice(0, 3)
      .map((seg) => ({
        segment: seg.segment,
        size: seg.size,
        reason: `관심 키워드 ${seg.interestKeywords.slice(0, 2).join("·")} 와 정합 — 차기 발송 우선 타겟(구독자 ${seg.size}명)`,
      }));

  const benchOk = avgOpenRate >= NEWSLETTER_OPENRATE_BENCHMARK;
  const insight = `최근 ${rows.length}건 평균 오픈율 ${avgOpenRate}%·CTR ${avgCtr}% (벤치마크 ${NEWSLETTER_OPENRATE_BENCHMARK}% ${benchOk ? "충족" : "미달"}). ${trend} 차기 초안은 ${nextSubjectTriggers[0]} 트리거 제목과 "${recommendedSegments[0]?.segment ?? "핵심"}" 세그먼트를 우선하세요.`;

  return {
    brandName: scenario.mockGa.brandName,
    period: `최근 발송 ${rows.length}건`,
    source: "뉴스레터 발송 로그 (mock)",
    note: pack.note,
    rows,
    avgOpenRate,
    avgCtr,
    benchmarkOpenRate: NEWSLETTER_OPENRATE_BENCHMARK,
    trend,
    nextSubjectTriggers,
    recommendedSegments,
    insight,
  };
}

export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<string> {
  switch (name) {
    case "publish_briefing": {
      const briefing = input as MorningBriefing;
      ctx.onEvent({ type: "artifact", artifact: { kind: "briefing", briefing } });
      return `아침 브리핑(항목 ${briefing.items.length}건)을 아티팩트 패널에 발행했다. 오늘의 픽: "${briefing.todaysPick}". 사용자에게 짧게 요약하고 다음 액션을 제안하라.`;
    }

    case "analyze_rfp": {
      const analysis = input as RfpAnalysis;
      ctx.onEvent({ type: "artifact", artifact: { kind: "rfp_analysis", analysis } });
      const mustCount = analysis.requirements.filter((r) => r.priority === "must").length;
      return `RFP 분석(${analysis.client} · ${analysis.title})을 보드에 표시했다. 적합도 ${Math.round(analysis.fitScore)}/100, 필수 요건 ${mustCount}건, 평가기준 ${analysis.evalCriteria.length}개. 핵심 수주 포인트를 한두 줄로 요약하고 제안서 작성(draft_proposal)을 제안하라.`;
    }

    case "draft_proposal": {
      const proposal = input as Proposal;
      ctx.onEvent({ type: "artifact", artifact: { kind: "proposal", proposal } });
      return `제안서 초안(${proposal.title})을 보드에 표시했다. 존 ${proposal.zones.length}개, KPI ${proposal.kpis.length}개. 컨셉과 차별점을 한두 줄로 요약하고 비딩 견적(build_bid)을 제안하라.`;
    }

    case "build_bid": {
      const raw = input as Omit<Bid, "subtotal" | "total"> & { lineItems: BidLineItem[]; marginPct: number };
      const subtotal = raw.lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0);
      const total = Math.round(subtotal * (1 + (Number(raw.marginPct) || 0) / 100));
      const bid: Bid = { ...raw, subtotal, total };
      ctx.onEvent({ type: "artifact", artifact: { kind: "bid", bid } });
      return `비딩 견적(${bid.title})을 보드에 표시했다. 소계 ₩${subtotal.toLocaleString("ko-KR")}, 마진 ${bid.marginPct}%, 총액 ₩${total.toLocaleString("ko-KR")}. 가격 경쟁력을 한 줄로 요약하라(수치는 표시된 값만 인용).`;
    }

    case "plan_operations": {
      const plan = input as OperationPlan;
      ctx.onEvent({ type: "artifact", artifact: { kind: "operation_plan", plan } });
      const totalStaff = plan.staffing.reduce((s, r) => s + (Number(r.count) || 0), 0);
      return `운영안(${plan.title})을 보드에 표시했다. 운영 시간 ${plan.hours}, 인력 ${totalStaff}명, 안전 항목 ${plan.safety.length}건, 일정 ${plan.schedule.length}단계. 핵심 운영 포인트를 한두 줄로 요약하라.`;
    }

    case "generate_visual": {
      const { title, brief, aspect, prompts } = input as {
        title: string;
        brief: string;
        aspect: string;
        prompts: string[];
      };
      const list = (Array.isArray(prompts) ? prompts : []).slice(0, 4);
      const connected = getSetting("HIGGSFIELD_ACCESS_TOKEN") !== undefined;
      let source: VisualSet["source"] = "mock";
      let note =
        "Higgsfield 미연결 — 목업 비주얼로 표시합니다. 설정 > Higgsfield 에서 계정을 연결하면 실제 생성됩니다.";
      let visuals: GeneratedVisual[] = [];

      let savedCount = 0;
      let savedDir = "";
      if (connected && list.length > 0) {
        try {
          for (const p of list) {
            const url = await generateViaHiggsfield({ prompt: p, aspect });
            // 로컬 디스크에 저장(다운로드)
            const savedPath = await saveImageLocally(url, title);
            if (savedPath) {
              savedCount += 1;
              if (!savedDir) savedDir = savedPath.replace(/\/[^/]+$/, "");
            }
            visuals.push({ url, prompt: p, savedPath: savedPath ?? undefined });
          }
          source = "higgsfield";
          note =
            savedCount > 0
              ? `Higgsfield 로 생성하고 로컬에 ${savedCount}장 저장했습니다: ${savedDir}`
              : "Higgsfield 로 생성했습니다.";
        } catch (err) {
          // 실패 → 목업 폴백 + 사실 고지(에이전트가 사용자에게 알림)
          visuals = [];
          source = "mock";
          note = `Higgsfield 생성 실패로 목업으로 대체했습니다 (${err instanceof Error ? err.message : "오류"}). 연결 상태를 확인하세요.`;
        }
      }
      if (source === "mock") {
        visuals = list.map((p) => ({ url: mockVisual(p, aspect), prompt: p }));
      }

      const set: VisualSet = { title, brief, source, note, aspect, visuals };
      ctx.onEvent({ type: "artifact", artifact: { kind: "visual", set } });
      return source === "higgsfield"
        ? `Higgsfield 로 비주얼 ${visuals.length}장을 생성해 보드에 표시했다.${savedCount > 0 ? ` 로컬에 ${savedCount}장 저장: ${savedDir}` : ""} 각 컷의 의도를 한 줄로 요약하고, 저장 위치를 사용자에게 알려라.`
        : `비주얼 ${visuals.length}장을 목업으로 표시했다. 사용자에게 목업임을 알리고, 실제 생성을 원하면 설정 > Higgsfield 에서 계정을 연결하라고 안내하라. (${note})`;
    }

    case "draft_instagram_posts": {
      const { posts } = input as { posts: InstagramPost[] };
      ctx.onEvent({
        type: "artifact",
        artifact: { kind: "instagram_posts", posts },
      });
      return `인스타그램 게시물 초안 ${posts.length}개를 폰 목업에 게시했다. 각 게시물의 컨셉을 한 줄씩 요약해 사용자에게 알려라.`;
    }

    case "draft_instagram_with_visuals": {
      type IgPostInput = {
        concept: string;
        caption: string;
        hashtags?: string[];
        imageBrief: string;
        suggestedPostTime: string;
        format?: "feed" | "carousel" | "reel";
        onImageText?: OnImageText;
        slides?: { imageBrief: string; onImageText?: OnImageText }[];
        reel?: ReelPlan;
      };
      const { posts } = input as { posts: IgPostInput[] };
      const connected = getSetting("HIGGSFIELD_ACCESS_TOKEN") !== undefined;
      const wordmark = (ctx.scenario.mockGa?.brandName || "OCTOPUS")
        .toUpperCase()
        .slice(0, 16);

      let savedCount = 0;
      let savedDir = "";
      let composedCount = 0;

      // 1) Higgsfield 로 배경 사진 생성(텍스트는 굽지 않음 — 코드로 합성). 미연결/실패 시 undefined.
      const genBg = async (
        scene: string,
        cardFormat: "feed" | "reel",
      ): Promise<string | undefined> => {
        if (!connected) return undefined;
        const fmt: VisualFormat = cardFormat === "reel" ? "reel" : "feed";
        const { prompt, aspect } = buildHiggsfieldPrompt({ format: fmt, scene });
        try {
          return await generateViaHiggsfield({ prompt, aspect });
        } catch {
          return undefined;
        }
      };

      // 2) 배경 위에 한글 카드 합성 → 공개 호스팅. onImageText 없거나 합성/업로드 실패 시 원본 폴백.
      const composeHost = async (
        bgUrl: string,
        onImageText: OnImageText | undefined,
        cardFormat: "feed" | "reel",
        badge: string | undefined,
        showChevron: boolean,
      ): Promise<{ url: string; composited: boolean }> => {
        if (!onImageText?.headline) {
          const saved = await saveImageLocally(bgUrl, "insta");
          if (saved) {
            savedCount += 1;
            if (!savedDir) savedDir = saved.replace(/\/[^/]+$/, "");
          }
          return { url: bgUrl, composited: false };
        }
        try {
          const buf = await renderCard({
            bgImageUrl: bgUrl,
            wordmark,
            headline: onImageText.headline,
            sub: onImageText.sub,
            badge: badge ?? onImageText.badge,
            format: cardFormat,
            showChevron,
          });
          const saved = await saveBufferLocally(buf, `card-${onImageText.headline}`);
          if (saved) {
            savedCount += 1;
            if (!savedDir) savedDir = saved.replace(/\/[^/]+$/, "");
          }
          try {
            const pub = await uploadPublic(buf, "card.png");
            composedCount += 1;
            return { url: pub, composited: true }; // 발행 가능(공개 URL)
          } catch {
            return { url: bgUrl, composited: false }; // 합성됨·업로드 실패 → 표시는 원본
          }
        } catch {
          return { url: bgUrl, composited: false }; // 합성 실패 → 원본
        }
      };

      const enriched: InstagramPost[] = await Promise.all(
        posts.map(async (p) => {
          const format: "feed" | "carousel" | "reel" = p.format ?? "feed";
          const aspect = aspectFor(format);
          const cardFormat: "feed" | "reel" = format === "reel" ? "reel" : "feed";

          // 캐러셀 — 슬라이드별 배경 생성 + 합성(뱃지 i/N, 마지막 외 > 표시)
          if (format === "carousel" && Array.isArray(p.slides) && p.slides.length > 0) {
            const slideInputs = p.slides.slice(0, 5);
            const total = slideInputs.length;
            const slides: GeneratedVisual[] = [];
            let coverUrl: string | undefined;
            let anyComposited = false;
            for (let i = 0; i < slideInputs.length; i++) {
              const s = slideInputs[i];
              const bg = await genBg(s.imageBrief, cardFormat);
              const text = s.onImageText ?? (i === 0 ? p.onImageText : undefined);
              let url: string | undefined;
              if (bg) {
                const r = await composeHost(bg, text, cardFormat, `${i + 1}/${total}`, i < total - 1);
                url = r.url;
                if (r.composited) anyComposited = true;
              }
              slides.push({ url: url ?? mockVisual(s.imageBrief, aspect), prompt: s.imageBrief });
              if (i === 0) coverUrl = url;
            }
            return {
              concept: p.concept,
              caption: p.caption,
              hashtags: p.hashtags ?? [],
              imageBrief: p.imageBrief,
              suggestedPostTime: p.suggestedPostTime,
              format,
              aspect,
              onImageText: p.onImageText,
              reel: p.reel,
              imageUrl: coverUrl,
              slides,
              composited: anyComposited,
            } satisfies InstagramPost;
          }

          // 피드/릴스 단일 — 배경(커버) 1장 + 합성
          const bg = await genBg(p.imageBrief, cardFormat);
          let url: string | undefined;
          let composited = false;
          if (bg) {
            const r = await composeHost(bg, p.onImageText, cardFormat, undefined, false);
            url = r.url;
            composited = r.composited;
          }
          // 릴스면 발행용 9:16 영상도 생성(Higgsfield generate_video) — 실패해도 커버는 유지
          let reelVideoUrl: string | undefined;
          if (format === "reel" && connected) {
            try {
              reelVideoUrl = await generateVideoViaHiggsfield({
                prompt: buildHiggsfieldPrompt({ format: "reel", scene: p.imageBrief }).prompt,
                aspect: "9:16",
              });
              // 발행용 mp4 를 로컬에도 저장(다운로드)
              const sp = await saveImageLocally(reelVideoUrl, "reel");
              if (sp) {
                savedCount += 1;
                if (!savedDir) savedDir = sp.replace(/\/[^/]+$/, "");
              }
            } catch {
              reelVideoUrl = undefined; // 영상 실패 → 커버만(발행 시 mock)
            }
          }
          return {
            concept: p.concept,
            caption: p.caption,
            hashtags: p.hashtags ?? [],
            imageBrief: p.imageBrief,
            suggestedPostTime: p.suggestedPostTime,
            format,
            aspect,
            onImageText: p.onImageText,
            reel: p.reel,
            reelVideoUrl,
            imageUrl: url, // 미생성 시 undefined → 목업이 그라데이션+오버레이로 표시
            composited,
          } satisfies InstagramPost;
        }),
      );

      const generated = enriched.filter(
        (p) => p.imageUrl && /^https?:\/\//i.test(p.imageUrl),
      ).length;
      const fmt = (f: VisualFormat) => enriched.filter((p) => p.format === f).length;
      const fmtSummary = [
        fmt("feed") ? `피드 ${fmt("feed")}` : "",
        fmt("carousel") ? `캐러셀 ${fmt("carousel")}` : "",
        fmt("reel") ? `릴스 ${fmt("reel")}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      ctx.onEvent({ type: "artifact", artifact: { kind: "instagram_posts", posts: enriched } });
      // 발행 체인용 공개 URL — 사용자가 "올려줘" 하면 모델이 이 URL 들을 publish_instagram_post 에 넘긴다.
      const isPubUrl = (u?: string) => !!u && /^https?:\/\//i.test(u);
      const publishRefs = enriched
        .map((p, i) => {
          if (p.format === "carousel") {
            const us = (p.slides ?? []).map((s) => s.url).filter(isPubUrl);
            return `${i + 1}. 캐러셀(CAROUSEL) imageUrls=[${us.join(", ")}]`;
          }
          if (p.format === "reel") {
            return `${i + 1}. 릴스(REELS) videoUrl=${isPubUrl(p.reelVideoUrl) ? p.reelVideoUrl : "(영상 없음)"}`;
          }
          return `${i + 1}. 피드(IMAGE) imageUrl=${isPubUrl(p.imageUrl) ? p.imageUrl : "(공개 URL 아님)"}`;
        })
        .join("\n");
      const note = connected
        ? `배경 ${generated}컷 생성 · ENTRID풍 한글카드 ${composedCount}장 합성${savedCount > 0 ? ` · 로컬 ${savedCount}장 저장: ${savedDir}` : ""}`
        : "Higgsfield 미연결 — 비주얼은 목업 플레이스홀더";
      return `인스타그램 ${enriched.length}개(${fmtSummary})를 한국 카드뉴스 스타일(배경+한글 카피 합성)로 만들어 폰 목업에 게시했다(${note}). 각 게시물 컨셉을 한 줄씩 요약${savedCount > 0 ? "하고 로컬 저장 위치를 알려" : ""}라.
발행을 원하면 publish_instagram_post(승인 게이트)로 아래 공개 URL 을 그대로 넘겨 올린다:
${publishRefs}
${connected ? "" : "실제 이미지를 원하면 설정에서 Higgsfield 연결을 안내하라."}`;
    }

    case "publish_instagram_post": {
      const raw = (input ?? {}) as {
        caption?: string;
        hashtags?: string[];
        imageUrl?: string;
        imageUrls?: string[];
        videoUrl?: string;
        mediaType?: "IMAGE" | "CAROUSEL" | "REELS";
        concept?: string;
      };
      const imageUrls = (raw.imageUrls ?? []).map((u) => String(u).trim()).filter(Boolean);
      const imageUrl = (raw.imageUrl ?? imageUrls[0] ?? "").trim();
      const videoUrl = (raw.videoUrl ?? "").trim();
      const baseCaption = (raw.caption ?? "").trim();
      // imageUrls 가 2장 이상이면 자동으로 캐러셀로 본다(모델이 mediaType 안 줘도)
      const mediaType: "IMAGE" | "CAROUSEL" | "REELS" =
        raw.mediaType ?? (imageUrls.length >= 2 ? "CAROUSEL" : "IMAGE");
      const haveMedia =
        mediaType === "REELS"
          ? !!videoUrl
          : mediaType === "CAROUSEL"
            ? imageUrls.length >= 2
            : !!imageUrl;
      if (!baseCaption || !haveMedia) {
        return "발행 실패: caption 과 발행 미디어가 필요하다(피드=공개 imageUrl, 캐러셀=공개 imageUrls 2장+, 릴스=공개 videoUrl). draft_instagram_with_visuals 로 먼저 만든 뒤 그 공개 URL 을 넘겨 호출하라.";
      }
      const tags = (raw.hashtags ?? [])
        .map((t) => `#${String(t).replace(/^#/, "")}`)
        .join(" ");
      const caption = tags ? `${baseCaption}\n\n${tags}` : baseCaption;
      const account = "popup__magazine"; // 연결된 계정(표시용)

      const draft: InstagramPublishDraft = {
        caption,
        imageUrl,
        imageUrls: mediaType === "CAROUSEL" ? imageUrls : undefined,
        videoUrl: videoUrl || undefined,
        mediaType,
        concept: raw.concept,
        account,
      };

      // 승인 게이트 — 사람이 /api/approve 로 회신할 때까지 대기 (5분 타임아웃 시 거부)
      const { request, promise } = createInstagramApproval(draft);
      ctx.onEvent({ type: "approval_required", approval: request });
      const approved = await promise;
      ctx.onEvent({ type: "approval_resolved", approvalId: request.id, approved });
      if (!approved) {
        return "사용자가 발행을 거부했다. 게시물은 발행되지 않았다. 어떤 부분을 수정하면 좋을지 물어보라.";
      }

      // 승인됨 → 실제 발행 시도. 조건 미충족/실패 시 mock 으로 처리하고 사실을 알린다.
      const publishedAt = new Date().toISOString();
      let result: InstagramPublishResult;
      try {
        const { mediaId, permalink } =
          mediaType === "CAROUSEL"
            ? await publishInstagramCarousel({ caption, imageUrls })
            : await publishInstagramMedia({
                caption,
                imageUrl: imageUrl || undefined,
                videoUrl: videoUrl || undefined,
                mediaType,
              });
        result = {
          caption,
          imageUrl,
          mock: false,
          permalink,
          mediaId,
          account,
          publishedAt,
          note: `Instagram 에 ${mediaType === "REELS" ? "릴스" : mediaType === "CAROUSEL" ? "캐러셀" : "게시물"}로 실제 발행되었습니다.`,
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        const human =
          reason === "NOT_CONFIGURED"
            ? "Instagram 토큰 미설정"
            : reason === "REELS_REQUIRES_VIDEO_URL"
              ? "릴스는 공개 video_url 필요(현재 커버 이미지만 지원)"
              : reason === "IMAGE_URL_NOT_PUBLIC"
                ? "비주얼이 공개 URL 이 아님(목업/로컬 이미지)"
                : reason === "CAROUSEL_NEEDS_2_10"
                  ? "캐러셀은 공개 이미지 2~10장 필요"
                  : reason;
        result = {
          caption,
          imageUrl,
          mock: true,
          account,
          publishedAt,
          note: `mock 발행 — 실제 게시되지 않음 (${human}).`,
        };
      }
      ctx.onEvent({ type: "artifact", artifact: { kind: "instagram_published", result } });
      ctx.onEvent({
        type: "instagram_published",
        account,
        permalink: result.permalink,
        mock: result.mock,
      });
      return result.mock
        ? `사용자가 승인했으나 mock 발행으로 처리됐다 (${result.note}). 실제 발행 조건(연결된 토큰 + 공개 http(s) 이미지 URL)을 사용자에게 한 줄로 안내하라.`
        : `사용자 승인 후 Instagram(@${account})에 실제 발행 완료${result.permalink ? ` — ${result.permalink}` : ""}. 짧게 보고하라.`;
    }

    case "draft_newsletter": {
      // 계산은 순수 빌더(finalizeNewsletterDraft)가 담당 — 글자수·스팸·읽기시간·톤플래그를 코드가 채움
      const draft = finalizeNewsletterDraft(
        input as Parameters<typeof finalizeNewsletterDraft>[0],
      );
      ctx.onEvent({ type: "artifact", artifact: { kind: "newsletter", draft } });
      const top = draft.subjectVariants[0];
      const spammy = draft.subjectVariants.filter(
        (v) => v.spamRisk !== "none",
      ).length;
      const toneNote = draft.toneFlags.length
        ? ` 톤 경고 ${draft.toneFlags.length}건(${draft.toneFlags.join(", ")}) — critique_copy 로 점검하거나 수정 제안하라.`
        : "";
      return `뉴스레터 초안을 게시했다. 제목 후보 ${draft.subjectVariants.length}개(대표: "${top?.text ?? ""}", ${top?.charCount ?? 0}자${top?.truncatedOnMobile ? "·모바일 잘림" : ""}, 스팸위험 ${top?.spamRisk ?? "none"}), 프레임워크 ${draft.framework}, 섹션 ${draft.sections.length}개, 예상 읽기 ${draft.estimatedReadSeconds}초.${spammy ? ` 스팸위험 제목 ${spammy}개.` : ""}${toneNote} A/B 로 테스트할 제목 2개를 한 줄로 추천하라. 수치는 표시된 값만 인용하라.`;
    }

    case "propose_cold_emails": {
      const { emails } = input as { emails: ColdEmail[] };

      // 1) 초안을 아티팩트 패널에 먼저 노출
      ctx.onEvent({
        type: "artifact",
        artifact: { kind: "cold_emails", emails },
      });

      // 2) 승인 게이트 — 사람이 /api/approve 로 회신할 때까지 대기 (5분 타임아웃 시 거부)
      const { request, promise } = createApproval(emails);
      ctx.onEvent({ type: "approval_required", approval: request });
      const approved = await promise;
      ctx.onEvent({
        type: "approval_resolved",
        approvalId: request.id,
        approved,
      });

      if (!approved) {
        return "사용자가 발송을 거부했다. 메일은 한 통도 발송되지 않았다. 사용자에게 어떤 부분을 수정하면 좋을지 물어보라.";
      }

      // 3) 승인 시 발송 — sendColdEmail 이 유일한 발송 경로 (화이트리스트 외 전부 mock)
      const lines: string[] = [];
      for (const email of emails) {
        const { mock } = await sendColdEmail(email);
        ctx.onEvent({
          type: "email_sent",
          to: email.to,
          company: email.company,
          subject: email.subject,
        });
        lines.push(
          `- ${email.company} <${email.to}> ${mock ? "(mock 발송)" : "(실발송)"} : "${email.subject}"`,
        );
      }
      return `사용자가 발송을 승인했다. 콜드메일 ${emails.length}건 발송 완료:\n${lines.join(
        "\n",
      )}\n팔로업 일정까지 포함해 짧게 보고하라.`;
    }

    case "show_metrics": {
      ctx.onEvent({
        type: "artifact",
        artifact: { kind: "metrics", metrics: ctx.scenario.mockGa },
      });
      return `성과 지표 대시보드(${ctx.scenario.mockGa.brandName}, ${ctx.scenario.mockGa.weeks.length}주 타임라인)를 아티팩트 패널에 표시했다. 주의: "${ctx.scenario.mockGa.note}". 핵심 추이를 1~2문장으로 짚어라.`;
    }

    case "list_outbound_contacts": {
      return JSON.stringify(ctx.scenario.mockContacts);
    }

    case "read_crm": {
      return JSON.stringify(ctx.scenario.mockCrm);
    }

    case "analyze_keywords": {
      // 계산은 순수 빌더(buildKeywordReport)가 담당 — 결과·이벤트·반환 문자열 동작 불변
      const { sortBy = "opportunity", intent, audience } = (input ?? {}) as {
        sortBy?: "opportunity" | "volume" | "rankDelta";
        intent?: "정보" | "탐색" | "거래";
        audience?: "B2B" | "B2C";
      };
      const report = buildKeywordReport(ctx.scenario, { sortBy, intent, audience });
      const rows = report.rows;
      ctx.onEvent({ type: "artifact", artifact: { kind: "keywords", report } });

      if (rows.length === 0) {
        return `키워드 ${report.totalTracked.toLocaleString()}개 추적분에서 조건에 맞는 키워드가 없다. 필터를 빼고 다시 조회하라.`;
      }
      return `키워드 ${report.totalTracked.toLocaleString()}개 추적분 중 기회 상위 ${rows.length}개를 표시했다. 1위 기회 키워드: "${rows[0].keyword}" (스코어 ${rows[0].opportunityScore}). 이 키워드를 오늘의 콘텐츠 소재로 연결할지 한 줄로 제안하라.`;
    }

    case "analyze_funnel": {
      // 계산은 순수 빌더(buildFunnelReport)가 담당 — 결과·이벤트·반환 문자열 동작 불변
      const report = buildFunnelReport(ctx.scenario);
      ctx.onEvent({ type: "artifact", artifact: { kind: "funnel", report } });

      const { stages, bottleneckStage } = report;
      // minRate = 병목 구간의 전환율 (빌더의 최솟값 탐색과 동일한 값)
      const minRate = Math.min(
        ...stages
          .filter((s) => s.conversionFromPrev !== null)
          .map((s) => s.conversionFromPrev as number),
      );
      const last = stages[stages.length - 1];
      return `퍼널 ${stages.length}단계를 표시했다. 최종 전환 ${last.count}건, 병목은 "${bottleneckStage}" 구간(전환율 ${minRate}%). 병목 해소 액션 1가지를 제안하라. 수치는 표시된 값만 인용하라.`;
    }

    case "track_content_performance": {
      // 계산은 순수 빌더(buildContentPerformanceReport)가 담당 — 결과·이벤트·반환 문자열 동작 불변
      const report = buildContentPerformanceReport(ctx.scenario);
      const top = report.posts[0];
      ctx.onEvent({
        type: "artifact",
        artifact: { kind: "content_performance", report },
      });
      return `게시물 ${report.posts.length}건의 D+1/D+7 리포트를 표시했다. 최고 저장률: "${top.concept}" (${top.saveRateD7}%, 포맷: ${report.topPattern}). 다음 인스타그램 초안을 만들 때 이 포맷을 1번 게시물 컨셉에 반영하고, 반영했다는 사실을 사용자에게 한 줄로 알려라.`;
    }

    case "schedule_follow_ups": {
      // 오늘의 팔로업 큐 산출 — 조회형. 발송은 없으며 후속 발송은 propose_cold_emails 게이트만 사용
      const { asOf: asOfInput } = (input ?? {}) as { asOf?: string };
      const asOfDate = asOfInput ? new Date(asOfInput) : new Date();
      const asOf = asOfDate.toISOString().slice(0, 10);

      interface FollowUpItem {
        name: string;
        company: string;
        email: string;
        stage: CrmLead["stage"];
        score: number;
        daysSinceLastTouch: number;
        action: string;
        dueInDays?: number;
      }
      const due: FollowUpItem[] = [];
      const upcoming: FollowUpItem[] = [];

      for (const lead of ctx.scenario.mockCrm.leads) {
        if (lead.stage === "won") continue; // 성사 리드는 제외

        const daysSince = Math.floor(
          (asOfDate.getTime() - new Date(lead.lastTouch).getTime()) / 86400000,
        );
        const base = {
          name: lead.name,
          company: lead.company,
          email: lead.email,
          stage: lead.stage,
          score: lead.score,
          daysSinceLastTouch: daysSince,
        };

        if (lead.stage === "new") {
          due.push({ ...base, action: "첫 콜드메일 대상" });
        } else if (lead.stage === "contacted") {
          if (daysSince >= 3) due.push({ ...base, action: "1차 팔로업" });
          else
            upcoming.push({
              ...base,
              action: "1차 팔로업",
              dueInDays: 3 - daysSince,
            });
        } else if (lead.stage === "replied") {
          if (daysSince >= 4)
            due.push({ ...base, action: "후속 제안 (협업 구체화)" });
          else
            upcoming.push({
              ...base,
              action: "후속 제안 (협업 구체화)",
              dueInDays: 4 - daysSince,
            });
        } else if (lead.stage === "meeting") {
          if (daysSince >= 2) due.push({ ...base, action: "미팅 리마인드" });
          else
            upcoming.push({
              ...base,
              action: "미팅 리마인드",
              dueInDays: 2 - daysSince,
            });
        }
      }

      return JSON.stringify({ asOf, due, upcoming });
    }

    case "plan_content_calendar": {
      // 주간 콘텐츠 캘린더 — 모델 생성형 입력을 받아 아티팩트로 게시
      const { weekLabel, entries } = input as Omit<ContentCalendar, "brandName">;
      const calendar: ContentCalendar = {
        brandName: ctx.scenario.mockGa.brandName,
        weekLabel,
        entries,
      };
      ctx.onEvent({ type: "artifact", artifact: { kind: "calendar", calendar } });
      return `"${weekLabel}" 캘린더(${entries.length}건)를 게시했다. 채널 구성을 한 줄로 요약하고, 가장 먼저 초안 작업할 항목 1개를 제안하라.`;
    }

    case "monitor_competitors": {
      return JSON.stringify(ctx.scenario.mockMentions);
    }

    case "analyze_lead_journey": {
      // 통계·핫리드 선별은 순수 빌더(buildLeadJourneyReport)가 결정론적으로 계산
      const report = buildLeadJourneyReport(ctx.scenario);
      ctx.onEvent({
        type: "artifact",
        artifact: { kind: "lead_journey", report },
      });
      const { stats, hotLeads } = report;
      return `리드 여정 리포트(${report.period})를 표시했다. 전환 유저 평균 패턴: 방문 ${stats.avgVisitsBeforeConversion}회 · ${stats.avgDaysToConversion}일 · 방문당 체류 ${stats.avgSessionMinutes}분. 미전환 핫리드 ${hotLeads.length}명(체류분 상위, 임계 ${stats.highEngagementThreshold}분)을 함께 표시했다. 이 패턴(평균 ${stats.avgVisitsBeforeConversion}회 방문·${stats.avgDaysToConversion}일)을 인용해 hot lead 1명에 대한 다음 액션을 제안하라.`;
    }

    case "analyze_keyword_journey": {
      const { seedKeyword } = (input ?? {}) as { seedKeyword?: string };
      const report = buildKeywordJourneyReport(ctx.scenario, seedKeyword);
      ctx.onEvent({
        type: "artifact",
        artifact: { kind: "keyword_journey", report },
      });
      const topNext = report.nodes[0]?.next[0];
      return `"${report.seedKeyword}" 시드의 탐색 경로(노드 ${report.nodes.length}개)를 표시했다.${
        topNext ? ` 최상위 전이: "${topNext.keyword}" (${topNext.rate}%).` : ""
      } B2B 분기 신호 ${report.b2bSignals.length}건 · B2C ${report.b2cSignals.length}건. 다음 검색을 선점할 콘텐츠 1건을 제안하라.`;
    }

    case "analyze_content_attribution": {
      // 전환율 계산·정렬·인사이트는 순수 빌더(buildAttributionReport)가 담당
      const report = buildAttributionReport(ctx.scenario);
      ctx.onEvent({
        type: "artifact",
        artifact: { kind: "attribution", report },
      });
      const top = report.topConverters[0];
      return `콘텐츠 기여 리포트(${report.topConverters.length}건, ${report.period})를 표시했다. 전환율 1위: "${top.title}" (${top.conversionRate}%). 인사이트: ${report.insight} 이 인사이트를 다음 콘텐츠 기획 제안 한 줄로 연결하라.`;
    }

    case "track_follower_growth": {
      const report = buildFollowerGrowthReport(ctx.scenario);
      ctx.onEvent({
        type: "artifact",
        artifact: { kind: "follower_growth", report },
      });
      const last = report.snapshots[report.snapshots.length - 1];
      return `채널 성장 리포트(스냅샷 ${report.snapshots.length}일)를 표시했다. 최신: 인스타그램 ${last.instagram}명 · 뉴스레터 ${last.newsletterSubs}명, 최근 7일 성장률 ${report.weeklyGrowthRatePct}%. 추이 해석을 1~2문장으로 짚어라.`;
    }

    case "query_ga_bigquery": {
      // BigQuery 설정 시 실데이터, 미설정/실패 시 mockLeadJourney 기반 폴백 (source: "mock")
      const { sql } = (input ?? {}) as { sql?: string };
      try {
        if (!sql) throw new Error("SQL_REQUIRED (sql 입력 누락)");
        const rows = await queryGaBigQuery(sql);
        return JSON.stringify({ source: "bigquery", rowCount: rows.length, rows });
      } catch (err) {
        const pack = ctx.scenario.mockLeadJourney;
        return JSON.stringify({
          source: "mock",
          reason: err instanceof Error ? err.message : String(err),
          note: `${pack.note} — BigQuery 미설정/조회 실패로 모의 데이터를 반환함 (mock)`,
          period: pack.period,
          rows: pack.sessions,
        });
      }
    }

    case "fetch_search_console": {
      // 서비스계정 키 설정 시 실데이터, 미설정/실패 시 mockKeywords 기반 폴백 (source: "mock")
      const { siteUrl, days = 28 } = (input ?? {}) as {
        siteUrl?: string;
        days?: number;
      };
      try {
        if (!siteUrl) throw new Error("SITE_URL_REQUIRED (siteUrl 입력 누락)");
        const rows = await fetchSearchConsole(siteUrl, days);
        return JSON.stringify({ source: "search_console", siteUrl, days, rows });
      } catch (err) {
        const pack = ctx.scenario.mockKeywords;
        // 결정론적 mock CTR 곡선: 순위 구간별 클릭률로 클릭 수 추정
        const rows = pack.seeds.map((seed) => ({
          query: seed.keyword,
          clicks:
            seed.rank === null
              ? 0
              : Math.max(
                  1,
                  Math.round(
                    seed.monthlySearches *
                      (seed.rank <= 3 ? 0.12 : seed.rank <= 10 ? 0.05 : 0.01),
                  ),
                ),
          impressions: seed.monthlySearches,
          position: seed.rank,
        }));
        return JSON.stringify({
          source: "mock",
          reason: err instanceof Error ? err.message : String(err),
          note: `${pack.note} — Search Console 미설정/조회 실패로 모의 데이터를 반환함 (mock)`,
          rows,
        });
      }
    }

    case "fetch_instagram_insights": {
      // 액세스 토큰 설정 시 실데이터, 미설정/실패 시 mockPostPerformance 기반 폴백 (source: "mock")
      try {
        const rows = await fetchInstagramInsights();
        return JSON.stringify({ source: "instagram", rows });
      } catch (err) {
        const pack = ctx.scenario.mockPostPerformance;
        const rows = pack.posts.map((post) => {
          const m = post.metricsD7 ?? post.metricsD1;
          return {
            id: post.postId,
            caption: post.concept,
            timestamp: post.publishedAt,
            like_count: m.likes,
            reach: m.reach,
            saves: m.saves,
          };
        });
        return JSON.stringify({
          source: "mock",
          reason: err instanceof Error ? err.message : String(err),
          note: `${pack.note} — Instagram 토큰 미설정/조회 실패로 모의 데이터를 반환함 (mock)`,
          rows,
        });
      }
    }

    case "audit_tracking_setup": {
      const { url } = (input ?? {}) as { url?: string };
      if (!url) {
        return "추적 감사 실패: url 입력이 없다. 분석할 공개 http(s) URL 을 사용자에게 확인한 뒤 다시 호출하라.";
      }
      try {
        // URL 검증(http/https·비로컬)과 렌더는 connectors.renderSiteDom 이 수행 — 분석 전용, 쓰기 없음
        const { html, via } = await renderSiteDom(url);
        const report = buildTrackingAuditReport(url, html, via);
        ctx.onEvent({
          type: "artifact",
          artifact: { kind: "tracking_audit", report },
        });
        const topGap = report.gaps[0];
        return `"${url}" 추적 감사 리포트를 표시했다 (렌더: ${via === "chrome" ? "Chrome 헤드리스" : "fetch 폴백"}). 커버리지 ${report.coverageScore}점, 기존 신호 ${report.existingSignals.length}개, 미추적 후보 ${report.gaps.length}건${
          topGap
            ? ` — 최우선: ${topGap.element} → ${topGap.recommendedEvent} 이벤트`
            : ""
        }. critical 항목부터 리포트의 GTM 태그 설정 JSON 을 적용하도록 제안하라.`;
      } catch (err) {
        // 도구 실패가 런을 죽이지 않도록 — 명확한 한국어 에러 문자열로 반환
        const reason = err instanceof Error ? err.message : String(err);
        return `추적 감사 실패: ${reason}. 공개 http(s) URL 인지(localhost/사설 IP 불가), 사이트가 응답하는지 확인하고 다시 시도하라.`;
      }
    }

    case "optimize_subject_lines": {
      // 점수는 순수 빌더(buildSubjectLab)가 결정론적으로 계산 — 모델은 인용만
      const { topic, goal, variants } = (input ?? {}) as {
        topic?: string;
        goal?: SubjectLabReport["goal"];
        variants?: { text: string; angle: SubjectVariant["angle"] }[];
      };
      if (!topic || !variants?.length) {
        return "제목 랩 실패: topic 과 variants(제목 후보 배열)가 필요하다. angle 별로 후보를 제시하고 다시 호출하라.";
      }
      const lab = buildSubjectLab({ topic, goal, variants });
      ctx.onEvent({ type: "artifact", artifact: { kind: "subject_lab", lab } });
      const best = lab.rows[0];
      return `제목 ${lab.rows.length}개를 스코어링했다. 예상 상대오픈 1위: "${best?.text ?? ""}" (추정 ${best?.projectedOpenScore ?? 0}점, ${best?.charCount ?? 0}자, 스팸위험 ${best?.spamRisk ?? "none"}). A/B 추천: ${lab.recommended.map((t) => `"${t}"`).join(" vs ")}. 예상 오픈은 휴리스틱 추정값이라고 밝히고, 표시된 점수만 인용하라.`;
    }

    case "critique_copy": {
      // 위반 목록·통과 점수는 순수 빌더(buildCopyCritique)가 결정론 룰셋으로 산출
      const { kind, text, subject, preheader } = (input ?? {}) as {
        kind?: CopyCritiqueReport["target"];
        text?: string;
        subject?: string;
        preheader?: string;
      };
      if (!kind || !text) {
        return "카피 점검 실패: kind(newsletter/cold_email/instagram)와 text 가 필요하다. 점검할 카피를 넣어 다시 호출하라.";
      }
      const report = buildCopyCritique(kind, text, subject, preheader);
      ctx.onEvent({ type: "artifact", artifact: { kind: "copy_critique", report } });
      const top = report.issues[0];
      return `카피 점검 리포트를 표시했다. 통과 점수 ${report.passScore}점, 위반 ${report.issues.length}건.${top ? ` 최우선: ${top.rule}(${top.severity}) — ${top.suggestion}` : " 발견된 위반 없음."} 점수/카운트는 표시된 값만 인용하고, 위반이 있으면 수정 방향을 제안하라(콘텐츠를 새로 생성하지는 말 것).`;
    }

    case "plan_email_sequence": {
      // 카덴스 정합·단어수만 빌더가 계산 — 발송하지 않음(실발송은 propose_cold_emails 게이트만)
      const { type, audience, steps } = (input ?? {}) as {
        type?: EmailSequencePlan["type"];
        audience?: string;
        steps?: Omit<EmailSequenceStep, "wordCount" | "cadenceWarning">[];
      };
      if (!type || !audience || !steps?.length) {
        return "시퀀스 설계 실패: type(cold/nurture)·audience·steps 가 필요하다. 메일 단계를 넣어 다시 호출하라.";
      }
      const sequence = buildEmailSequencePlan({ type, audience, steps });
      ctx.onEvent({
        type: "artifact",
        artifact: { kind: "email_sequence", sequence },
      });
      const warnN = sequence.steps.filter((s) => s.cadenceWarning).length;
      return `${type === "cold" ? "콜드" : "너처"} 이메일 시퀀스(${sequence.steps.length}단계, 총 ${sequence.totalDays}일)를 표시했다.${warnN ? ` 카덴스/길이 경고 ${warnN}건 — 수정 제안하라.` : ""} 이 시퀀스는 계획일 뿐 발송하지 않는다 — 실제 발송은 각 메일을 propose_cold_emails 로 제출해 승인받아야 한다고 사용자에게 안내하라.`;
    }

    case "analyze_newsletter_performance": {
      // 오픈율/CTR·추세·추천은 순수 빌더(buildNewsletterPerformanceReport)가 결정론 계산
      const report = buildNewsletterPerformanceReport(ctx.scenario);
      ctx.onEvent({
        type: "artifact",
        artifact: { kind: "newsletter_performance", report },
      });
      return `뉴스레터 성과 리포트(발송 ${report.rows.length}건)를 표시했다. 평균 오픈율 ${report.avgOpenRate}%·CTR ${report.avgCtr}% (벤치마크 ${report.benchmarkOpenRate}%). ${report.trend} 차기 권장 제목 트리거: ${report.nextSubjectTriggers.slice(0, 2).join("·")}, 우선 세그먼트: "${report.recommendedSegments[0]?.segment ?? "-"}". 새 뉴스레터 초안을 만들 때 이 추천을 반영하고, 반영 사실을 한 줄로 알려라. 수치는 표시된 값만 인용하라.`;
    }

    default:
      return `알 수 없는 도구: ${name} — 사용 가능한 도구 중에서 선택하라.`;
  }
}
