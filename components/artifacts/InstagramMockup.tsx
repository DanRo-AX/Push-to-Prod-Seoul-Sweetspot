"use client";

// 인스타그램 폰 목업 — 발행 직전 피드 미리보기.
// "실제 게시물처럼" 보이도록 비주얼 위에 onImageText(헤드라인/서브/뱃지)를 HTML 오버레이로 얹는다
// (이미지 모델이 한글을 부정확하게 렌더해도 미리보기 카피는 항상 또렷하게 — 이중화).
// 형식(피드/캐러셀/릴스)에 따라 뱃지/슬라이드/릴스 스크립트를 함께 보여 준다.
// VS Code 문서 idiom(.ide-doc-*): 문서 헤더 + 폰 목업 + 선택 게시물 상세.
import { useState } from "react";
import type { InstagramMockupProps } from "@/lib/types";
import { Logo } from "@/components/Logo";

// 셀마다 돌아가며 쓰는 그라데이션 — 이미지가 없을 때의 추상 플레이스홀더.
const CELL_GRADIENTS = [
  "from-[rgba(55,148,255,0.20)] to-[rgba(204,167,0,0.10)]",
  "from-[rgba(204,167,0,0.18)] to-[rgba(55,148,255,0.08)]",
  "from-[rgba(78,201,176,0.18)] to-[rgba(55,148,255,0.08)]",
  "from-[rgba(55,148,255,0.16)] to-[rgba(78,201,176,0.12)]",
  "from-[rgba(204,167,0,0.16)] to-[rgba(78,201,176,0.10)]",
  "from-[rgba(78,201,176,0.16)] to-[rgba(204,167,0,0.12)]",
];

const FORMAT_ICON: Record<string, string> = {
  reel: "device-camera-video",
  carousel: "copy",
};
const FORMAT_LABEL: Record<string, string> = {
  reel: "릴스",
  carousel: "캐러셀",
};

export function InstagramMockup({ posts, brandName }: InstagramMockupProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedPost = selected !== null ? posts[selected] : null;

  return (
    <div className="ide-doc-in">
      {/* 문서 헤더 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-device-camera" aria-hidden />
        <span className="ide-doc-head-title">@{brandName} 피드 미리보기</span>
        <span className="ide-doc-head-meta">{posts.length}개 게시물</span>
      </div>

      {/* 폰 프레임 */}
      <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2.4rem] border-[5px] border-[var(--bg-2)] bg-[var(--bg-2)] shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
        {/* 노치 */}
        <div className="relative flex justify-center bg-[var(--bg-2)] pt-2">
          <div className="h-5 w-28 rounded-b-2xl bg-[var(--bg-2)]" />
        </div>

        {/* 인스타 상단 바 */}
        <div className="flex items-center justify-between border-b border-[var(--line-1)] bg-[var(--bg-1)] px-4 py-2.5">
          <span className="text-[15px] font-bold text-[var(--text-1)]">@{brandName}</span>
          <span className="text-[var(--text-3)]">⋯</span>
        </div>

        {/* 프로필 헤더 */}
        <div className="bg-[var(--bg-1)] px-4 py-3.5">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--accent)] to-[var(--warn)] p-[3px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--bg-1)] text-[20px] font-bold text-[var(--text-1)]">
                {brandName.charAt(0)}
              </div>
            </div>
            <div className="flex flex-1 justify-around text-center">
              <div>
                <div className="num text-[16px] font-bold text-[var(--text-1)]">{posts.length}</div>
                <div className="text-[11px] text-[var(--text-3)]">게시물</div>
              </div>
              <div>
                <div className="num text-[16px] font-bold text-[var(--text-1)]">128</div>
                <div className="text-[11px] text-[var(--text-3)]">팔로워</div>
              </div>
              <div>
                <div className="num text-[16px] font-bold text-[var(--text-1)]">86</div>
                <div className="text-[11px] text-[var(--text-3)]">팔로잉</div>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[13px] font-semibold text-[var(--text-1)]">{brandName}</div>
            <div className="text-[11px] leading-relaxed text-[var(--text-3)]">
              octopus 에이전트가 준비한 콘텐츠 캘린더
            </div>
          </div>
          <button className="mt-3 w-full rounded-md bg-[var(--accent)] py-1.5 text-[13px] font-semibold text-white">
            팔로우
          </button>
        </div>

        {/* 3열 피드 그리드 — 셀 위에 onImageText 헤드라인을 오버레이 */}
        <div className="grid grid-cols-3 gap-[2px] bg-[var(--bg-2)] pb-1">
          {posts.map((post, i) => {
            const headline = post.onImageText?.headline ?? post.concept;
            const fmtIcon = post.format ? FORMAT_ICON[post.format] : undefined;
            return (
              <button
                key={i}
                onClick={() => setSelected(selected === i ? null : i)}
                style={{ animationDelay: `${i * 90}ms` }}
                className={`anim-pop relative aspect-square overflow-hidden bg-[var(--bg-2)] bg-gradient-to-br ${
                  CELL_GRADIENTS[i % CELL_GRADIENTS.length]
                } ${
                  selected === i
                    ? "ring-2 ring-inset ring-[var(--accent-bright)]"
                    : "hover:opacity-90"
                }`}
              >
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.imageUrl}
                    alt={post.concept}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[var(--text-1)]/12">
                    <Logo withWordmark={false} className="text-[30px]" />
                  </span>
                )}
                {/* 코너 뱃지 — 합성카드면 이미지에 이미 구워져 있으므로 생략 */}
                {!post.composited && post.onImageText?.badge ? (
                  <span className="absolute left-1 top-1 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {post.onImageText.badge}
                  </span>
                ) : null}
                {/* 형식 아이콘 (릴스/캐러셀) */}
                {fmtIcon ? (
                  <i
                    className={`codicon codicon-${fmtIcon} absolute right-1 top-1 text-white drop-shadow`}
                    style={{ fontSize: 13 }}
                    aria-hidden
                  />
                ) : null}
                {/* 헤드라인 오버레이 — 합성카드면 텍스트가 이미 베이크되어 있으므로 생략 */}
                {!post.composited ? (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-5 text-left">
                    <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-white/95">
                      {headline}
                    </span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* 선택된 게시물 상세 */}
        {selectedPost && (
          <div className="border-t border-[var(--line-1)] bg-[var(--bg-0)] px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-[var(--accent)] to-[var(--warn)]" />
                <span className="text-[13px] font-semibold text-[var(--text-1)]">{brandName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedPost.format && selectedPost.format !== "feed" ? (
                  <span className="ide-doc-pill">{FORMAT_LABEL[selectedPost.format]}</span>
                ) : null}
                <span className="ide-doc-pill ide-doc-pill--accent">
                  {selectedPost.suggestedPostTime} 발행 추천
                </span>
              </div>
            </div>

            {/* 커버 비주얼 + onImageText 오버레이 + 다운로드 */}
            {selectedPost.imageUrl && (
              <div className="mb-2">
                <div className="relative overflow-hidden rounded-lg border border-[var(--line-1)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedPost.imageUrl} alt={selectedPost.concept} className="w-full" />
                  {/* 합성카드(composited)면 카피가 이미 이미지에 구워져 있으므로 HTML 오버레이 생략 */}
                  {!selectedPost.composited && selectedPost.onImageText?.badge ? (
                    <span className="absolute left-2 top-2 rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">
                      {selectedPost.onImageText.badge}
                    </span>
                  ) : null}
                  {!selectedPost.composited && selectedPost.onImageText?.headline ? (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-9">
                      <p className="text-[15px] font-bold leading-tight text-white">
                        {selectedPost.onImageText.headline}
                      </p>
                      {selectedPost.onImageText.sub ? (
                        <p className="mt-0.5 text-[11px] leading-snug text-white/85">
                          {selectedPost.onImageText.sub}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {/^https?:\/\//i.test(selectedPost.imageUrl) && (
                  <a
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-bright)] hover:underline"
                    href={`/api/download?url=${encodeURIComponent(selectedPost.imageUrl)}&name=${encodeURIComponent(`${brandName}-insta-${(selected ?? 0) + 1}`)}`}
                  >
                    <i className="codicon codicon-cloud-download" aria-hidden style={{ fontSize: 12 }} />
                    이미지 다운로드
                  </a>
                )}
              </div>
            )}

            {/* 캐러셀 슬라이드 */}
            {selectedPost.slides && selectedPost.slides.length > 0 && (
              <div className="mb-2">
                <div className="mb-1 text-[11px] text-[var(--text-3)]">
                  캐러셀 · {selectedPost.slides.length}장
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {selectedPost.slides.map((sl, j) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={j}
                      src={sl.url}
                      alt={`슬라이드 ${j + 1}`}
                      className="h-28 w-auto shrink-0 rounded-md border border-[var(--line-1)] object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 릴스 기획 스크립트 */}
            {selectedPost.reel && (
              <div className="mb-2 rounded-lg border border-[var(--line-1)] bg-[var(--bg-1)] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-bright)]">
                  <i className="codicon codicon-device-camera-video" aria-hidden style={{ fontSize: 12 }} />
                  릴스 기획 · {selectedPost.reel.durationSec}초
                </div>
                <p className="text-[11px] leading-snug text-[var(--text-1)]">
                  <span className="text-[var(--text-3)]">훅 · </span>
                  {selectedPost.reel.hook}
                </p>
                <ol className="mt-1.5 space-y-1">
                  {selectedPost.reel.scenes.map((s, j) => (
                    <li key={j} className="text-[11px] leading-snug text-[var(--text-2)]">
                      <span className="num text-[var(--text-3)]">{s.timecode}</span> — {s.visual}
                      {s.onScreenText ? (
                        <span className="text-[var(--accent-bright)]"> 〔자막: {s.onScreenText}〕</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <p className="mt-1.5 text-[11px] text-[var(--text-3)]">
                  오디오 · {selectedPost.reel.audioSuggestion}
                </p>
                <p className="text-[11px] text-[var(--text-3)]">CTA · {selectedPost.reel.cta}</p>
              </div>
            )}

            <p className="mb-1 text-[11px] text-[var(--text-3)]">기획 의도 · {selectedPost.concept}</p>
            <p className="mb-2 whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-1)]">
              {selectedPost.caption}
            </p>
            <p className="text-[13px] leading-relaxed text-[var(--accent-bright)]">
              {selectedPost.hashtags.map((tag) => `#${tag}`).join(" ")}
            </p>
          </div>
        )}
      </div>

      {!selectedPost && posts.length > 0 && (
        <p className="mt-3 text-center text-[11px] text-[var(--text-3)]">
          피드 셀을 누르면 캡션·비주얼·릴스 기획을 볼 수 있습니다
        </p>
      )}

      {/* 하단 라벨 — human-in-the-loop 강조 */}
      <div className="ide-doc-callout ide-doc-callout--warn mt-4 flex items-center justify-center gap-1.5 text-center">
        <i className="codicon codicon-eye" aria-hidden style={{ fontSize: 13 }} />
        <span className="text-[12px] font-medium text-[var(--warn)]">
          발행 직전 미리보기 — 실제 발행은 사람이 승인합니다 (publish_instagram_post)
        </span>
      </div>
    </div>
  );
}
