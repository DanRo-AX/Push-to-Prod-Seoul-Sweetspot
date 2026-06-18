// lib/ide/card-spec.ts — 산출물 카드의 '일반화된 정의'(데이터 모델).
//
// 지금까지 카드 내부(시그널·섹션·액션)는 React 컴포넌트에 하드코딩돼 BTL 전용이었다. 이를
// 데이터(CardSpec)로 선언해 — 새 워크플로 = 팩 작성(코드 안 짬) — 로 일반화한다.
// 제네릭 렌더러(CardSpecView)가 source/signals/sections 타입만 보고 카드를 그린다.
//
// 순수 모듈(JSX 없음) — 워크플로 팩이 import 해 슬롯별 카드 스펙을 선언한다.

// 카드 내용이 어디서 오는가.
//   extract    = 입력 문서를 파싱해 구조화(RFP). 자동화 OK(리서치/입력 레이어).
//   bound_file = 실무자 본인 작성물 파일 그대로(제안서·견적). 자동생성/수정 금지(P1/P2).
//   generated  = 엔진이 생성(차후).
export type CardSource = "extract" | "bound_file" | "generated";

// 읽기 시그널 1개의 정의 — 데이터 필드에서 값을 뽑아 칩으로.
export interface CardSignalSpec {
  /** 소스 데이터의 필드 경로(예: "submission_deadline", "mandatory_requirements"). */
  from: string;
  /** 표시 변환. dday=남은 일수, count=배열 길이, money_range=예산범위, text=그대로. */
  as: "dday" | "count" | "money_range" | "text";
  /** 칩 라벨(접두). 없으면 변환별 기본. */
  label?: string;
  /** 아이콘(codicon 키). */
  icon?: string;
  /** 위급도 조건(숫자 비교, 예: "<=3"). dday/count 에만 의미. */
  tone?: { danger?: string; warn?: string };
}

// 카드 본문 섹션 종류 — 각 값이 하나의 섹션 렌더러에 매핑된다.
export type CardSectionKind =
  | "typed_view"       // 추출된 구조 뷰(RFP 전용 렌더러)
  | "raw_open"         // 원문 열기(중앙 에디터 탭)
  | "estimate"         // 시장 견적 추정(RAG)
  | "rfp_quote_check"  // RFP 요구 견적항목 대조 체크리스트
  | "review_points"    // 검토 포인트 — 이 산출물에서 짚어야 할 의제(끌어온 페르소나가 이걸 인지하고 검토)
  | "content_loop"     // 콘텐츠 루프 — 군집 sharp 피드백 → 판정·반응율·비포애프터
  | "visual_gen"       // 비주얼 생성(Higgsfield) — 다듬은 콘텐츠를 실제 이미지로(목업 폴백). 콘텐츠 루프의 끝.
  | "audience_loop"    // 방문객 군집 루프(범용) — 기획안 등 산출물을 군집 데이터로 깎기 → 채택→.octopus.md
  | "composite";       // 합성 — 구성 카드(참조) 진척 + 합본(제안서 = 기획안+운영안+견적)

export interface CardSpec {
  /** 이 카드가 붙는 워크플로 슬롯 id(팩마다 다름 — 워크플로 무관하게 문자열). */
  slot: string;
  source: CardSource;
  header: { title: string; icon: string };
  /** 읽기 시그널(받자마자 보는 신호). extract 소스에서 주로 채워짐. */
  signals?: CardSignalSpec[];
  /** 검토 포인트 — 이 산출물에서 짚어야 할 의제. 끌어온 페르소나가 이걸 인지한 채 자기 렌즈로 검토한다. */
  reviewPoints?: string[];
  /** AI 초안 가이드 — 이 카드 타입을 RFP 기반으로 어떻게 초안 잡을지(있으면 'AI 초안 생성' 가능).
   *  초안은 before(군집이 깎을 대상). 사람만 가능한 건 [사람 확인 필요]로 비워둔다(거짓 채움 금지). */
  draftGuide?: string;
  /** 본문 섹션(순서대로 렌더). */
  sections: CardSectionKind[];
}

// ── BTL 워크플로 카드 스펙(3종) ─────────────────────────────────────────────
// 기존 하드코딩 카드를 이 데이터로 환원. 새 워크플로는 같은 모양으로 cards 만 갈아끼운다.

export const BTL_CARDS: CardSpec[] = [
  {
    slot: "rfp",
    source: "extract",
    header: { title: "RFP 문서", icon: "file" },
    signals: [
      { from: "fit_score", as: "text", label: "적합도", icon: "target" },
      { from: "submission_deadline", as: "dday", label: "제출", icon: "calendar", tone: { danger: "<=3", warn: "<=7" } },
      { from: "mandatory_requirements", as: "count", label: "필수요건", icon: "checklist" },
      { from: "budget_range", as: "money_range", label: "예산", icon: "symbol-numeric" },
      { from: "evaluation_criteria", as: "count", label: "평가", icon: "law" },
      { from: "required_quote_sections", as: "count", label: "견적항목", icon: "symbol-structure" },
      { from: "terms", as: "count", label: "유의", icon: "warning", tone: { warn: ">=1" } },
    ],
    reviewPoints: [
      "자사 적합도와 수주 전략이 평가 배점과 맞물리는가",
      "배점 높은 항목(아티스트 큐레이팅·온라인 확산 각 30%) 대응",
      "리스크·권리귀속(IP 전면 귀속·자료 미반환) 조항 점검",
    ],
    // next_stage(카드 안에서 '기획제안서 만들기') 제거 — 카드가 다른 카드를 spawn 하면 결합/디펜던시가
    // 생긴다. 다음 산출물은 워크플로 팔레트에서 '카드 추가'로(카드 일급·워크플로 얇게).
    sections: ["typed_view", "review_points"],
  },
  {
    slot: "proposal",
    source: "bound_file",
    header: { title: "기획안", icon: "file-text" },
    reviewPoints: [
      "컨셉이 방문 동기를 만드는가(가서 볼 이유)",
      "공간 조성·동선·체류 설계가 구체적인가",
      "촬영·공유·인증 유인이 있는가",
      "진입 장벽(회원가입·예약·정숙)이 방문을 막지 않는가",
      "재방문·한정(굿즈/에디션) 후크가 있는가",
    ],
    draftGuide: `기획안(제안용) 초안. 구성: 핵심 메시지 / 컨셉(RFP narrative_parts 의 파트들을 공간으로) /
타깃·방문 동기 / 공간 조성·동선·체류 / 촬영·공유 유인 / 관람 운영(진입장벽 최소화) / 일정 / 성공지표.
RFP 의 objective·target_audience·win_themes·narrative_parts 를 근거로. 검토 포인트(방문 동기·동선·공유
유인·진입장벽·재방문 후크)를 미리 의식해 구체적으로. 실제 작가 라인업·도심 대관 확보·확정 예산은
[사람 확인 필요]로 표기(지어내지 말 것).`,
    sections: ["raw_open", "review_points", "audience_loop"],
  },
  {
    slot: "quote",
    source: "bound_file",
    header: { title: "견적서", icon: "list-ordered" },
    reviewPoints: [
      "RFP 의무 견적 항목(4대 카테고리) 누락 여부",
      "단가 근거·적정성(시장가 대비)",
      "필수/선택 옵션 구성으로 가격 경쟁력 확보",
    ],
    draftGuide: `견적서 초안. RFP 의 required_quote_sections(의무 견적 골격)을 그대로 항목 표로 펼친다 —
카테고리별 세부항목 + 수량 + 단가 + 금액(표). 기획안 초안이 있으면 그 제작 항목과 정렬.
단가는 시장 추정 범위로 제시하고 [실견적 확인 필요] 표기. 필수/선택(옵션) 구분. 소계·간접비·마진·VAT
합계 구조. 실제 협력사 견적·확정 단가는 [사람 확인 필요].`,
    sections: ["raw_open", "rfp_quote_check", "estimate", "review_points"],
  },
  {
    slot: "operation",
    source: "bound_file",
    header: { title: "운영안", icon: "organization" },
    reviewPoints: [
      "대기·혼잡 관리(회차 인원·포토존 줄)",
      "현장 안전·안전 동선",
      "단기(4일) 시공·철거 일정과 인력 배치",
    ],
    draftGuide: `운영안 초안. 구성: 운영 시간·회차 계획 / 방문 동선·대기·혼잡 관리 / 현장 인력 배치(역할·인원)
/ 안전 관리(시공·철거·관람객 안전 동선) / 단기(행사 기간) 시공·철거 일정. 기획안 초안의 공간·관람 운영과
정렬. RFP period·venue 근거. 확정 인력 단가·실제 협력사는 [사람 확인 필요].`,
    sections: ["raw_open", "review_points"],
  },
  // 합성(최종) — 기획안·운영안·견적을 참조해 묶는 제안서. composition 워크플로의 output.
  {
    slot: "proposal_doc",
    source: "generated",
    header: { title: "제안서", icon: "package" },
    sections: ["composite"],
  },
];

// SNS·콘텐츠 워크플로 — 선형 슬롯이 아니라 '루프'. 단위 = 게시글(콘텐츠) 한 개.
// 콘텐츠 카드 안에서: 아이디어 → 군집 sharp 피드백(판정·반응율) → 비포애프터 → 다듬기.
// 발행/비주얼은 산출물이 아니라 커넥터(추후 카드 액션). 슬롯은 작업 단위 하나면 충분.
export const SNS_CARDS: CardSpec[] = [
  {
    slot: "content",
    source: "bound_file",
    header: { title: "콘텐츠", icon: "device-camera" },
    draftGuide: `인스타 게시글 1개 초안. 구성: 컨셉 한 줄 / 캡션(첫 줄 후킹) / 해시태그(5~8개) /
이미지 연출 브리프 / 추천 게시 시각. 브랜드 무드에 맞게, 첫 3초 후킹·공유 유인을 의식.
실제 촬영물·확정 카피는 [사람 확인 필요].`,
    sections: ["content_loop", "visual_gen", "raw_open"],
  },
];

// ── 카드 카탈로그(reframe 2026-06-18) ───────────────────────────────────────
// 카드 = 일급 재사용 단위. 워크플로에 종속되지 않고 여기(전역 카탈로그)에 산다.
// 워크플로는 이 카드들을 'slot id 로 참조해 나열'할 뿐. 카드 스펙 조회는 항상 전역 catalog 로
// (활성 팩과 무관 — 같은 카드는 어디서든 같은 스펙 = 재사용).
export const CARD_CATALOG: CardSpec[] = [...BTL_CARDS, ...SNS_CARDS];

/** 카드 id(=slot) 로 카탈로그에서 스펙 조회. 전역 — 활성 팩과 무관. */
export function cardSpecForSlot(slot: string): CardSpec | undefined {
  return CARD_CATALOG.find((c) => c.slot === slot);
}

/** 카드 팔레트 → 보드 드롭 페이로드 MIME(페이로드 = 카드 slot id). */
export const CARD_DND = "application/x-octopus-card";
