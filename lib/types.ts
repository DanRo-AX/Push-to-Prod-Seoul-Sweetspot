// octopus 데모 앱 공유 타입 계약.
// 엔진(서버) ↔ UI(클라이언트) ↔ 시나리오 팩이 모두 이 파일을 기준으로 통신한다.
// 이 파일을 바꾸면 양쪽 구현을 함께 바꿔야 한다.

// ───────────────────────── 아티팩트 (우측 패널 렌더링 대상) ─────────────────────────

// 이미지에 직접 새길 텍스트 — 실제 인스타 게시물처럼 비주얼 위에 카피가 얹힌다.
// 모델이 의미(문구)를 채우고, Higgsfield 프롬프트에 그대로 인용되며 목업 미리보기에도 오버레이된다.
export interface OnImageText {
  headline: string;         // 비주얼에 크게 들어갈 핵심 카피 한 줄
  sub?: string;             // 보조 카피(작게)
  badge?: string;           // 코너 뱃지/태그 (예: "D-3", "신메뉴", "한정")
}

// 릴스 장면 — 타임코드별 샷 + 화면 자막 (영상 제작용 샷 리스트).
export interface ReelScene {
  timecode: string;         // 예: "0:00–0:03"
  visual: string;           // 이 장면에 보이는 화면
  onScreenText?: string;    // 이 장면에 깔리는 자막
}

// 릴스 기획 — 9:16 커버 비주얼과 함께 제시되는 스크립트.
export interface ReelPlan {
  hook: string;             // 0~3초 후킹 멘트
  scenes: ReelScene[];      // 장면별 샷 리스트
  audioSuggestion: string;  // 추천 오디오/BGM 무드
  cta: string;              // 마지막 행동 유도
  durationSec: number;      // 목표 길이(초)
}

export interface InstagramPost {
  concept: string;          // 게시물 기획 의도 한 줄
  caption: string;          // 본문 캡션
  hashtags: string[];       // '#' 제외한 태그 문자열
  imageBrief: string;       // 이미지 연출 브리프 (디자이너/AI 이미지 생성용)
  suggestedPostTime: string; // 예: "수요일 19:00"
  imageUrl?: string;        // 생성된 비주얼(커버) URL — 없으면 플레이스홀더
  format?: "feed" | "carousel" | "reel"; // 게시물 형식 (기본 feed)
  aspect?: string;          // 비율 (feed 4:5, reel/스토리 9:16, 가로 16:9 등)
  onImageText?: OnImageText; // 비주얼 위에 얹는 카피 (실제 게시물 느낌)
  slides?: GeneratedVisual[]; // 캐러셀 슬라이드(이미지 여러 장) — format 이 carousel 일 때
  reel?: ReelPlan;          // 릴스 기획 — format 이 reel 일 때
  reelVideoUrl?: string;    // 릴스 발행용 공개 mp4 URL (format 이 reel 이고 Higgsfield 영상 생성 성공 시)
  composited?: boolean;     // imageUrl 이 이미 한글 카피가 합성된 카드(베이크됨)면 true — 목업 오버레이 생략
}

// 뉴스레터 제목 A/B 후보 — text/angle 만 모델 생성, charCount/spamRisk 등은 빌더가 계산
export interface SubjectVariant {
  text: string;
  // AICMO 5트리거: 심리 트리거별로 서로 다른 변형
  angle: "curiosity" | "urgency" | "personalization" | "social_proof" | "direct_benefit";
  charCount: number;                 // 도구가 계산 (모바일 40자 가드)
  truncatedOnMobile: boolean;        // 도구가 계산 (charCount > 40)
  spamRisk: "none" | "low" | "medium" | "high"; // 도구가 스팸어 휴리스틱으로 판정
  spamFlags: string[];               // 감지된 스팸/금지 신호 (예: "느낌표", "전부 대문자", "무료")
}

// 구조화 본문 섹션 (스캐너 우선) — 모델 생성
export interface NewsletterSection {
  kind: "hook" | "featured" | "news" | "tip" | "spotlight" | "community" | "cta";
  heading?: string;                  // hook 은 보통 heading 없음
  bodyMarkdown: string;              // 섹션 본문 (미니 마크다운)
  whyItMatters?: string;             // news/featured 섹션의 "왜 중요한가" 한 줄 (newsletter-gen 규율)
  sourceUrl?: string;                // 출처 URL (news 섹션은 권장) — 날조 방지
  keywordRef?: string;               // analyze_keywords 결과와 연결 (octopus 기존 패턴)
}

export interface NewsletterDraft {
  // ── 구조화 신규 필드 ──
  subjectVariants: SubjectVariant[]; // 2~5개 (서로 다른 angle), A/B 후보
  preheaderText: string;             // 제목 비반복·40~90자 (빌더가 길이 검증)
  preheaderCharCount: number;        // 도구가 계산
  framework: "AIDA" | "PAS" | "BAB" | "curation"; // 의식적으로 선택한 프레임워크
  sections: NewsletterSection[];     // 구조화 본문
  cta: { label: string; url?: string; goal: "engagement" | "sales" | "education" | "community" };
  estimatedReadSeconds: number;      // 도구가 단어수로 산출 (스캔성 가드)
  toneFlags: string[];               // 빌더가 감지한 톤 위반 (em-dash/과장어/jargon) — 비어 있으면 통과
  segment?: string;                  // 대상 세그먼트 라벨 (선택, mock-newsletter-audience 의 segment)

  // ── 하위호환 (UI/리플레이 보존) ──
  subject: string;                   // = subjectVariants[0].text (빌더가 채움)
  preheader: string;                 // = preheaderText (빌더가 채움)
  bodyMarkdown: string;              // = sections 합성본 (빌더가 채움) — 기존 NewsletterPreview 유지
}

export interface ColdEmail {
  to: string;               // 수신 이메일 주소 (발송 전 화이트리스트 검증 대상)
  company: string;          // 수신 브랜드/회사명
  subject: string;
  bodyText: string;
  followUpInDays: number;   // 무응답 시 팔로업까지 일수
}

export interface BriefingItem {
  headline: string;
  summary: string;
  source: string;           // 출처 설명 또는 URL
  recommendedAction: string; // "그래서 오늘 뭘 할지"
}

export interface MorningBriefing {
  date: string;             // ISO date
  items: BriefingItem[];
  todaysPick: string;       // 오늘의 추천 액션 1개 (콘텐츠 소재로 연결되는 항목)
}

export interface WeeklyMetric {
  week: string;             // 예: "W0", "W1"
  posts: number;
  followers: number;
  newsletterSubs: number;
  outboundSent: number;
  outboundReplies: number;
  meetings: number;
}

export interface MetricsTimeline {
  brandName: string;
  note: string;             // 정직성 라벨: "2주 실측 + 2주 보수 추정" 등
  weeks: WeeklyMetric[];
}

// 키워드 포트폴리오 (analyze_keywords 가 mockKeywords.seeds 에서 결정론적으로 계산해 조립)
export interface KeywordRow {
  keyword: string;
  monthlySearches: number;   // 월간 검색량
  rank: number | null;       // 현재 순위 (null = 미노출)
  rankDelta: number;         // 전주 대비 순위 변동 (양수 = 상승)
  intent: "정보" | "탐색" | "거래";
  audience: "B2B" | "B2C";   // 검색 주체 축 — B2B(도입/제휴 의도) vs B2C(소비자 의도)
  competitorGap: boolean;    // 경쟁사는 상위인데 우리는 못 잡은 키워드
  opportunityScore: number;  // 0~100 — 도구 코드가 계산 (모델 계산 금지)
}

export interface KeywordReport {
  brandName: string;
  capturedAt: string;        // ISO date
  totalTracked: number;      // 전체 추적 키워드 수 (예: 6700) — 데모 카피의 핵심 숫자
  note: string;              // 정직성 라벨
  rows: KeywordRow[];        // 기회 상위 10~14개
}

// 전환 퍼널 (analyze_funnel 이 mockJourney 에서 전환율·병목을 계산해 조립)
export interface FunnelStage {
  stage: string;             // 단계명 (예: "예약 페이지 진입")
  count: number;
  conversionFromPrev: number | null; // 직전 단계 대비 전환율 % — 첫 단계는 null
}

export interface FunnelReport {
  brandName: string;
  period: string;            // 예: "최근 14일"
  source: string;            // 예: "GA4 → BigQuery 여정 테이블 (mock)"
  note: string;
  stages: FunnelStage[];
  bottleneckStage: string;   // 전환율 최저 구간 — 도구 코드가 산출
}

// 콘텐츠 D+1/D+7 성과 (track_content_performance)
export interface PostMetricsSnapshot {
  reach: number;
  likes: number;
  saves: number;
  profileVisits: number;
  linkClicks: number;
}

export interface PostPerformance {
  postId: string;
  concept: string;           // 발행 당시 기획 한 줄
  format: string;            // 포맷 태그 (예: "저조도 포어링 과정 릴스") — topPattern 의 원천
  publishedAt: string;       // ISO date
  metricsD1: PostMetricsSnapshot;
  metricsD7: PostMetricsSnapshot | null; // D+7 미도래 시 null
  saveRateD7: number | null; // % — 도구 코드가 계산해 채움 (mock 파일에는 없음)
}

export interface ContentPerformanceReport {
  brandName: string;
  note: string;
  posts: PostPerformance[];  // saveRateD7 내림차순
  topPattern: string;        // 상위 성과 포맷 — 다음 초안에 반영할 패턴
}

// 콘텐츠 캘린더 (plan_content_calendar — 모델 생성형)
export interface CalendarEntry {
  date: string;              // ISO date
  channel: "instagram" | "newsletter" | "blog";
  title: string;
  objective: string;         // 핵심 전환으로 이어지는 경로 한 줄
  status: "planned" | "drafted" | "published";
  keywordRef?: string;       // analyze_keywords 결과와 연결된 타겟 키워드
}

export interface ContentCalendar {
  brandName: string;
  weekLabel: string;         // 예: "6월 3주차 (팝업 D-7 주간)"
  entries: CalendarEntry[];
}

// 리드 여정 (analyze_lead_journey — 전환 유저의 방문 횟수·체류·문의까지 소요일 패턴)
export interface LeadSession {
  userId: string;
  visits: number;            // 전환(또는 현재)까지 방문 횟수
  totalMinutes: number;      // 누적 체류 분
  daysToConversion: number;  // 첫 방문 → 문의까지 일수 (미전환은 경과일)
  converted: boolean;
  lastPath: string;          // 마지막 방문 페이지 경로
}

export interface LeadJourneyStats {
  avgVisitsBeforeConversion: number;
  avgDaysToConversion: number;
  avgSessionMinutes: number;
  highEngagementThreshold: number; // 이 방문 횟수 이상이면 핫리드로 분류 — 도구 코드가 산출
}

export interface LeadJourneyReport {
  brandName: string;
  period: string;            // 예: "최근 30일"
  source: string;            // 예: "GA4 세션 ↔ CRM 문의 매칭 (mock)"
  note: string;              // 정직성 라벨
  stats: LeadJourneyStats;
  hotLeads: LeadSession[];   // 미전환이지만 임계치 이상 — 영업 우선 대상
}

// 키워드 탐색 경로 (analyze_keyword_journey — "A 검색한 사람이 다음에 뭘 검색하나")
export interface KeywordTransition {
  keyword: string;           // 다음에 검색한 키워드
  rate: number;              // 전이 비율 % (0~100)
}

export interface KeywordJourneyNode {
  keyword: string;
  next: KeywordTransition[]; // 전이 비율 내림차순
}

export interface KeywordJourneyReport {
  brandName: string;
  seedKeyword: string;       // 분석 시작 키워드
  note: string;
  nodes: KeywordJourneyNode[];
  b2bSignals: string[];      // B2B 의도로 갈라지는 경로 신호
  b2cSignals: string[];      // B2C 의도로 갈라지는 경로 신호
}

// 콘텐츠 기여 분석 (analyze_content_attribution — 키워드 타겟 글 → 문의 기여)
export interface ContentAttribution {
  contentId: string;
  title: string;
  keyword: string;           // 타겟 키워드
  sessions: number;          // 유입 세션 수
  inquiries: number;         // 해당 글 경유 문의 수
  conversionRate: number;    // % — 도구 코드가 계산 (mock 파일에는 없음)
}

export interface AttributionReport {
  brandName: string;
  period: string;
  note: string;
  topConverters: ContentAttribution[]; // conversionRate 내림차순
  insight: string;           // 다음 콘텐츠 기획에 반영할 한 줄
}

// 채널 성장 시계열 (track_follower_growth — 팔로워/구독자 추이)
export interface FollowerSnapshot {
  date: string;              // ISO date
  instagram: number;         // 팔로워 수
  newsletterSubs: number;    // 뉴스레터 구독자 수
}

export interface FollowerGrowthReport {
  brandName: string;
  note: string;
  snapshots: FollowerSnapshot[];
  weeklyGrowthRatePct: number; // 주간 성장률 % — 도구 코드가 계산
}

// 추적 설정 감사 (audit_tracking_setup — URL → DOM 분석 → 미추적 이벤트 발굴)
export interface TrackingGap {
  element: string;           // 미추적 요소 설명 (예: "CTA 버튼 '도입 문의'")
  recommendedEvent: string;  // 권장 GA4 이벤트명 (예: "generate_lead")
  parameters: Record<string, string>; // 권장 이벤트 파라미터
  priority: "critical" | "high" | "low";
  gtmTagConfig: unknown;     // GTM 태그 설정 JSON (가져오기용)
}

export interface TrackingAuditReport {
  url: string;
  fetchedVia: "chrome" | "fetch"; // 렌더 경로 — chrome 헤드리스 또는 일반 fetch 폴백
  coverageScore: number;     // 0~100 추적 커버리지 점수 — 도구 코드가 계산
  existingSignals: string[]; // 이미 감지된 추적 신호 (gtag/GTM 등)
  gaps: TrackingGap[];
}

// 제목 A/B 랩 (optimize_subject_lines) — 제목 스코어링 표
// SubjectVariant 의 결정론 필드(글자수·스팸위험)에 예상 상대오픈 점수를 더한 행
export interface SubjectScoreRow {
  text: string;
  angle: SubjectVariant["angle"];
  charCount: number;            // 도구가 계산
  truncatedOnMobile: boolean;   // 도구가 계산 (charCount > 40)
  spamRisk: SubjectVariant["spamRisk"]; // 도구가 판정
  spamFlags: string[];          // 감지된 스팸/금지 신호
  projectedOpenScore: number;   // 0~100 상대 추정 — 도구가 결정론 휴리스틱으로 계산 ("추정" 라벨)
}

export interface SubjectLabReport {
  topic: string;                // 제목을 뽑은 본문/메일 요지
  goal: "open" | "click";       // 최적화 목표
  note: string;                 // 정직성 라벨 (예: "예상 오픈은 휴리스틱 추정값")
  rows: SubjectScoreRow[];      // projectedOpenScore 내림차순
  recommended: string[];        // A/B 로 테스트할 제목 2개 — 도구가 상위에서 선정
}

// 카피 자체 점검 (critique_copy) — 톤·스팸·길이·출처 결정론 룰셋
export interface CopyIssue {
  rule: string;                 // 위반 룰 이름 (예: "em-dash 사용", "과장어/jargon", "출처 누락")
  severity: "critical" | "warning" | "info";
  evidence: string;             // 감지된 근거 (해당 문구/패턴)
  suggestion: string;           // 구체적 수정 제안
}

export interface CopyCritiqueReport {
  target: "newsletter" | "cold_email" | "instagram"; // 점검 대상 카피 종류
  note: string;                 // 정직성 라벨 (결정론 룰셋 기반 점검)
  passScore: number;            // 0~100 통과 점수 — 도구가 계산
  issues: CopyIssue[];          // severity 우선순위 정렬
  summary: string;              // 한 줄 평결 (도구가 위반 카운트로 합성)
}

// 멀티터치 이메일 시퀀스 (plan_email_sequence) — 발송 안 함, 계획만
export interface EmailSequenceStep {
  dayOffset: number;            // 시작일 기준 발송 시점 (Day0=즉시) — 단조 증가
  framework: "AIDA" | "PAS" | "BAB" | "PPPP"; // 메일별 의식적 프레임워크
  objective: string;            // 이 메일의 목표 한 줄
  subject: string;
  bodyOutline: string;          // 본문 개요 (실문장 아닌 골격)
  cta: string;                  // 이 메일의 행동 요청
  wordCount: number;            // bodyOutline 단어수 — 도구가 계산 (장황함 가드)
  cadenceWarning?: string;      // dayOffset 비단조 등 카덴스 경고 — 도구가 판정
}

export interface EmailSequencePlan {
  type: "cold" | "nurture";     // 콜드 아웃바운드 vs 옵트인 너처
  audience: string;             // 대상 설명
  note: string;                 // 정직성 라벨 + "발송하지 않음(propose_cold_emails 승인 게이트만)"
  steps: EmailSequenceStep[];   // dayOffset 오름차순
  totalDays: number;            // 시퀀스 전체 기간 — 도구가 계산 (마지막 dayOffset)
}

// 뉴스레터 발송 성과 (analyze_newsletter_performance) — 오픈율/CTR 은 계산 필드
export interface NewsletterPerformanceRow {
  sentAt: string;               // ISO date
  subject: string;
  delivered: number;            // 원천
  opens: number;                // 원천
  clicks: number;               // 원천
  openRate: number;             // % — 도구가 계산 (opens/delivered)
  ctr: number;                  // % — 도구가 계산 (clicks/delivered)
  flags: string[];              // 벤치마크 경보 (예: "오픈율 35% 미만", "CTR 저조") — 도구가 판정
}

export interface NewsletterSegmentRecommendation {
  segment: string;              // 추천 세그먼트 라벨 (mock-newsletter-audience 의 segment)
  size: number;                 // 구독자 수 (원천)
  reason: string;               // 왜 이 세그먼트인가 — 도구가 합성 (관심 키워드 교차)
}

export interface NewsletterPerformanceReport {
  brandName: string;
  period: string;               // 예: "최근 발송 N건"
  source: string;               // 예: "뉴스레터 발송 로그 (mock)"
  note: string;                 // 정직성 라벨
  rows: NewsletterPerformanceRow[]; // sentAt 내림차순 (최신 우선)
  avgOpenRate: number;          // % — 도구가 계산
  avgCtr: number;               // % — 도구가 계산
  benchmarkOpenRate: number;    // 비교 기준 오픈율 % (벤치마크 휴리스틱)
  trend: string;                // 직전 발송 대비 추세 한 줄 — 도구가 합성
  nextSubjectTriggers: SubjectVariant["angle"][]; // 차기 제목에 권장할 트리거
  recommendedSegments: NewsletterSegmentRecommendation[]; // 차기 타겟 세그먼트
  insight: string;              // 다음 초안에 반영할 한 줄 인사이트
}

// ───────────────────────── 팝업 스토어 주관 워크플로 (RFP → 제안 → 비딩) ─────────────────────────
// 우리는 팝업 스토어 회사다. 에이전트가 수주 과정의 실무 산출물을 직접 생성한다.
// 마케팅 도구(인스타/뉴스레터/콜드메일/분석)는 그대로 유지하고, 아래는 추가 역량이다.

/** RFP 분석 — 들어온 제안요청서를 요건/평가/적합도/리스크/수주전략으로 구조화. */
export interface RfpRequirement {
  label: string;                       // 요건 항목
  detail: string;                      // 상세
  priority: "must" | "should" | "nice"; // 우선순위
}
export interface RfpEvalCriterion {
  label: string;                       // 평가 항목 (예: 기획력, 운영, 가격)
  weight: number;                      // 배점(%) — 합 100 권장
}
export interface RfpRisk {
  label: string;                       // 리스크
  mitigation: string;                  // 대응 방안
}
export interface RfpAnalysis {
  client: string;                      // 발주처/브랜드
  title: string;                       // 팝업/사업명
  summary: string;                     // 한 줄 요약
  period: string;                      // 운영 기간
  venue: string;                       // 장소/규모
  budget: string;                      // 예산 범위
  requirements: RfpRequirement[];      // 핵심 요건
  evalCriteria: RfpEvalCriterion[];    // 평가 기준 + 배점
  fitScore: number;                    // 자사 적합도 0~100
  fitRationale: string;                // 적합도 근거
  risks: RfpRisk[];                    // 리스크 + 대응
  winThemes: string[];                 // 수주 전략 포인트
}

/** 제안서 — 컨셉/공간/동선/일정/KPI/예산 개요. */
export interface ProposalZone {
  name: string;                        // 존 이름 (예: 입구·체험·포토·구매)
  purpose: string;                     // 목적
  experience: string;                  // 고객 경험
}
export interface ProposalScheduleItem {
  phase: string;                       // 단계 (준비/시공/운영/철수)
  period: string;                      // 기간
}
export interface ProposalKpi {
  label: string;                       // KPI
  target: string;                      // 목표치
}
export interface ProposalBudgetLine {
  item: string;                        // 항목
  amount: string;                      // 금액(개요 — 정밀 견적은 Bid)
}
export interface Proposal {
  title: string;                       // 제안 팝업명
  client: string;
  concept: string;                     // 컨셉 한 단락
  targetSegments: string[];            // 타깃 세그먼트
  zones: ProposalZone[];               // 공간 구성
  journey: string[];                   // 방문 동선 단계(순서)
  schedule: ProposalScheduleItem[];    // 일정
  kpis: ProposalKpi[];                 // 목표 KPI
  budgetOutline: ProposalBudgetLine[]; // 예산 개요
  winThemes: string[];                 // 차별점
}

/** 비딩/견적 — 항목별 견적 + 마진 + 경쟁력. */
export interface BidLineItem {
  category: string;                    // 카테고리 (공간/시공, 운영, 마케팅 등)
  item: string;                        // 항목
  qty: string;                         // 수량/단위 (선택 표기)
  amount: number;                      // 금액(원)
  note: string;                        // 비고
}
export interface Bid {
  title: string;
  client: string;
  lineItems: BidLineItem[];            // 견적 항목
  subtotal: number;                    // 소계(원) — 도구가 합산
  marginPct: number;                   // 마진율(%)
  total: number;                       // 총액(원) — 도구가 계산
  competitiveness: string;             // 경쟁력 코멘트
  assumptions: string[];               // 견적 전제
}

/** 운영안 — 현장 운영의 인력·동선·안전·일정(+운영시간/목표/비상대응). */
export interface OperationStaffRole {
  role: string;        // 역할 (예: 현장 매니저, 시향 안내, 안전 관리)
  count: number;       // 인원
  shift: string;       // 근무/시프트 (예: 11:00-20:00, 2교대)
  duty: string;        // 주요 업무
}
export interface OperationFlowStep {
  zone: string;        // 구역/단계
  action: string;      // 동선상 안내/처리
  capacity: string;    // 수용·대기 관리 (예: 동시 15명 / 대기 10분)
}
export interface OperationSafetyItem {
  hazard: string;      // 위험요소
  control: string;     // 대응·통제
  owner: string;       // 담당
}
export interface OperationScheduleItem {
  phase: string;       // 단계 (사전준비/시공/리허설/오픈/운영/철수)
  period: string;      // 기간·시각
  detail: string;      // 상세
}
export interface OperationPlan {
  title: string;
  client: string;
  summary: string;                      // 운영 개요 한 줄
  hours: string;                        // 운영 시간 (예: 목~일 11:00-20:00)
  dailyTarget: string;                  // 일 운영 목표 (방문/전환 등)
  staffing: OperationStaffRole[];       // 인력
  flow: OperationFlowStep[];            // 동선·혼잡 관리
  safety: OperationSafetyItem[];        // 안전
  schedule: OperationScheduleItem[];    // 일정(준비~철수)
  contingencies: string[];              // 비상/우천/혼잡 대응
}

/** Higgsfield 등으로 생성한 비주얼(이미지/영상) — 콘텐츠 제작 산출물. */
export interface GeneratedVisual {
  url: string;        // 이미지/영상 URL (목업이면 data-URI SVG)
  prompt: string;     // 생성 프롬프트
  savedPath?: string; // 로컬에 저장된 파일 절대 경로(저장 성공 시)
}
export interface VisualSet {
  title: string;                       // 무엇을 위한 비주얼인지
  brief: string;                       // 연출/콘셉트 한 줄
  source: "higgsfield" | "mock";       // 실제 생성 vs 목업(키 미설정/실패)
  note: string;                        // 정직성 라벨 (예: "Higgsfield 키 미설정 — 목업")
  aspect: string;                      // 비율 (예: 1:1, 4:5, 9:16, 16:9)
  visuals: GeneratedVisual[];          // 생성된 비주얼
}

// 인스타그램 발행 승인 대상(초안) — 승인 게이트(ApprovalRequest)에 표시된다.
export interface InstagramPublishDraft {
  caption: string;          // 발행 본문 (해시태그 포함 최종본)
  imageUrl: string;         // 발행할 비주얼(또는 릴스 커버/캐러셀 대표) — 공개 http(s) URL
  imageUrls?: string[];     // 캐러셀 슬라이드들의 공개 http(s) URL (mediaType 이 CAROUSEL 일 때, 2~10장)
  videoUrl?: string;        // 릴스 발행용 공개 mp4 URL (mediaType 이 REELS 일 때)
  mediaType: "IMAGE" | "CAROUSEL" | "REELS"; // 피드 이미지 / 캐러셀(여러 장) / 릴스(영상)
  concept?: string;         // 기획 의도 (표시용)
  account?: string;         // 대상 계정 핸들 (표시용, 예: popup__magazine)
}

// 인스타그램 발행 결과 — 승인 후 산출되는 아티팩트.
export interface InstagramPublishResult {
  caption: string;
  imageUrl: string;
  mock: boolean;            // 토큰 미설정/이미지 비공개/릴스(영상없음) 등으로 실제 발행 못 한 경우 true
  permalink?: string;       // 발행된 게시물 URL (실발행 성공 시)
  mediaId?: string;
  account?: string;
  publishedAt: string;      // ISO
  note?: string;            // 정직성 라벨
}

export type Artifact =
  | { kind: "briefing"; briefing: MorningBriefing }
  | { kind: "rfp_analysis"; analysis: RfpAnalysis }
  | { kind: "proposal"; proposal: Proposal }
  | { kind: "bid"; bid: Bid }
  | { kind: "operation_plan"; plan: OperationPlan }
  | { kind: "visual"; set: VisualSet }
  | { kind: "instagram_posts"; posts: InstagramPost[] }
  | { kind: "instagram_published"; result: InstagramPublishResult }
  | { kind: "newsletter"; draft: NewsletterDraft }
  | { kind: "cold_emails"; emails: ColdEmail[] }
  | { kind: "metrics"; metrics: MetricsTimeline }
  | { kind: "keywords"; report: KeywordReport }
  | { kind: "funnel"; report: FunnelReport }
  | { kind: "content_performance"; report: ContentPerformanceReport }
  | { kind: "calendar"; calendar: ContentCalendar }
  | { kind: "lead_journey"; report: LeadJourneyReport }
  | { kind: "keyword_journey"; report: KeywordJourneyReport }
  | { kind: "attribution"; report: AttributionReport }
  | { kind: "follower_growth"; report: FollowerGrowthReport }
  | { kind: "tracking_audit"; report: TrackingAuditReport }
  | { kind: "subject_lab"; lab: SubjectLabReport }
  | { kind: "copy_critique"; report: CopyCritiqueReport }
  | { kind: "email_sequence"; sequence: EmailSequencePlan }
  | { kind: "newsletter_performance"; report: NewsletterPerformanceReport }
  | { kind: "btl_rfp"; rfp: RfpDocument }
  | { kind: "btl_proposal"; proposal: ProposalDocument }
  | { kind: "btl_quote"; quote: QuoteDocument }
  // 실무자가 슬롯에 지정한 '본인 작성' 산출물 파일(제안서/견적서). RFP 와 달리 자동
  // 추출/구조화하지 않고 — 판단은 인간 영역(P1/P2) — 보드에 카드로 띄워 페르소나와 논의만.
  | { kind: "btl_proposal_file"; slotId: string; name: string; ext: string }
  | { kind: "btl_quote_file"; slotId: string; name: string; ext: string }
  | { kind: "btl_operation_file"; slotId: string; name: string; ext: string }
  // 제네릭 bound-doc 카드 — 임의 워크플로 팩의 bound_file 슬롯(SNS 게시글 등). slotId 의
  // CardSpec(활성 팩)이 섹션을 구동. BTL 전용 *_file 들의 일반화판.
  | { kind: "btl_doc_file"; slotId: string; name: string; ext: string }
  // RFP 추출 대기용 임시 카드 — 슬롯 지정 즉시 보드에 뜨고, 추출이 끝나면 btl_rfp 로 교체.
  | { kind: "btl_doc_loading"; slotId: string; label: string };

export type ArtifactKind = Artifact["kind"];

// 보드 카드 식별 키 — 기본은 kind(종류당 1장). 단 slotId 를 가진 종류(제네릭 bound-doc 등)는
// 슬롯마다 별 카드이므로 kind:slotId 로 분리한다.
export function artifactKey(a: Artifact): string {
  return "slotId" in a ? `${a.kind}:${a.slotId}` : a.kind;
}

// ───────────────────────── 승인 게이트 (human-in-the-loop) ─────────────────────────

// 승인 요청 — kind 로 구분되는 판별 유니온.
// id 는 승인 세션 ID — /api/approve 로 회신할 때 사용 (모든 변형 공통).
export type ApprovalRequest =
  | { id: string; kind: "cold_emails"; emails: ColdEmail[] }                 // 콜드메일 발송 승인
  | { id: string; kind: "instagram_publish"; post: InstagramPublishDraft };  // 인스타그램 발행 승인

// ───────────────────────── SSE 이벤트 프로토콜 ─────────────────────────
// /api/agent 와 /api/replay 가 같은 프로토콜로 스트리밍한다.
// 와이어 포맷: 한 줄에 JSON 하나 (`data: <json>\n\n` SSE 형식).

export type AgentEvent =
  | { type: "user_message"; text: string }                                // 클라이언트 로컬 전용 — 서버는 발행하지 않음 (채팅 UI 표시용)
  | { type: "status"; status: "started" | "thinking" | "done" | "error"; message?: string }
  | { type: "text_delta"; text: string }                                  // 에이전트 답변 텍스트 조각
  | { type: "tool_start"; toolUseId: string; toolName: string; label: string; input?: unknown }
  | { type: "tool_end"; toolUseId: string; toolName: string; summary: string }
  | { type: "artifact"; artifact: Artifact }                              // 우측 패널에 렌더링
  | { type: "approval_required"; approval: ApprovalRequest }              // UI는 승인 모달 표시
  | { type: "approval_resolved"; approvalId: string; approved: boolean }
  | { type: "email_sent"; to: string; company: string; subject: string }  // 실발송 완료 알림
  | { type: "instagram_published"; account?: string; permalink?: string; mock: boolean } // 인스타 발행 완료 알림
  // C-BTL 전용 — 시나리오 완료 트리거 (RFP→제안서→견적서 완주 후 발행)
  | { type: "scenario_complete"; rfp: RfpDocument; proposal: ProposalDocument; quote: QuoteDocument; applied_card_ids: string[] }
  // C-BTL 전용 — 패턴카드 신규 mint 완료 알림
  | { type: "pattern_card_minted"; card: PatternCard }
  // C-BTL 전용 — 페르소나가 내 문서를 읽고 남기는 이름표 달린 코멘트(자문자답 방지)
  | { type: "persona_comment"; personaId: string; name: string; title: string; accent: string; text: string; targetFile?: string };

// 골든 런 레코딩: AgentEvent + 상대 타임스탬프(ms)
export interface RecordedEvent {
  atMs: number;             // 런 시작 기준 경과 ms — 리플레이 시 타이핑 속도 재현
  event: AgentEvent;
}

// ───────────────────────── 시나리오 팩 ─────────────────────────
// scenarios/<id>/ 디렉토리 구조:
//   brand-brief.md        — 브랜드 설정 (이름, 톤, 상황)
//   prompt-fragments.md   — 시스템 프롬프트에 주입할 시나리오별 지침
//   mock-ga.json          — MetricsTimeline 형태
//   mock-crm.json         — { leads: CrmLead[] }
//   mock-contacts.json    — { contacts: OutboundContact[] }
//   mock-keywords.json    — KeywordPack (계산 전 키워드 시드)
//   mock-journey.json     — JourneyPack (단계 카운트만, 전환율은 도구가 계산)
//   mock-post-performance.json — PostPerformancePack (saveRateD7 제외)
//   mock-mentions.json    — MentionsPack (monitor_competitors 조회용)
//   mock-lead-journey.json     — LeadJourneyPack (세션 원천 — 통계는 도구가 계산)
//   mock-keyword-journey.json  — KeywordJourneyPack (키워드 전이 그래프)
//   mock-attribution.json      — AttributionPack (conversionRate 제외 — 도구가 계산)
//   mock-follower-growth.json  — FollowerGrowthPack (성장률은 도구가 계산)
//   mock-newsletter-audience.json    — NewsletterAudiencePack (세그먼트 원천 — 오픈율 추정은 도구가 계산)
//   mock-newsletter-performance.json — NewsletterPerformancePack (발송 원천 — 오픈율/CTR 은 도구가 계산)

export type ScenarioId = "A-zero-to-one" | "B-rebrand" | "C-btl";

export interface CrmLead {
  name: string;
  company: string;
  email: string;
  stage: "new" | "contacted" | "replied" | "meeting" | "won";
  score: number;            // 0~100 리드 스코어
  lastTouch: string;        // ISO date
}

export interface OutboundContact {
  name: string;
  company: string;
  role: string;
  email: string;
  context: string;          // 개인화에 쓸 최근 활동/특징
}

// mock-keywords.json — 계산 전 원천 데이터
export interface KeywordSeed {
  keyword: string;
  monthlySearches: number;
  rank: number | null;       // 현재 순위
  prevRank: number | null;   // 전주 순위
  competitorRank: number | null; // 경쟁사 최고 순위 (갭 판정용)
  intent: "정보" | "탐색" | "거래";
  audience: "B2B" | "B2C";   // 검색 주체 축 (KeywordRow.audience 로 그대로 전달)
}
export interface KeywordPack { totalTracked: number; note: string; seeds: KeywordSeed[] }

// mock-journey.json — 단계 카운트만 (전환율은 도구가 계산)
export interface JourneyPack {
  period: string;
  source: string;
  note: string;
  stages: { stage: string; count: number }[];
}

// mock-post-performance.json — saveRateD7 제외한 PostPerformance
export interface PostPerformancePack {
  note: string;
  posts: Omit<PostPerformance, "saveRateD7">[];
}

// mock-mentions.json — monitor_competitors 조회용 (UI 아티팩트 없음)
export interface CompetitorMention {
  source: "instagram" | "naver_blog" | "news" | "x";
  brand: string;             // 언급된 경쟁 브랜드/팝업/트렌드 주체
  date: string;              // ISO date
  summary: string;
  signal: "기회" | "위협" | "중립";
}
export interface MentionsPack { mentions: CompetitorMention[] }

// mock-lead-journey.json — 세션 원천 데이터 (LeadJourneyStats 는 도구가 계산)
export interface LeadJourneyPack {
  period: string;
  source: string;
  note: string;
  sessions: LeadSession[];
}

// mock-keyword-journey.json — seedKeyword 별 전이 그래프
export interface KeywordJourneyPack {
  note: string;
  seeds: KeywordJourneyNode[]; // 각 노드의 keyword 가 seedKeyword 후보
  b2bSignals?: string[];       // B2B 의도로 갈라지는 경로 신호 (리포트로 전달)
  b2cSignals?: string[];       // B2C 의도로 갈라지는 경로 신호 (리포트로 전달)
}

// mock-attribution.json — conversionRate 제외한 ContentAttribution
export interface AttributionPack {
  period: string;
  note: string;
  rows: Omit<ContentAttribution, "conversionRate">[];
}

// mock-follower-growth.json — 스냅샷만 (weeklyGrowthRatePct 는 도구가 계산)
export interface FollowerGrowthPack {
  note: string;
  snapshots: FollowerSnapshot[];
}

// mock-newsletter-audience.json — 세그먼트 원천 (오픈율 추정은 빌더가 계산)
export interface NewsletterSegment {
  segment: string;                   // 예: "고관여 구독자", "신규 구독자(7일내)"
  size: number;                      // 구독자 수 (원천)
  interestKeywords: string[];        // 관심 키워드 (mock-keywords 와 교차)
  // openRate/clickRate 등 파생값은 넣지 않는다 — 빌더가 과거 발송에서 계산
}
export interface NewsletterAudiencePack { note: string; segments: NewsletterSegment[] }

// mock-newsletter-performance.json — 과거 발송 원천 (오픈율/CTR 은 빌더가 계산)
export interface NewsletterSendRecord {
  sentAt: string;                    // ISO date
  subject: string;
  delivered: number;
  opens: number;
  clicks: number;
  // openRate/ctr 는 Omit — 빌더가 track_content_performance 처럼 계산
}
export interface NewsletterPerformancePack {
  note: string;
  records: NewsletterSendRecord[];
}

export interface ScenarioPack {
  id: ScenarioId;
  brandBrief: string;       // brand-brief.md 원문
  promptFragments: string;  // prompt-fragments.md 원문
  mockGa: MetricsTimeline;
  mockCrm: { leads: CrmLead[] };
  mockContacts: { contacts: OutboundContact[] };
  mockKeywords: KeywordPack;          // mock-keywords.json
  mockJourney: JourneyPack;           // mock-journey.json
  mockPostPerformance: PostPerformancePack; // mock-post-performance.json
  mockMentions: MentionsPack;         // mock-mentions.json
  mockLeadJourney: LeadJourneyPack;       // mock-lead-journey.json
  mockKeywordJourney: KeywordJourneyPack; // mock-keyword-journey.json
  mockAttribution: AttributionPack;       // mock-attribution.json
  mockFollowerGrowth: FollowerGrowthPack; // mock-follower-growth.json
  mockNewsletterAudience: NewsletterAudiencePack;     // mock-newsletter-audience.json (세그먼트 원천)
  mockNewsletterPerformance: NewsletterPerformancePack; // mock-newsletter-performance.json (발송 원천)
}

// ───────────────────────── 런타임 설정 (인앱 API 키) ─────────────────────────

// GET /api/settings 응답 — 키 설정 여부만 노출한다. 키 원문은 절대 포함하지 않는다.
export interface SettingsStatus {
  anthropic: boolean;              // ANTHROPIC_API_KEY 설정 여부
  bigqueryProject: string | null;  // BigQuery 프로젝트 ID (비밀 아님 — 표시 가능)
  searchConsole: boolean;          // Google 서비스계정 키 설정 여부
  instagram: boolean;              // Instagram 액세스 토큰 설정 여부
  higgsfield: boolean;             // Higgsfield API 키 설정 여부(콘텐츠 생성)
}

// ───────────────────────── 플랫폼 셸 (운영 콘솔 UI) ─────────────────────────

// 실행 모드 — useAgentStream 이 어떤 경로로 스트림 중인지 구분한다.
export type RunMode = "idle" | "live" | "replay";

// GET /api/scenario 응답 — 활성 시나리오 팩 요약 (사이드바 표시용)
export interface ScenarioInfo {
  id: ScenarioId;
  brandName: string;        // mockGa.brandName
  label: string;            // 예: "제로투원" | "리브랜딩"
}

// GET /api/workspace 응답 — 시나리오 팩에서 계산한 베이스라인 작업 공간 데이터.
// 각 페이지가 초기 로드 후, 라이브 아티팩트(useAgentStreamContext)가 있으면 그걸로 덮어쓴다.
export interface WorkspaceData {
  scenario: ScenarioInfo;
  metrics: MetricsTimeline;
  funnel: FunnelReport;
  keywords: KeywordReport;
  contentPerformance: ContentPerformanceReport;
  crm: { leads: CrmLead[] };
  contacts: { contacts: OutboundContact[] };
}

export interface TopBarProps {
  mode: RunMode;
  running: boolean;
  error: string | null;
  events: AgentEvent[];     // 상태 칩 · 진행 단계 표시용
}

export interface OpsStripProps {
  events: AgentEvent[];     // 도구 실행 수 · 발송 수 · 승인 상태 파생
  artifacts: Artifact[];
}

// ───────────────────────── UI 컴포넌트 props 계약 ─────────────────────────
// components/ 구현은 반드시 이 props 시그니처를 따른다.

export interface AgentFeedProps {
  events: AgentEvent[];
  streamingText: string;    // 누적 중인 text_delta (말풍선 하나로 렌더)
  running: boolean;         // 실행 중 라이브 인디케이터 표시용
}

export interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  /** 파일 첨부 핸들러(있을 때만 첨부 버튼 노출). RFP 등 입력 문서를 채팅에서 바로 분석. */
  onAttach?: (file: File) => void;
  /** 워크플로 선택 칩(있을 때만 노출) — 채팅에서 워크플로 로드(빈 카드 시드). 손/채팅 동일 동작. */
  workflow?: {
    options: { id: string; label: string }[];
    current: string; // 현재 packId("" = 없음)
    onLoad: (id: string) => void;
  };
}

export interface ApprovalModalProps {
  approval: ApprovalRequest | null;
  onResolve: (approvalId: string, approved: boolean) => void;
}

export interface ArtifactPanelProps {
  artifacts: Artifact[];    // 시간순 전체 목록 — 패널이 kind별 최신본을 탭으로 보여줌
}

export interface InstagramMockupProps {
  posts: InstagramPost[];
  brandName: string;
}

export interface NewsletterPreviewProps {
  draft: NewsletterDraft;
}

export interface MetricsDashboardProps {
  metrics: MetricsTimeline;
}

export interface KeywordTableProps { report: KeywordReport }
export interface FunnelChartProps { report: FunnelReport }
export interface ContentPerformanceProps { report: ContentPerformanceReport }
export interface ContentCalendarProps { calendar: ContentCalendar }

// ───────────────────────── C-BTL 시나리오 타입 계약 ─────────────────────────
// scenarios/C-btl 팩 전용. RFP → 기획제안서 → 견적서 흐름을 지원한다.

export type BtlStage = "rfp_ready" | "proposal_drafting" | "proposal_ready" | "quote_drafting" | "quote_ready";

export type BtlIndustry = "패션" | "뷰티" | "F&B" | "캐릭터" | "리빙" | "엔터" | "기타";
export type BtlItemCategory = "시공" | "제작물" | "렌탈" | "인력" | "운영" | "기타";
export type BtlScopeRequirement = "기획" | "운영" | "제작";
export type BtlPersonaRole = "content" | "creative" | "strategy" | "risk" | "client_voice" | "visitor";

// FieldProvenance: 가변 필드마다 부착되는 출처 추적 정보
export interface FieldProvenance {
  field_path: string;        // 어느 필드인지 (예: "proposal.proposal_angle.why_now")
  source: "rfp" | "data" | "persona" | "user" | "calc";
  persona_id?: string;       // 채운 페르소나 ID (persona source 일 때)
  confidence: number;        // 0~1 — 검토 우선순위 정렬용
  card_id?: string;          // 패턴카드 출처 (카드 적용 시)
  editable_by_user: boolean;
}

// ReviewQueueItem: confidence < 0.7 인 페르소나 필드는 여기 추가된다
export interface ReviewQueueItem {
  field_path: string;
  current_value: string;
  confidence: number;
  persona_id: string;
  choices: string[];         // 사람이 선택할 수 있는 후보값 목록
}

// PatternCard: 과거 프로젝트에서 추출한 재사용 스니펫
export interface PatternCard {
  card_id: string;
  title: string;
  content: string;           // 스니펫 본문
  industry: BtlIndustry[];   // 해당 산업 태그
  track: BtlScopeRequirement[]; // 해당 트랙 태그
  field_path: string;        // 적용 대상 필드 경로
  usage_count: number;
}

// PersonaRef: 페르소나 참여 기록
export interface PersonaRef {
  persona_id: string;
  role: BtlPersonaRole;
  data_sources: string[];    // 좌측 탭 노출용 출처 라벨
  experience_level: number;  // 누적 프로젝트 수 (성장 지표)
}

// ClientBrand: 고객사/브랜드 정보
export interface ClientBrand {
  client_name: string;
  brand_name: string;
  industry: BtlIndustry;
  client_party_id?: string;
  brand_id?: string;
}

// 계약 방식 — 트랙 라우팅 신호. 수의계약/제안=제안 트랙, 경쟁입찰/비딩=비딩 트랙.
export type ContractMethod = "수의계약" | "제안" | "경쟁입찰" | "비딩" | "기타";

// NarrativePart: RFP 가 제시한 전시/캠페인 서사 파트(예: KMI 의 5개 파트).
// 제안서의 concept/proposal_angle 이 직접 소비하는 창작 척추.
export interface RfpNarrativePart {
  name: string;
  description?: string;
}

// RfpQuoteSection: RFP 가 요구한 의무 견적 골격(비용 카테고리 + 세부 항목).
// 견적서 line_items 가 이 구조에 정렬되어야 한다.
export interface RfpQuoteSection {
  name: string;          // 예: "오프라인 전시 공간 구축 및 운영비"
  items: string[];       // 예: ["공간 대관료", "가벽/구조물 시공·철거", "VMD 연출", "하드웨어 렌탈"]
}

// RfpPeriodOption: 기간 우선순위(1순위/2순위 등).
export interface RfpPeriodOption {
  label: string;         // 예: "1순위", "2순위(대안)"
  start: string;
  end: string;
  priority: number;
}

// RfpDocument: 입력 RFP 문서
// 핵심 헤더 + raw_text(schema-on-read 보존). 아래 optional 필드들은 실제 RFP 의
// 구조적 정보(서사 파트·의무 견적 골격·납품물·계약/유의사항)를 손실 없이 담아
// 다음 단계(제안서/견적서/리스크 페르소나)가 소비하게 한다. mock 팩은 미보유 가능.
export interface RfpDocument {
  rfp_id: string;
  received_at: string;       // ISO datetime
  client_brand: ClientBrand;
  project_title: string;
  objective: string;
  target_audience: string;
  period: { start: string; end: string };
  venue_requirement: { area?: string; size_pyeong?: number; type?: string };
  budget_range: { min?: number; max?: number; currency: string } | null;
  scope_requirement: BtlScopeRequirement[];
  mandatory_requirements: string[];
  evaluation_criteria: string[];
  submission_deadline?: string;
  raw_text: string;
  // ── 확장(optional) — 실제 RFP 정보 손실 방지 ──
  contract_method?: ContractMethod;        // 트랙 신호(수의/비딩)
  period_options?: RfpPeriodOption[];       // 1순위/2순위 등 (period 는 1순위로 평평화)
  narrative_parts?: RfpNarrativePart[];     // 전시 서사 파트(제안서가 소비)
  required_quote_sections?: RfpQuoteSection[]; // 의무 견적 골격(견적서가 소비)
  deliverables?: string[];                  // 납품 산출물(도면/영상/KPI 보고서 등)
  terms?: string[];                         // 유의사항·권리귀속(리스크 페르소나가 소비)
  // ── 분석 레이어(optional) — main 의 RFP 분석 흡수. 추출이면서 동시에 판단(adaptive thinking) ──
  fit_score?: number;                       // 자사 적합도 0~100
  fit_rationale?: string;                   // 적합도 근거 한두 문장
  evaluation_weights?: RfpEvalWeight[];     // 평가기준 배점(%) — evaluation_criteria 의 가중판
  risks?: RfpRiskItem[];                    // 리스크 + 대응(terms 의 판단판)
  win_themes?: string[];                    // 수주 전략 포인트
}

/** 평가기준 배점 — main RfpAnalysis.evalCriteria 흡수. */
export interface RfpEvalWeight { label: string; weight: number }
/** 리스크 + 대응 — main RfpAnalysis.risks 흡수. */
export interface RfpRiskItem { label: string; mitigation: string }

// ProductionItem: 기획 제안서의 제작 항목 (견적 line_items 의 씨앗)
export interface ProductionItem {
  item_id: string;           // 견적 line 의 source_item_id
  item_name: string;
  category: BtlItemCategory;
  qty: number;
  spec_note: string;
  unit_price_hint?: number;  // 카탈로그 참고가 (견적이 확정)
}

// ProposalAngle: 제안 핵심 메시지 (페르소나가 저자 — 가변 최고)
export interface ProposalAngle {
  core_message: string;
  why_now: string;
  differentiation: string;
  evidence_refs: string[];
}

// Concept: 컨셉 (페르소나가 저자 — 가변 높음)
export interface Concept {
  theme: string;
  mood: string[];
  key_experience: string;
}

// SpacePlan: 공간 배치 계획
export interface SpacePlan {
  size_pyeong: number;
  zones: { name: string; purpose: string }[];
  layout_note: string;
}

// ProposalDocument: 기획 제안서
export interface ProposalDocument {
  proposal_id: string;
  rfp_id: string;
  client_brand: ClientBrand;
  proposal_angle: ProposalAngle;
  concept: Concept;
  target_segment: { primary: string; segments: string[]; insight: string };
  space_plan: SpacePlan;
  production_items: ProductionItem[];
  schedule: { lead_time_days: number; milestones: string[] };
  scope_boundary: { included: string[]; excluded: string[] };
  success_metric: string[];
  contributors: PersonaRef[];
  field_provenance: FieldProvenance[];
  review_queue: ReviewQueueItem[];
}

// QuoteLine: 견적서 항목
export interface QuoteLine {
  line_id: string;
  source_item_id: string;    // → ProductionItem.item_id
  name: string;
  category: BtlItemCategory;
  qty: number;
  unit_price: number;        // 단가 마스터에서
  amount: number;            // qty × unit_price
}

// QuoteDocument: 견적서
export interface QuoteDocument {
  quote_id: string;
  proposal_id: string;
  client_brand: ClientBrand;
  line_items: QuoteLine[];
  subtotal: number;          // Σ line.amount
  overhead: number;          // 간접비
  margin: number;            // 마진
  total: number;             // subtotal + overhead + margin
  currency: "KRW";
  scope_boundary: { included: string[]; excluded: string[] };
  assumptions: string[];
  validity: { until: string };
  version: number;
  issued_at: string;
}

// ───────────────────────── BTL 제안서 Facet 계층 모델 ─────────────────────────
// 3개 독립 엔티티: FacetNode(컨셉 keystone 계층), ResearchDigest(grounding),
// RFPSeed(constraint). 엔티티끼리는 임베드 금지 — 참조(id)로만 연결.

// FacetNode.type 열거
export type FacetType =
  | "concept"    // keystone: 컨셉 루트
  | "space"      // 공간 배치
  | "md"         // 마케팅·MD 콘텐츠
  | "routing"    // 동선/라우팅
  | "schedule"   // 일정
  | "event"      // 이벤트
  | "persona";   // 프로젝트 페르소나

// FacetNode.status 열거
export type FacetStatus = "clean" | "stale";

// FacetNode.provenance 열거
export type FacetProvenance = "rfp" | "research" | "generated" | "unspecified";

// FacetNode.mode 열거 (rfp_seed_ref 있을 때 rfp_spectrum→자동매핑, 사람 override 가능)
export type FacetMode = "generate" | "validate";

// stale_diff: clean→stale 전환 시 필수 채움 (불변식)
export interface FacetStaleDiff {
  changed_field: string;
  before: string;
  after: string;
  triggered_at: string; // ISO 8601
}

// version_history 항목
export interface FacetVersionEntry {
  v: number;
  timestamp: string;   // ISO 8601
  author: "human" | "system";
  trigger: string;     // 상류 facet id 또는 enum: init | digest_update | mode_override
}

// persona_comment 항목 (2단 합성: role stage → project stage)
export interface FacetPersonaComment {
  role_persona_id: string;       // BTL 역할 페르소나 id
  project_persona_ref?: string;  // stage=project일 때만 — 프로젝트 페르소나 facet id
  stage: "role" | "project";     // WHO(role) → HOW(project) 2단 분리
  body: string;
}

// FacetNode: 제안서 단계 facet 엔티티
// 사람 본문(body)은 자동삭제/자동재생성 금지.
// stale 전파는 1-hop 직속(children)만 — 전이적 연쇄 표시 금지.
export interface FacetNode {
  // ── 식별 ──
  id: string;
  type: FacetType;

  // ── 트리 구조 ──
  parent: string | null;  // null이면 keystone root
  is_root: boolean;       // parent === null인 keystone 여부
  children: string[];     // 1-hop 하류 facet id 목록

  // ── 상태 ──
  status: FacetStatus;

  // ── 출처·모드 ──
  provenance: FacetProvenance;
  mode: FacetMode;

  // ── 본문 (사람 작업물 보존) ──
  body: string;

  // ── 페르소나 코멘트 (2단 합성 결과) ──
  persona_comment: FacetPersonaComment[];

  // ── stale 전파 diff (clean→stale 전환 시 필수) ──
  stale_diff?: FacetStaleDiff;

  // ── 버전 이력 ──
  version_history: FacetVersionEntry[];

  // ── mode override (사람이 명시한 override — computeDefaultMode보다 우선) ──
  // 비어 있으면 computeDefaultMode 결과를 사용; 사람이 직접 설정 시 우선 적용.
  // trigger=mode_override로 version_history에 기록.
  mode_override?: FacetMode;

  // ── 참조 (임베드 금지) ──
  digest_refs: string[];       // ResearchDigest id 목록
  rfp_seed_ref?: string;       // RFPSeed id (provenance=rfp일 때)
  persona_lens_ref?: string;   // type=concept일 때 — 채택한 프로젝트 페르소나 facet id
}

// ── ResearchDigest: 리서치 grounding 엔티티 ──
// research_type별 raw_ref 서브타입
export interface DigestRawRefBrand { brand_name: string; position: string }
export interface DigestRawRefArea  { district: string; coords?: [number, number] }
export interface DigestRawRefTarget { segment: string; size?: number }
export interface DigestRawRefMarket { category: string; trend?: string }

export type DigestRawRef =
  | DigestRawRefBrand
  | DigestRawRefArea
  | DigestRawRefTarget
  | DigestRawRefMarket;

export type DigestResearchType = "brand" | "area" | "target" | "market";

export interface ResearchDigest {
  id: string;
  research_type: DigestResearchType;
  claim: string;        // 1줄 핵심 (공통 헤더)
  confidence: number;   // float [0.0, 1.0]
  implication: string;  // 컨셉 함의 (공통 헤더)
  source: string;       // 출처 라벨
  raw_ref?: DigestRawRef; // research_type별 서브타입 (optional)
}

// ── RFPSeed: RFP constraint 엔티티 ──
export type RfpSpectrum = "none" | "thin" | "rich";

export interface RFPSeed {
  id: string;
  objective: string;
  narrative_parts?: string[];  // RFP 제시 서사 파트
  scope?: string;
  budget?: string;
  seeded_facet_ids: string[];  // seed한 facet id 목록
  rfp_spectrum: RfpSpectrum;   // none/thin → mode=generate, rich → mode=validate
}

// ─────────────────────────────────────────────────────────────────────────────

// PricingMasterItem: mock-pricing.json 단가 마스터 항목
export interface PricingMasterItem {
  item_key: string;          // ProductionItem.item_name 과 매칭하는 키
  category: BtlItemCategory;
  unit_price: number;
  unit: string;              // 예: "개", "일", "식"
  description: string;
}

// BtlScenarioPack: C-btl 시나리오 전용 팩 (ScenarioPack 확장)
export interface BtlScenarioPack {
  id: "C-btl";
  brandBrief: string;
  promptFragments: string;
  mockRfp: RfpDocument;                    // mock-rfp.json
  mockPricing: PricingMasterItem[];        // mock-pricing.json
  mockPatternCards: PatternCard[];         // mock-pattern-cards.json
}
