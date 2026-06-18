"use client";

// 승인 모달 (human-in-the-loop 게이트). 단정한 종이 다이얼로그.
// 두 종류의 승인을 다룬다 — 콜드메일 발송(cold_emails), 인스타그램 발행(instagram_publish).
// 등장 모션(.anim-rise)과 경고 보더 호흡(.anim-breathe-warn — 오커 보더 알파)은
// 애니메이션 충돌 방지를 위해 래퍼/박스로 분리한다. (글로우 없음)
// 백드롭은 octo-fade(0.25s, 동일 easing)로 부드럽게 등장 — reduced-motion 시 즉시 표시.
// 긴장감은 발광이 아니라 버밀리언/브릭 색과 카피로만 전한다.
// 열림 시 주 액션에 초기 포커스, Tab 포커스는 모달 안에서 순환한다. approval 이 null 이면 렌더 안 함.

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { ApprovalModalProps } from "@/lib/types";

const MONO = "font-[family-name:var(--font-geist-mono)]";

/** 헤더 아이콘 — 체크 실드(승인). 인라인 SVG, 버밀리언 잉크. */
function ShieldCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" aria-hidden="true">
      <path
        d="M12 3l7 2.5v5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5v-5z M9 12l2.2 2.2L15.5 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ApprovalModal({ approval, onResolve }: ApprovalModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const approveRef = useRef<HTMLButtonElement>(null);

  // 열림 시 주 액션에 초기 포커스 — 키보드만으로 즉시 결정 가능
  useEffect(() => {
    if (approval) approveRef.current?.focus();
  }, [approval]);

  // 최소 포커스 가드 — Tab/Shift+Tab 이 모달 밖으로 새지 않게 양 끝에서 순환
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !boxRef.current) return;
    const focusables = boxRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!approval) return null;

  const isInsta = approval.kind === "instagram_publish";
  const title = isInsta ? "발행 승인 요청" : "발송 승인 요청";
  const approveLabel = isInsta ? "승인하고 발행" : "승인하고 발송";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/45 p-4 backdrop-blur-sm [animation:octo-fade_0.25s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:[animation:none] sm:p-6"
    >
      {/* octo-fade 키프레임 — 백드롭 등장 전용(opacity만). reduced-motion 은 위 motion-reduce 가 담당 */}
      <style>{`@keyframes octo-fade { from { opacity: 0; } to { opacity: 1; } }`}</style>
      {/* 바깥 래퍼: 등장 모션 담당 */}
      <div className="anim-rise w-full max-w-3xl">
        {/* 안쪽 박스: 종이 카드 + 오커 보더 호흡(.anim-breathe-warn). 글로우 없음 */}
        <div
          ref={boxRef}
          className="glass-strong anim-breathe-warn flex max-h-[85vh] flex-col overflow-hidden rounded-2xl"
        >
          {/* 헤더 — 좌측 버밀리언 바로 긴장감, 헤더 아이콘 타일, 큰 제목은 명조(세리프) */}
          <div className="accent-bar border-b border-[var(--line-1)] bg-[var(--warn-dim)] px-5 py-5 sm:px-8 sm:py-6">
            <div className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--accent)]/25 bg-[var(--accent-tint)] text-[var(--accent)]"
              >
                <ShieldCheck />
              </span>
              <div className="min-w-0">
                <p
                  className={`${MONO} text-[11px] font-semibold tracking-[0.18em] text-[var(--warn)]`}
                >
                  HUMAN-IN-THE-LOOP
                </p>
                <h2 className="font-serif mt-1.5 text-[26px] font-bold text-[var(--text-1)] sm:text-[28px]">
                  {title}
                </h2>
              </div>
            </div>
            <p className="mt-2 text-base leading-relaxed text-[var(--text-2)]">
              {isInsta ? (
                <>
                  사람의 승인 없이는 발행되지 않습니다 —{" "}
                  <span className="font-semibold text-[var(--accent)]">
                    {approval.post.account ? `@${approval.post.account}` : "연결된 계정"}
                  </span>
                  에 올라갈 게시물 1건이 대기 중입니다.
                </>
              ) : (
                <>
                  사람의 승인 없이는 발송되지 않습니다 — 총{" "}
                  <span className="font-semibold text-[var(--accent)]">
                    {approval.emails.length}건
                  </span>
                  의 콜드메일이 대기 중입니다.
                </>
              )}
            </p>
          </div>

          {/* 본문 */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
            {isInsta ? (
              <div className="rounded-xl border border-[var(--line-1)] bg-[var(--bg-3)] p-4 sm:p-5">
                <div className="flex gap-4">
                  {/* 발행될 비주얼 미리보기 (4:5) */}
                  {approval.post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={approval.post.imageUrl}
                      alt="발행 비주얼"
                      className="aspect-[4/5] w-28 shrink-0 rounded-lg border border-[var(--line-1)] object-cover sm:w-36"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-[var(--text-1)]">
                        @{approval.post.account ?? "instagram"}
                      </span>
                      <span className={`${MONO} rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-3)]`}>
                        {approval.post.mediaType === "REELS"
                          ? "릴스"
                          : approval.post.mediaType === "CAROUSEL"
                            ? `캐러셀 ${approval.post.imageUrls?.length ?? 0}장`
                            : "피드 이미지"}
                      </span>
                    </div>
                    {approval.post.concept ? (
                      <p className="mt-1 text-[13px] text-[var(--text-3)]">
                        기획 · {approval.post.concept}
                      </p>
                    ) : null}
                    <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line text-[15px] leading-relaxed text-[var(--text-1)]">
                      {approval.post.caption}
                    </p>
                  </div>
                </div>
                {/* 캐러셀이면 슬라이드 썸네일 줄 */}
                {approval.post.mediaType === "CAROUSEL" && approval.post.imageUrls?.length ? (
                  <div className="mt-3 flex gap-1.5 overflow-x-auto">
                    {approval.post.imageUrls.map((u, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={u}
                        alt={`슬라이드 ${i + 1}`}
                        className="aspect-[4/5] w-16 shrink-0 rounded-md border border-[var(--line-1)] object-cover"
                      />
                    ))}
                  </div>
                ) : null}
                {(approval.post.mediaType === "REELS"
                  ? !/^https?:\/\//i.test(approval.post.videoUrl ?? "")
                  : approval.post.mediaType === "CAROUSEL"
                    ? !(approval.post.imageUrls ?? []).every((u) => /^https?:\/\//i.test(u))
                    : !/^https?:\/\//i.test(approval.post.imageUrl)) && (
                  <p className={`mt-3 ${MONO} text-[11px] text-[var(--warn)]`}>
                    ⚠ 미디어가 공개 URL 이 아닙니다(목업/로컬) — 승인해도 mock 발행으로 처리됩니다.
                  </p>
                )}
              </div>
            ) : (
              approval.emails.map((email, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--line-1)] bg-[var(--bg-3)] px-5 py-4"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-lg font-semibold text-[var(--text-1)]">
                      {email.company}
                    </span>
                    <span className="num shrink-0 text-sm text-[var(--text-3)]">
                      {email.to}
                    </span>
                  </div>
                  <p className="mt-2 text-base font-medium text-[var(--accent)]">
                    {email.subject}
                  </p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-[15px] leading-relaxed text-[var(--text-2)]">
                    {email.bodyText}
                  </p>
                  <p className={`mt-2 ${MONO} text-[11px] text-[var(--text-3)]`}>
                    팔로업 D+{email.followUpInDays} · 무응답 시
                  </p>
                </div>
              ))
            )}
          </div>

          {/* 액션 — btn-lift(보조)/btn-press(주 액션) 촉감. lg 미만은 패딩 축소로 한 줄 유지 */}
          <div className="flex items-center justify-end gap-3 border-t border-[var(--line-1)] px-5 py-4 sm:gap-4 sm:px-8 sm:py-5">
            <button
              type="button"
              onClick={() => onResolve(approval.id, false)}
              className="btn-lift rounded-xl border border-[var(--line-2)] px-5 py-3 text-base font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--danger)]/50 hover:text-[var(--danger)] sm:px-7 sm:py-3.5 sm:text-lg"
            >
              거부
            </button>
            <button
              ref={approveRef}
              type="button"
              onClick={() => onResolve(approval.id, true)}
              /* 주 액션 — 딥그린 솔리드. 글로우 금지(.btn-press 의 종이 그림자·press 촉감만). */
              className="btn-press rounded-xl bg-[var(--ok)] px-6 py-3 text-base font-bold text-white sm:px-8 sm:py-3.5 sm:text-lg"
            >
              {approveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
