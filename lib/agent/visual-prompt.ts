// Higgsfield 비주얼 프롬프트 빌더 — "실제 인스타그램 게시물처럼" 이미지 위에 카피가 얹힌
// 마케팅 비주얼을 만들기 위한 프롬프트 조립 로직. 서버/클라이언트 무관(순수 함수).
//
// 왜 이렇게 프롬프팅하나 (전략):
//  1) 형식/비율을 먼저 못박는다 — 피드 4:5, 캐러셀 4:5(슬라이드 일관 템플릿), 릴스 커버 9:16.
//     인스타 규격에 맞춰 생성해야 잘리지 않고 피드에서 "진짜 게시물"처럼 보인다.
//  2) 화면에 들어갈 텍스트를 따옴표로 "정확히 이 글자" 라고 지시한다(헤드라인/서브/뱃지).
//     이미지 모델이 글자를 렌더하도록 유도. 단, 한글 글리프 정확도는 모델마다 다르므로
//     목업 미리보기에서 같은 카피를 HTML 오버레이로도 얹어 이중화한다(이 책임은 UI 쪽).
//  3) 텍스트 자리(여백)·타이포 위계(큰 헤드라인+작은 서브+코너 뱃지)·세이프마진을 지정한다.
//  4) 브랜드 톤/팔레트/무드/조명/구도/품질 태그로 마감한다.
//
// 모델은 "의미"(scene 묘사 + onImageText 문구)만 채우고, 이 빌더가 위 스캐폴딩을 입힌다.

import type { OnImageText } from "@/lib/types";

export type VisualFormat = "feed" | "carousel" | "reel" | "story";

export interface VisualPromptSpec {
  format: VisualFormat;
  scene: string;            // 피사체/장면 묘사 (영어 권장 — 이미지 모델 이해도)
  onImageText?: OnImageText; // 이미지에 새길 카피
  brandStyle?: string;      // 브랜드 팔레트/톤 (브랜드 브리프에서, 선택)
  mood?: string;            // 무드/분위기 (선택)
}

const ASPECT_BY_FORMAT: Record<VisualFormat, string> = {
  feed: "4:5",
  carousel: "4:5",
  reel: "9:16",
  story: "9:16",
};

/** 형식 → 인스타 권장 비율. */
export function aspectFor(format: VisualFormat): string {
  return ASPECT_BY_FORMAT[format] ?? "4:5";
}

const FORMAT_FRAMING: Record<VisualFormat, string> = {
  feed: "vertical 4:5 Instagram feed post, single hero composition",
  carousel:
    "vertical 4:5 Instagram carousel slide, consistent layout template suitable for a multi-slide set",
  reel: "vertical 9:16 Instagram Reel cover frame, dynamic opening shot, motion-ready composition",
  story: "vertical 9:16 Instagram story frame",
};

/** onImageText → 이미지 모델용 텍스트 렌더 지시문. */
function textInstruction(t?: OnImageText): string {
  if (!t) return "";
  const parts: string[] = [
    `Render this EXACT Korean text crisply and legibly as the main typographic headline, correct spelling, no garbled or extra letters: "${t.headline}".`,
  ];
  if (t.sub) parts.push(`A smaller supporting line beneath the headline: "${t.sub}".`);
  if (t.badge) parts.push(`A small corner badge/sticker reading "${t.badge}".`);
  parts.push(
    "Keep clean negative space for the text with a strong type hierarchy; all text inside safe margins, not cropped",
  );
  return parts.join(" ");
}

/**
 * 스펙 → { prompt, aspect }. prompt 는 Higgsfield 에 그대로 넘길 최종 프롬프트.
 */
export function buildHiggsfieldPrompt(spec: VisualPromptSpec): {
  prompt: string;
  aspect: string;
} {
  const aspect = aspectFor(spec.format);
  const layers = [
    FORMAT_FRAMING[spec.format] ?? FORMAT_FRAMING.feed,
    spec.scene.trim(),
    spec.brandStyle?.trim(),
    spec.mood?.trim(),
    textInstruction(spec.onImageText),
    "modern brand marketing visual, editorial art direction, professional studio quality, " +
      "high resolution, balanced composition, no watermark, no fake brand logos",
  ].filter((s): s is string => !!s && s.length > 0);
  return { prompt: layers.join(". "), aspect };
}
