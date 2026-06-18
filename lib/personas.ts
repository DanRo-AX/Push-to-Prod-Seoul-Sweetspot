// octopus 멀티 에이전트 페르소나 카탈로그 (클라이언트 안전 순수 모듈).
//
// IDE 우측 사이드패널의 "페르소나 스택"이 이 카탈로그에서 파생된다.
// 도구 실행 이벤트(tool_start/tool_end 의 toolName)가 들어오면
// personaForTool(toolName) 으로 어느 페르소나가 일하고 있는지 매핑한다.
//
// 규칙:
// - 순수 데이터/매핑만. React/DOM/SVG 마크업 없음(아바타 마크업은 컴포넌트에서).
//   여기서는 색(accent)과 avatar 키(인라인 SVG 선택용 식별자)만 제공한다.
// - lib/agent/tools.ts 의 25개 도구를 5개 페르소나가 빠짐없이 분담한다.
//   (그로스 엔지니어 케이는 /studio 코드 편집 흐름 담당 — 25개 표준 도구 외).
// - 한쪽만 고치면 매핑이 깨지므로, 도구가 추가/삭제되면 이 표를 함께 갱신한다.

export type PersonaId =
  | "researcher"
  | "analyst"
  | "copywriter"
  | "outreach"
  | "engineer";

export interface Persona {
  id: PersonaId;
  name: string; // 한국어 표시명 (예: "리서처 리아")
  role: string; // 직무 한 줄
  toolNames: string[]; // 이 페르소나가 담당하는 도구명 (lib/agent/tools.ts 기준)
  accent: string; // 페르소나 색 (HEX) — 스택 카드/아바타 액센트
  avatar: PersonaId; // 인라인 SVG 아바타 선택 키 (컴포넌트에서 마크업 매핑)
  blurb: string; // 스택 카드에 들어갈 한 줄 소개
}

// 5개 페르소나로 25개 도구를 분담 (4 + 11 + 6 + 4 = 25).
// 엔지니어 케이는 표준 25개 외의 코드/스튜디오 작업 담당이라 toolNames 가 비어 있다.
export const PERSONAS: Persona[] = [
  {
    id: "researcher",
    name: "리서처 리아",
    role: "시장·키워드·경쟁 신호 리서치",
    accent: "#4ec9b0", // VS Code 청록 (type 토큰 계열)
    avatar: "researcher",
    blurb: "트렌드와 키워드를 훑어 오늘 무엇을 만들지 단서를 찾아옵니다.",
    toolNames: [
      "monitor_competitors",
      "analyze_keywords",
      "analyze_keyword_journey",
      "publish_briefing",
    ],
  },
  {
    id: "analyst",
    name: "애널리스트 노아",
    role: "데이터·퍼널·기여 분석",
    accent: "#569cd6", // VS Code 블루 (keyword 토큰 계열)
    avatar: "analyst",
    blurb: "GA·CRM·검색콘솔 숫자를 모아 병목과 기회를 짚어냅니다.",
    toolNames: [
      "analyze_funnel",
      "show_metrics",
      "analyze_lead_journey",
      "analyze_content_attribution",
      "track_content_performance",
      "track_follower_growth",
      "fetch_search_console",
      "query_ga_bigquery",
      "fetch_instagram_insights",
      "audit_tracking_setup",
      "read_crm",
    ],
  },
  {
    id: "copywriter",
    name: "카피라이터 미오",
    role: "콘텐츠·뉴스레터·캘린더 카피",
    accent: "#dcdcaa", // VS Code 옐로 (function 토큰 계열)
    avatar: "copywriter",
    blurb: "인스타·뉴스레터 초안을 쓰고 제목과 톤을 다듬습니다.",
    toolNames: [
      "draft_instagram_posts",
      "draft_newsletter",
      "plan_content_calendar",
      "optimize_subject_lines",
      "critique_copy",
      "analyze_newsletter_performance",
    ],
  },
  {
    id: "outreach",
    name: "아웃리치 진",
    role: "콜드메일·시퀀스·팔로업",
    accent: "#d9472a", // 우리 버밀리언 액센트 (발송 경로 — 절제해서 1곳에만)
    avatar: "outreach",
    blurb: "콜드메일을 설계하고 시퀀스·팔로업을 잡아 승인 게이트로 넘깁니다.",
    toolNames: [
      "propose_cold_emails",
      "plan_email_sequence",
      "schedule_follow_ups",
      "list_outbound_contacts",
    ],
  },
  {
    id: "engineer",
    name: "그로스 엔지니어 케이",
    role: "코드·스튜디오 편집",
    accent: "#c586c0", // VS Code 퍼플 (control 토큰 계열)
    avatar: "engineer",
    blurb: "인사이트를 받아 실제 페이지 코드를 고치고 프리뷰로 확인합니다.",
    toolNames: [], // /studio 코드 편집 흐름 담당 — 표준 25개 도구 외
  },
];

// 도구명 → 페르소나 역인덱스 (모듈 로드 시 1회 구성).
const TOOL_TO_PERSONA: Record<string, Persona> = (() => {
  const map: Record<string, Persona> = {};
  for (const persona of PERSONAS) {
    for (const tool of persona.toolNames) {
      map[tool] = persona;
    }
  }
  return map;
})();

// 도구명으로 담당 페르소나를 찾는다. 매핑이 없으면 null.
export function personaForTool(toolName: string): Persona | null {
  return TOOL_TO_PERSONA[toolName] ?? null;
}

// id 로 페르소나를 찾는다(스택 렌더링 보조).
export function personaById(id: PersonaId): Persona | null {
  return PERSONAS.find((p) => p.id === id) ?? null;
}
