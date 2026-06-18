// lib/agent/personas.ts — 단일 페르소나 레지스트리(검토팀 직무 + OASIS 방문객 통합).
//
// 결정(2026-06-18): 검토팀(직무)·OASIS(방문객)를 한 모델로. 차이는 kind 한 플래그뿐.
//   · kind="role"     — 우리 팀 직무(전략·콘텐츠·원가·리스크…). lens·scope(담당 슬롯) 보유.
//   · kind="audience" — 고객 방문객 군집(OASIS P1~P5). 보드 드래그로 결과물에 반응.
// 모든 페르소나가 OASIS급 '근거'(segment 군집 + evidence 표본/사례)를 가진다 — 코멘트가
// "내 생각"이 아니라 "우리 N건/방문객 데이터상 이렇다"로 샤프해지게(북극성). 출처는 정직히 라벨.
//
// btl-personas.ts 는 이 파일의 role 들을 재노출(back-compat). 방문객은 OASIS 에서 매핑.

import type { WorkflowSlotId } from "@/lib/ide/workflow";
import { OASIS, samplesByType, archetypeColor } from "@/lib/oasis";

export type PersonaKind = "audience" | "role";
/** 직무 키(role 전용). */
export type RoleKey = "strategy" | "content" | "visitor" | "client_voice" | "cost" | "risk";

/** 근거 표본 1건 — 방문객=사람 표본, 직무=사례/이력. 제네릭. */
export interface PersonaEvidence {
  label: string;   // 표본/사례 제목 (예: "정지현·29" | "성수 K-뷰티 팝업(2025)")
  detail: string;  // 한 줄 근거
  metric?: string; // 수치(있으면) (예: "월 6회 방문" | "수주")
}
/** 대표 군집 — 방문객=설문 군집, 직무=이력 풀. */
export interface PersonaSegment { label: string; size?: number; desc?: string }

export interface Persona {
  id: string;
  name: string;
  title: string;
  kind: PersonaKind;
  accent: string;
  lens?: string;                 // 검토 관점(주로 role)
  scope?: WorkflowSlotId[];      // 담당 슬롯(role)
  segment: PersonaSegment;       // 대표 군집(근거)
  evidence: PersonaEvidence[];   // 근거 표본/사례
  source: string;                // 출처 라벨(정직 — 실데이터/Mock)
  role?: RoleKey;                // role 전용 직무 키
  dataSource?: string;           // back-compat(=source 라벨)
}

// ── 역할(우리 팀 직무) ─────────────────────────────────────────────────────
const ROLES: Persona[] = [
  {
    id: "strategy-doyun", name: "도윤", title: "전략 파트너", kind: "role", role: "strategy",
    lens: "제안 각도·차별화 포인트·수주 승률. 왜 우리가 이겨야 하는가.",
    scope: ["rfp", "proposal"], accent: "#d9472a",
    segment: { label: "과거 비딩 이력", size: 18, desc: "최근 2년 참여 비딩" },
    evidence: [
      { label: "성수 뷰티 팝업 비딩(2025)", detail: "컨셉 차별화 한 줄로 승부 → 수주", metric: "수주" },
      { label: "리테일 IP 팝업 비딩", detail: "가격만 강조하다 차별점 약해 탈락", metric: "탈락" },
    ],
    source: "과거 비딩 이력 · 경쟁 제안 (Mock)",
  },
  {
    id: "content-yuna", name: "유나", title: "콘텐츠 디렉터", kind: "role", role: "content",
    lens: "컨셉·연출·서사 일관성. RFP 서사 파트를 살렸는가, 메시지가 또렷한가.",
    scope: ["proposal"], accent: "#b8791f",
    segment: { label: "포트폴리오 · 레퍼런스 풀", size: 40, desc: "연출 레퍼런스" },
    evidence: [
      { label: "몰입형 전시 레퍼런스", detail: "입구 1문장 후킹이 체류·공유를 끌어올림" },
      { label: "브랜드 팝업 서사", detail: "존별 메시지 분절 시 회상률 하락" },
    ],
    source: "포트폴리오 · 레퍼런스 풀 (Mock)",
  },
  {
    id: "visitor-sua", name: "수아", title: "방문객 시선", kind: "role", role: "visitor",
    lens: "현장 방문자 관점 — 체험 매력, 동선, 사진/공유 욕구.",
    scope: ["proposal", "operation"], accent: "#2f8f57",
    segment: { label: "팝가 방문 행동데이터", desc: "OASIS 방문객 군집 연계" },
    evidence: [
      { label: "대기/혼잡", detail: "체험 동선 병목 시 이탈·노쇼 증가", metric: "노쇼↑" },
      { label: "포토존", detail: "공유 욕구 자극 지점이 자연 확산 견인" },
    ],
    source: "팝가 BigQuery(웨이팅·노쇼·찜) · OASIS",
  },
  {
    id: "client-jiho", name: "지호", title: "클라이언트 보이스", kind: "role", role: "client_voice",
    lens: "고객사 관점 — 목표 부합, 예산 현실성, 내부 설득 가능성.",
    scope: ["proposal", "quote"], accent: "#2f6bff",
    segment: { label: "미팅 녹음 · 고객 피드백", size: 12, desc: "고객사 인터뷰" },
    evidence: [
      { label: "내부 보고 포맷", detail: "KPI·예산이 한 장에 안 잡히면 결재 지연" },
      { label: "예산 현실성", detail: "범위 초과 견적은 협상 전 탈락" },
    ],
    source: "미팅 녹음 · 고객 피드백 (Mock)",
  },
  {
    id: "cost-minjae", name: "민재", title: "원가 애널리스트", kind: "role", role: "cost",
    lens: "단가 타당성·항목 누락·마진. 견적이 RFP 의무 항목을 다 덮는가.",
    scope: ["quote", "operation"], accent: "#7a5cff",
    segment: { label: "단가 마스터 · RAG 사전견적기", desc: "시공·운영 단가 풀" },
    evidence: [
      { label: "시공 단가", detail: "평당 시공비 시장 범위 대비 저가 시 품질 리스크" },
      { label: "항목 누락", detail: "철거·보험 누락이 마진을 잠식" },
    ],
    source: "단가 마스터 · RAG 사전견적기",
  },
  {
    id: "risk-hyunwoo", name: "현우", title: "리스크 매니저", kind: "role", role: "risk",
    lens: "과거 실패(조형물 사고·날치기 계약)·계약 유의사항·안전/일정 리스크.",
    scope: ["rfp", "quote", "operation", "contract"], accent: "#c0392b",
    segment: { label: "결과보고서 · 계약 이력", size: 9, desc: "사고·분쟁 사례" },
    evidence: [
      { label: "조형물 안전사고", detail: "대형 구조물 검수 누락 → 현장 사고", metric: "사고" },
      { label: "권리귀속 분쟁", detail: "IP 귀속 조항 모호로 정산 분쟁", metric: "분쟁" },
    ],
    source: "결과보고서 · 계약 이력 (Mock)",
  },
];

// ── 방문객(고객 군집) — OASIS archetype 을 동일 Persona 모델로 매핑 ──────────
function audienceFromOasis(): Persona[] {
  return OASIS.archetypes.map((a) => {
    const samples = samplesByType(a.type).slice(0, 2);
    return {
      id: `oasis-${a.type.toLowerCase()}`,
      name: a.label,
      title: "방문객 군집",
      kind: "audience" as const,
      accent: archetypeColor(a.type),
      // 방문객 렌즈 — 이 군집이 산출물(기획안/공간/콘텐츠 등)을 '실제 방문객' 시점으로 읽는 기준.
      lens: `${a.label} 군집(${a.desc})의 방문객 시점 — 이 결과물이 '나'를 실제로 오게/머물게/공유하게 만드는지, 군집 데이터 근거로만 반응`,
      segment: { label: a.label, size: a.count, desc: a.desc },
      evidence: samples.map((s) => ({
        label: `${s.name}·${s.age}`,
        detail: s.key_pain_points[0] ?? s.background.slice(0, 40),
        metric: `월 ${s.monthly_popup_visits}회 방문`,
      })),
      source: `${OASIS.source} (가상 설문 ${OASIS.total}명)`,
    };
  });
}

export const ROLE_PERSONAS: Persona[] = ROLES;
export const AUDIENCE_PERSONAS: Persona[] = audienceFromOasis();
export const ALL_PERSONAS: Persona[] = [...ROLE_PERSONAS, ...AUDIENCE_PERSONAS];

export function rolePersonas(): Persona[] { return ROLE_PERSONAS; }
export function audiencePersonas(): Persona[] { return AUDIENCE_PERSONAS; }
export function personaById(id: string): Persona | undefined {
  return ALL_PERSONAS.find((p) => p.id === id);
}
/** 슬롯 담당 역할 페르소나(검토팀). */
export function personasForSlot(slotId: WorkflowSlotId): Persona[] {
  return ROLE_PERSONAS.filter((p) => p.scope?.includes(slotId));
}

/** 페르소나를 보드 카드로 드래그할 때의 dataTransfer 타입(페르소나 id 를 실어 나른다). */
export const PERSONA_DND = "application/x-octopus-persona";
