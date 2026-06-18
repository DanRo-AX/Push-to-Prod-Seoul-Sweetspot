// 카피 작법 방법론 상수 + 순수 헬퍼 (시나리오 무관 · 의존성 0)
// ─────────────────────────────────────────────────────────────────────────────
// 스팸어/금지 jargon/제목 트리거/톤 룰셋 같은 *브랜드와 직교하는 방법론 지식*을
// 한 곳에 모은 모듈. 시나리오 팩(브랜드 데이터)과 별개로 교체된다.
//
// 이 상수와 헬퍼는 lib/agent/tools.ts 의 순수 빌더가 공유한다:
//   - finalizeNewsletterDraft (draft_newsletter)
//   - buildSubjectLab        (optimize_subject_lines)
//   - buildCopyCritique      (critique_copy)
//
// 새 npm 의존성 없이 상수 + 순수 함수로만 구성한다. 부수효과 없음.
//
// 가드레일: 모든 파생 수치(글자수·스팸위험·점수)는 여기서 결정론적으로 계산하고
// 모델은 인용만 한다. SDK/모델 호출 없음.

import type { SubjectVariant } from "@/lib/types";

// ───────────────────────── 방법론 상수 ─────────────────────────

// 스팸 필터를 자극하는 단어/신호 (한국어 + 영어). 제목/본문 스캔에 공통 사용.
export const SPAM_TERMS: readonly string[] = [
  "무료",
  "공짜",
  "100%",
  "지금 바로",
  "한정",
  "초특가",
  "당첨",
  "보장",
  "free",
  "guarantee",
  "click here",
  "$$$",
  "act now",
  "limited time",
];

// 과장어/공허한 jargon — 신뢰를 깎는 표현. 톤 스캔에 공통 사용.
export const TONE_BANNED: readonly string[] = [
  "amazing",
  "incredible",
  "game-changing",
  "game changing",
  "synergy",
  "leverage",
  "circle back",
  "혁신적인",
  "최고의",
  "압도적인",
  "완벽한",
];

// 콜드메일 첫 줄 안티패턴 — 자기소개/상투구로 시작하면 열람률을 깎는다.
export const COLD_OPENER_ANTIPATTERNS: readonly string[] = [
  "i hope this finds you well",
  "i hope this email finds you well",
  "my name is",
  "안녕하세요, 저는",
  "바쁘신 와중에",
];

// 제목 angle 가중치 — 예상 상대오픈 점수의 결정론 휴리스틱 기준값(0~100 베이스).
// AICMO 5트리거 기준. buildSubjectLab 의 projectedOpenScore 계산에 사용.
export const ANGLE_WEIGHTS: Record<SubjectVariant["angle"], number> = {
  curiosity: 78,
  urgency: 74,
  personalization: 82,
  social_proof: 80,
  direct_benefit: 76,
};

// 제목 길이 가드: 모바일 받은편지함에서 잘리지 않는 최대 글자수.
export const SUBJECT_MOBILE_MAX = 40;

// 프리헤더 권장 길이 범위 (제목 비반복 · 생각 완성).
export const PREHEADER_MIN = 40;
export const PREHEADER_MAX = 90;

// 읽기 속도: 한국어 ~300자/분, 영어 단어 혼재 → 보수적 분당 280자.
export const READ_CHARS_PER_MINUTE = 280;

// 뉴스레터 오픈율 벤치마크(%) — analyze_newsletter_performance 의 위생 경보 기준.
export const NEWSLETTER_OPENRATE_BENCHMARK = 35;

// ───────────────────────── 순수 헬퍼 ─────────────────────────

export interface SubjectScore {
  charCount: number;            // 코드포인트 기준 글자수 (한글 정확)
  truncatedOnMobile: boolean;   // charCount > SUBJECT_MOBILE_MAX
  spamFlags: string[];          // 감지된 스팸/금지 신호
  spamRisk: SubjectVariant["spamRisk"]; // 플래그 수로 등급화
}

// 제목 한 줄을 결정론적으로 채점 — 글자수·모바일 잘림·스팸 플래그·스팸 위험.
// finalizeNewsletterDraft / buildSubjectLab 가 공유한다.
export function scoreSubject(text: string): SubjectScore {
  const charCount = [...text].length; // 코드포인트 기준 (한글/이모지 정확)
  const spamFlags: string[] = [];

  if (/!/.test(text)) spamFlags.push("느낌표");
  // 영문 전부 대문자(공백/문장부호 허용) — 한글에는 대문자 개념 없으므로 영문 한정
  if (/[A-Z]/.test(text) && /^[A-Z\s!?.,]+$/.test(text)) spamFlags.push("전부 대문자");

  const lower = text.toLowerCase();
  for (const t of SPAM_TERMS) {
    if (lower.includes(t.toLowerCase())) spamFlags.push(`스팸어:${t}`);
  }

  const spamRisk: SubjectVariant["spamRisk"] =
    spamFlags.length >= 3
      ? "high"
      : spamFlags.length === 2
        ? "medium"
        : spamFlags.length === 1
          ? "low"
          : "none";

  return {
    charCount,
    truncatedOnMobile: charCount > SUBJECT_MOBILE_MAX,
    spamFlags,
    spamRisk,
  };
}

export interface ToneScan {
  emDash: boolean;              // em-dash(—) 사용 여부
  flags: string[];             // 톤 위반 라벨 (em-dash·과장어/jargon·스팸어)
}

// 본문/카피 톤을 결정론적으로 스캔 — em-dash·과장어·jargon·스팸어.
// finalizeNewsletterDraft.toneFlags / buildCopyCritique 가 공유한다.
export function scanTone(text: string): ToneScan {
  const flags: string[] = [];
  const emDash = /—/.test(text);
  if (emDash) flags.push("em-dash(—) 사용");

  const lower = text.toLowerCase();
  for (const t of TONE_BANNED) {
    if (lower.includes(t.toLowerCase())) flags.push(`과장어/jargon:${t}`);
  }
  for (const t of SPAM_TERMS) {
    if (lower.includes(t.toLowerCase())) flags.push(`스팸어:${t}`);
  }

  return { emDash, flags };
}

// 예상 읽기 시간(초) — 단어수 대신 코드포인트 기준(한글 정확), 최소 15초.
export function estimateReadSeconds(text: string): number {
  const chars = [...text].length;
  return Math.max(15, Math.round((chars / READ_CHARS_PER_MINUTE) * 60));
}

// 제목 angle + 점수로 예상 상대오픈(0~100) 결정론 추정 — buildSubjectLab 용.
// angle 가중치에서 글자수 초과 페널티와 스팸 위험 페널티를 차감한다("추정" 라벨).
export function projectOpenScore(
  angle: SubjectVariant["angle"],
  score: SubjectScore,
): number {
  let value = ANGLE_WEIGHTS[angle];
  if (score.truncatedOnMobile) {
    value -= Math.min(20, (score.charCount - SUBJECT_MOBILE_MAX) * 2);
  }
  const spamPenalty = { none: 0, low: 8, medium: 18, high: 32 }[score.spamRisk];
  value -= spamPenalty;
  return Math.max(0, Math.min(100, Math.round(value)));
}
