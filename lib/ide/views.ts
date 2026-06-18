// lib/ide/views.ts — IDE 탭/뷰 단일 계약 (클라이언트 안전 순수 모듈, JSX 없음).
//
// 목적: /console IDE 안에서 "무엇이든(아티팩트 산출물 · 대시보드/콘텐츠/아웃바운드/설정
// 뷰 · 웰컴)이 하나의 일관된 VS Code 다크 탭으로" 열리도록 하는 공통 계약을 제공한다.
//   · IdeTabKind   — 탭의 종류(뷰 탭 5종 + 아티팩트 탭).
//   · ArtifactFile — 아티팩트를 "실제 파일처럼" 직렬화한 결과(파일명 + 언어 + 소스 문자열).
//                    중앙 Monaco 에디터가 이 source/language 를 그대로 먹어 신택스 하이라이트한다.
//   · artifactToFile(artifact) — kind 별로 사람이 읽기 좋은 파일명/언어/소스를 만든다.
//                    (뉴스레터/콜드메일/브리핑/카피점검 → markdown, 그 외 데이터 → pretty JSON)
//   · VIEW_META    — 각 IdeTabKind 의 한국어 라벨 · 파일풍 이름 · 아이콘 키.
//
// 규칙(중요):
//   · 이 파일은 순수 모듈이다 — React/JSX import 금지, DOM 접근 금지(서버/클라 양쪽 안전).
//   · 타입은 항상 @/lib/types 의 단일 계약에서 가져온다(아티팩트 모양 재정의 금지).
//   · 아이콘은 "키"만 노출한다(렌더는 컴포넌트가 키→SVG 로 매핑). 여기서 JSX 를 만들지 않는다.

import type {
  Artifact,
  MorningBriefing,
  InstagramPost,
  NewsletterDraft,
  ColdEmail,
} from "@/lib/types";

// ───────────────────────── 탭 종류 ─────────────────────────

/**
 * IDE 에디터 탭의 종류.
 *   · "welcome"   — 빈 상태 웰컴 탭(열린 작업 없음).
 *   · "dashboard" — 성과 대시보드 뷰(기존 흰 페이지를 .ide-view 안에서 다크로).
 *   · "content"   — 콘텐츠 스튜디오 뷰.
 *   · "outbound"  — 아웃바운드 뷰.
 *   · "settings"  — 설정 뷰.
 *   · "artifact"  — 산출물 파일 탭(아티팩트 kind 별 — 어떤 kind 인지는 탭 모델이 따로 보유).
 */
export type IdeTabKind =
  | "welcome"
  | "workflow"
  | "dashboard"
  | "content"
  | "outbound"
  | "settings"
  | "artifact";

/** 뷰 탭(아티팩트가 아닌 페이지형 탭)만 추린 보조 타입. */
export type IdeViewKind = Exclude<IdeTabKind, "artifact">;

/** Monaco 가 이해하는 언어 — 데모에서 쓰는 3종으로 한정(번들 가벼움). */
export type IdeFileLanguage = "markdown" | "json" | "plaintext";

/**
 * 아티팩트를 "실제 파일"로 직렬화한 결과.
 * 중앙 Monaco 에디터(소스 보기)가 이 값을 그대로 사용한다:
 *   · filename — 탭/에디터 모델 경로 느낌의 파일명(확장자가 아이콘/언어 힌트).
 *   · language — Monaco 신택스 하이라이트 언어.
 *   · source   — 에디터에 들어갈 본문 문자열(사람이 읽기 좋게 직렬화).
 */
export interface ArtifactFile {
  filename: string;
  language: IdeFileLanguage;
  source: string;
}

// ───────────────────────── 직렬화 헬퍼 ─────────────────────────

/** pretty JSON — 데이터 계열 아티팩트의 "소스" 직렬화 공통 함수(2-스페이스 들여쓰기). */
function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** 브리핑 → 사람이 읽기 좋은 markdown(제목 · 항목별 요약/출처/액션 · 오늘의 추천). */
function briefingToMarkdown(b: MorningBriefing): string {
  const lines: string[] = [];
  lines.push(`# 아침 브리핑 — ${b.date}`);
  lines.push("");
  lines.push(`> **오늘의 추천 액션:** ${b.todaysPick}`);
  lines.push("");
  b.items.forEach((item, i) => {
    lines.push(`## ${i + 1}. ${item.headline}`);
    lines.push("");
    lines.push(item.summary);
    lines.push("");
    lines.push(`- **출처:** ${item.source}`);
    lines.push(`- **그래서 오늘:** ${item.recommendedAction}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd() + "\n";
}

/** 인스타 게시물 묶음 → markdown(게시물별 기획/캡션/해시태그/이미지 브리프/발행 시각). */
function instagramToMarkdown(posts: InstagramPost[]): string {
  const lines: string[] = [];
  lines.push(`# 인스타그램 콘텐츠 (${posts.length}건)`);
  lines.push("");
  posts.forEach((p, i) => {
    lines.push(`## 게시물 ${i + 1} — ${p.concept}`);
    lines.push("");
    lines.push(p.caption);
    lines.push("");
    if (p.hashtags.length > 0) {
      lines.push(p.hashtags.map((t) => `#${t}`).join(" "));
      lines.push("");
    }
    lines.push(`- **이미지 브리프:** ${p.imageBrief}`);
    lines.push(`- **추천 발행:** ${p.suggestedPostTime}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd() + "\n";
}

/** 뉴스레터 초안 → markdown(제목 후보 · 프리헤더 · 프레임워크 · 본문 섹션 · CTA). */
function newsletterToMarkdown(d: NewsletterDraft): string {
  const lines: string[] = [];
  lines.push(`# ${d.subject}`);
  lines.push("");
  lines.push(`> ${d.preheader}`);
  lines.push("");

  // 제목 A/B 후보 — angle/글자수/스팸위험까지 한눈에.
  // (옵셔널 배열은 레거시/부분 데이터에서 누락될 수 있어 방어적으로 폴백 —
  //  미리보기 렌더러(NewsletterPreview)와 동일한 `?? []` 패턴. 소스 변환이 깨지지 않게.)
  const subjectVariants = d.subjectVariants ?? [];
  if (subjectVariants.length > 0) {
    lines.push("## 제목 후보 (A/B)");
    lines.push("");
    subjectVariants.forEach((v) => {
      const spamFlags = v.spamFlags ?? [];
      const flags =
        spamFlags.length > 0 ? ` · 스팸신호: ${spamFlags.join(", ")}` : "";
      lines.push(
        `- [${v.angle}] ${v.text} _(${v.charCount}자 · 스팸위험 ${v.spamRisk}${flags})_`,
      );
    });
    lines.push("");
  }

  // 구조화 메타(프레임워크/읽기시간/세그먼트)는 있을 때만 — 레거시 부분 데이터 방어.
  const metaBits: string[] = [];
  if (typeof d.framework === "string") metaBits.push(`프레임워크: ${d.framework}`);
  if (typeof d.estimatedReadSeconds === "number" && d.estimatedReadSeconds > 0) {
    metaBits.push(`예상 읽기 ${d.estimatedReadSeconds}초`);
  }
  if (metaBits.length > 0) lines.push(`_${metaBits.join(" · ")}_`);
  if (d.segment) lines.push(`_대상 세그먼트: ${d.segment}_`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // 본문 — 구조화 sections 가 있으면 섹션별로, 없으면 레거시 bodyMarkdown 폴백.
  const sections = d.sections ?? [];
  if (sections.length > 0) {
    sections.forEach((s) => {
      if (s.heading) {
        lines.push(`## ${s.heading}`);
        lines.push("");
      }
      lines.push(s.bodyMarkdown);
      lines.push("");
      if (s.whyItMatters) {
        lines.push(`> 왜 중요한가: ${s.whyItMatters}`);
        lines.push("");
      }
      if (s.sourceUrl) {
        lines.push(`출처: ${s.sourceUrl}`);
        lines.push("");
      }
    });
  } else if (d.bodyMarkdown) {
    lines.push(d.bodyMarkdown);
    lines.push("");
  }

  // CTA — 누락될 수 있어 방어적으로(있을 때만 블록 추가).
  if (d.cta) {
    lines.push("---");
    lines.push("");
    lines.push(
      d.cta.url
        ? `**[${d.cta.label}](${d.cta.url})** — 목표: ${d.cta.goal}`
        : `**${d.cta.label}** — 목표: ${d.cta.goal}`,
    );
  }

  const toneFlags = d.toneFlags ?? [];
  if (toneFlags.length > 0) {
    lines.push("");
    lines.push(`_톤 경고: ${toneFlags.join(", ")}_`);
  }
  return lines.join("\n").trimEnd() + "\n";
}

/** 콜드메일 묶음 → markdown(메일별 수신/회사/제목/본문/팔로업). */
function coldEmailsToMarkdown(emails: ColdEmail[]): string {
  const lines: string[] = [];
  lines.push(`# 콜드메일 초안 (${emails.length}건)`);
  lines.push("");
  emails.forEach((m, i) => {
    lines.push(`## ${i + 1}. ${m.company}`);
    lines.push("");
    lines.push(`- **받는 사람:** ${m.to}`);
    lines.push(`- **제목:** ${m.subject}`);
    lines.push(`- **팔로업:** 무응답 시 ${m.followUpInDays}일 후`);
    lines.push("");
    lines.push(m.bodyText);
    lines.push("");
  });
  return lines.join("\n").trimEnd() + "\n";
}

// ───────────────────────── artifactToFile ─────────────────────────

/**
 * 아티팩트 → ArtifactFile(파일명/언어/소스).
 *   · 글/카피 계열(브리핑·뉴스레터·콜드메일·인스타·카피점검) → markdown(사람이 읽기 좋게 합성).
 *   · 데이터/리포트 계열(지표·키워드·퍼널·기여·시퀀스 등) → pretty JSON(*.json).
 * 어떤 kind 든 항상 유효한 파일을 반환한다(언어는 markdown|json|plaintext 셋 중 하나).
 */
export function artifactToFile(artifact: Artifact): ArtifactFile {
  switch (artifact.kind) {
    // ── 글/카피 계열 → markdown ──
    case "briefing":
      return {
        filename: "briefing.md",
        language: "markdown",
        source: briefingToMarkdown(artifact.briefing),
      };
    case "newsletter":
      return {
        filename: "newsletter.md",
        language: "markdown",
        source: newsletterToMarkdown(artifact.draft),
      };
    case "cold_emails":
      return {
        filename: "cold-emails.md",
        language: "markdown",
        source: coldEmailsToMarkdown(artifact.emails),
      };
    case "instagram_posts":
      return {
        filename: "instagram.md",
        language: "markdown",
        source: instagramToMarkdown(artifact.posts),
      };
    case "copy_critique":
      return {
        filename: "copy-critique.json",
        language: "json",
        source: pretty(artifact.report),
      };

    // ── 데이터/리포트 계열 → pretty JSON ──
    case "metrics":
      return {
        filename: "metrics.json",
        language: "json",
        source: pretty(artifact.metrics),
      };
    case "keywords":
      return {
        filename: "keywords.json",
        language: "json",
        source: pretty(artifact.report),
      };
    case "funnel":
      return {
        filename: "funnel.json",
        language: "json",
        source: pretty(artifact.report),
      };
    case "content_performance":
      return {
        filename: "content-performance.json",
        language: "json",
        source: pretty(artifact.report),
      };
    case "calendar":
      return {
        filename: "calendar.json",
        language: "json",
        source: pretty(artifact.calendar),
      };
    case "lead_journey":
      return {
        filename: "lead-journey.json",
        language: "json",
        source: pretty(artifact.report),
      };
    case "keyword_journey":
      return {
        filename: "keyword-journey.json",
        language: "json",
        source: pretty(artifact.report),
      };
    case "attribution":
      return {
        filename: "attribution.json",
        language: "json",
        source: pretty(artifact.report),
      };
    case "follower_growth":
      return {
        filename: "follower-growth.json",
        language: "json",
        source: pretty(artifact.report),
      };
    case "tracking_audit":
      return {
        filename: "tracking-audit.json",
        language: "json",
        source: pretty(artifact.report),
      };
    case "subject_lab":
      return {
        filename: "subject-lab.json",
        language: "json",
        source: pretty(artifact.lab),
      };
    case "email_sequence":
      return {
        filename: "email-sequence.json",
        language: "json",
        source: pretty(artifact.sequence),
      };
    case "newsletter_performance":
      return {
        filename: "newsletter-performance.json",
        language: "json",
        source: pretty(artifact.report),
      };
  }

  // 안전망 — 새로운 kind 가 lib/types 에 추가됐는데 위 case 가 누락된 경우.
  // (정상 흐름에서는 도달하지 않음. 위 switch 가 모든 ArtifactKind 를 망라.)
  const fallback = artifact as { kind: string };
  return {
    filename: `${fallback.kind}.json`,
    language: "json",
    source: pretty(artifact),
  };
}

// ───────────────────────── 뷰 메타 ─────────────────────────

/** 아이콘 "키" — 렌더 컴포넌트가 키→SVG 로 매핑한다(이 모듈은 JSX 를 만들지 않는다). */
export type IdeIconKey =
  | "welcome"
  | "workflow"
  | "dashboard"
  | "content"
  | "outbound"
  | "settings"
  | "file";

/** 뷰 탭 메타 — 한국어 라벨 · 파일풍 이름(탭에 표기) · 아이콘 키 · 라우트(있으면). */
export interface ViewMetaEntry {
  /** 사용자에게 보이는 한국어 라벨(툴팁/상태바). */
  label: string;
  /** 탭에 표기되는 "파일풍" 이름(예: dashboard.tsx). */
  filename: string;
  /** 아이콘 키(컴포넌트가 SVG 로 매핑). */
  icon: IdeIconKey;
  /** 흰 페이지 단독 라우트(있으면) — 탭 외 외부 이동 어포던스에 사용. */
  route?: string;
}

/**
 * IdeTabKind → 뷰 메타.
 * "artifact" 는 kind 별 파일명이 동적(artifactToFile)이라 여기서는 공통 라벨/아이콘만 둔다.
 */
export const VIEW_META: Record<IdeTabKind, ViewMetaEntry> = {
  welcome: {
    label: "시작하기",
    filename: "welcome",
    icon: "welcome",
  },
  workflow: {
    label: "워크플로 폴더",
    filename: "workflow",
    icon: "workflow",
  },
  dashboard: {
    label: "성과 대시보드",
    filename: "dashboard.tsx",
    icon: "dashboard",
    route: "/dashboard",
  },
  content: {
    label: "콘텐츠 스튜디오",
    filename: "content.tsx",
    icon: "content",
    route: "/content",
  },
  outbound: {
    label: "아웃바운드",
    filename: "outbound.tsx",
    icon: "outbound",
    route: "/outbound",
  },
  settings: {
    label: "설정",
    filename: "settings.tsx",
    icon: "settings",
    route: "/settings",
  },
  artifact: {
    label: "산출물",
    filename: "artifact",
    icon: "file",
  },
};

/** 뷰 탭(아티팩트 제외) 순서 — 탭바/이동 메뉴의 고정 노출 순서. */
export const VIEW_TAB_ORDER: IdeViewKind[] = [
  "workflow",
  "dashboard",
  "content",
  "outbound",
  "settings",
];
