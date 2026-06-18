// lib/collab.ts — 작업 보드 위 "멀티 에이전트 협업"(피그마 풍) 데이터/문구.
//
// 테마: "고객들과 함께 쌓아가는 오프라인 경험을 만들자."
// 우리는 팝업 스토어 회사 — OASIS 오디언스 에이전트(P1~P5)는 각자 담당 "고객 세그먼트"의
// 전문 리뷰어로서 보드의 결과물(RFP 분석·제안서·비딩·운영안·마케팅 산출물)을 검토한다.
// 세그먼트가 현장에서 어떻게 반응할지 = 평가/수주/성과로 직결되므로, 피드백은
//   · 깊고 전문적이며(평가 KPI·동선·체류·전환·시공·비딩 단가·LTV에 결부),
//   · 코멘트 핀으로 남기고, 서로의 코멘트에 답글로 토론하며(크로스펑셔널 리뷰),
//   · 오케스트레이터에게 구체적 재작업 명령을 올린다(에스컬레이션) → 후보안(개선안)으로 반영.
//
// 이 파일은 순수 데이터/문구/헬퍼만 — 시뮬은 lib/useCollab.ts, 렌더는 CanvasBoard. 이모지 금지.

import type { OasisType } from "@/lib/oasis";

/** 보드 카드의 캔버스 좌표 사각형(협업 레이어가 핀/커서 위치 계산에 사용). */
export interface CardRect {
  kind: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 협업 에이전트(라이브 커서). */
export interface CollabAgent {
  id: string;
  type: OasisType;
  x: number;
  y: number;
  focusKind: string | null;
}

/** 코멘트 스레드의 답글(다른 에이전트가 단다). */
export interface CollabReply {
  authorType: OasisType;
  text: string;
}

/** 카드에 붙는 코멘트 핀(스레드). */
export interface CollabComment {
  id: string;
  kind: string;
  label: string;
  authorType: OasisType;
  text: string;
  x: number;
  y: number;
  replies: CollabReply[];
  age: number;
}

/** 오케스트레이터로 올라간 새 명령(재작업 요청). */
export interface CollabEscalation {
  id: string;
  fromType: OasisType;
  text: string;
  targetKind: string;
  targetLabel: string;
  age: number;
  dispatched: boolean;
}

/** 오케스트레이터가 명령을 받아 만든 "개선안"(원본 옆, 실제로 달라진 변형 카드). */
export interface CollabCandidate {
  id: string;
  sourceKind: string;
  label: string;
  fromType: OasisType;
  note: string; // 반영한 피드백(에스컬레이션 문구 = 무엇을 왜)
  changes: string[]; // 실제로 적용한 구체 변경(원본과 달라진 점)
  effect: string; // 기대 효과(평가 KPI)
}

// ── 코멘트 문구 — 세그먼트 전문가 렌즈(깊고 전문적, 팝업 평가/KPI 결부) ───────────
export const COMMENT_LINES: Record<OasisType, string[]> = {
  P1: [
    "오픈 첫 주 화제성이 평가 KPI예요 — USP를 제안 헤드라인으로 끌어올리세요.",
    "경쟁 팝업 대비 차별점이 한 줄로 안 읽혀요. '단 N일·국내 첫' 선점 메시지를 전면에.",
    "프리오픈·인플루언서 초청 동선이 빠졌어요 — 초기 확산 설계가 필요합니다.",
  ],
  P2: [
    "체류시간 목표가 없어요 — 입구→체험→포토→구매 4단계로 20분을 설계하세요.",
    "주변 상권 연계가 빠져 재방문·연계매출 근거가 약합니다.",
    "구간별 소요시간이 없으면 운영 인력·혼잡도 산정이 안 됩니다.",
  ],
  P3: [
    "예약·대기 구조가 워크인 전환을 깎아요 — 워크인 비중을 명시해 설계하세요.",
    "렌더와 실제 시공이 다르면 현장 클레임·평점 리스크 — 시공 명세를 첨부하세요.",
    "핵심 정보가 3줄로 안 잡혀요 — 입구 요약 배너로 진입 장벽을 낮추세요.",
  ],
  P4: [
    "SNS 도달이 성과지표면 '필수 촬영컷' 포토존을 도면에 확정해야 해요.",
    "전용 해시태그·인증 동선이 없으면 바이럴 KPI를 못 맞춥니다.",
    "인증 보상(굿즈) 트리거가 없어 확산 동기가 약합니다.",
  ],
  P5: [
    "브랜드 세계관이 공간 MD에 안 녹아 있어요 — 충성고객 재방문 근거가 약합니다.",
    "멤버십·한정 굿즈 연계가 빠져 객단가·LTV 설계가 비었습니다.",
    "디테일 일관성(폰트·소재·향)이 없으면 팬덤 전환이 안 일어나요.",
  ],
};

// ── 답글 문구(직전 발화자에게 — 크로스펑셔널 토론) — {other} = 직전 발화자 ──────
export const REPLY_LINES: string[] = [
  "{other} 지적 맞습니다 — 다만 평가표상 비중은 동선·체류가 더 큽니다.",
  "{other} 의견에 더하면, 그 변경은 비딩 단가에도 영향을 줘요.",
  "동의합니다, {other}. 운영 인력·안전 동선까지 함께 봐야 해요.",
  "{other} 안대로면 시공 일정이 빠듯해져요 — 일정 버퍼를 확보하죠.",
  "{other} 포인트가 핵심이에요. KPI(체류·전환·SNS)로 근거를 달면 평가에서 유리합니다.",
  "{other} 와 같은 맥락에서, 타깃 세그먼트 정의를 제안서 앞단에 명시하죠.",
];

// ── 에스컬레이션 문구(오케스트레이터로 올리는 구체 재작업 명령) — 페르소나별 ──────
export const ESCALATION_LINES: Record<OasisType, string[]> = {
  P1: ["USP를 제안 헤드라인으로 끌어올려 재작성", "오픈 화제성(프리오픈·초청) 설계 추가"],
  P2: ["체류 20분 목표의 4단계 동선 명시", "주변 상권 연계·재방문 설계 추가"],
  P3: ["워크인 비중 반영해 입장 문턱 완화", "시공 디테일 명세 첨부로 렌더-실물 갭 제거"],
  P4: ["필수 촬영 포토존 도면 확정", "해시태그·인증 동선+보상 추가"],
  P5: ["브랜드 세계관을 공간 MD에 반영", "멤버십·한정 굿즈 연계(LTV) 추가"],
};

// ── 후보안(개선안)에 실제로 적용되는 구체 변경 — 원본과 "달라진 점" ──────────────
export const CANDIDATE_CHANGES: Record<OasisType, string[]> = {
  P1: [
    "헤드라인을 USP 중심으로 교체 — '국내 첫·단 N일' 한정 메시지 전면",
    "입구 키비주얼 1컷을 오픈 화제성용으로 별도 지정",
    "프리오픈·인플루언서 초청일을 일정에 추가",
  ],
  P2: [
    "체험 동선을 입구→체험→포토→구매 4단계로 명시",
    "평균 체류 20분 목표·구간별 소요시간 표기",
    "주변 상권 연계(인근 매장·교통) 한 줄 추가",
  ],
  P3: [
    "워크인 비중 60% 가정으로 대기·예약 구조 완화",
    "현장 시공 디테일 명세 첨부(렌더-실물 갭 제거)",
    "핵심 정보 3줄 요약 배너를 입구에 배치",
  ],
  P4: [
    "필수 촬영 포토존 1곳을 도면에 확정 표기",
    "전용 해시태그·인증 동선(스탬프) 설계 추가",
    "SNS 인증 시 굿즈 제공 등 확산 트리거 명시",
  ],
  P5: [
    "공간 MD에 브랜드 세계관 모티프 3종 반영",
    "멤버십·한정 굿즈 연계로 재방문/LTV 설계",
    "충성고객 전용 사전입장 슬롯 추가",
  ],
};

export const CANDIDATE_EFFECT: Record<OasisType, string> = {
  P1: "기대 효과: 오픈 화제성·검색 점유 ↑ (선점)",
  P2: "기대 효과: 평균 체류시간·재방문율 ↑",
  P3: "기대 효과: 워크인 전환·현장 만족도 ↑",
  P4: "기대 효과: SNS 인증·바이럴 도달 ↑",
  P5: "기대 효과: 재방문·객단가(LTV) ↑",
};

/** 보드 태그라인(테마). */
export const COLLAB_TAGLINE = "고객들과 함께 쌓아가는 오프라인 경험을 만들자";

let pickSeed = 1;
function rand(n: number): number {
  pickSeed = (pickSeed * 1103515245 + 12345) & 0x7fffffff;
  return pickSeed % n;
}

export function pickComment(type: OasisType): string {
  const pool = COMMENT_LINES[type];
  return pool[rand(pool.length)];
}
export function pickReply(otherLabel: string): string {
  return REPLY_LINES[rand(REPLY_LINES.length)].replace("{other}", otherLabel);
}
export function pickEscalation(type: OasisType): string {
  const pool = ESCALATION_LINES[type];
  return pool[rand(pool.length)];
}
/** 후보안에 적용할 구체 변경 2~3개(원본과 달라진 점). */
export function pickCandidateChanges(type: OasisType): string[] {
  const pool = CANDIDATE_CHANGES[type];
  // 시작 인덱스만 흔들어 2~3개 연속 선택(중복 없이).
  const start = rand(pool.length);
  const n = Math.min(pool.length, 2 + (rand(2) === 0 ? 1 : 0));
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pool[(start + i) % pool.length]);
  return out;
}
export function candidateEffect(type: OasisType): string {
  return CANDIDATE_EFFECT[type];
}
