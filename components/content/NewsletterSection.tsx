"use client";

// 뉴스레터 섹션 — 라이브 초안이 있으면 이메일 클라이언트 프레임 프리뷰(NewsletterPreview 재사용),
// 없으면 구조가 보이는 정적 고스트 프레임 + "에이전트에게 요청" 빈 상태.

import Link from "next/link";
import type { NewsletterDraft } from "@/lib/types";
import { NewsletterPreview } from "@/components/artifacts/NewsletterPreview";
import { Logo } from "@/components/Logo";

// 고스트 텍스트 바 — 빈 상태 프레임의 자리표시(시머 없음: 로딩이 아니라 '비어 있음')
function GhostBar({ className }: { className: string }) {
  return <div className={`rounded bg-[var(--bg-3)] ${className}`} />;
}

export function NewsletterSection({ draft }: { draft: NewsletterDraft | null }) {
  if (draft) {
    return <NewsletterPreview draft={draft} />;
  }

  return (
    <div className="relative">
      {/* 정적 고스트 프레임 — 초안이 채워질 자리(제목·프리헤더·본문 구조)를 그대로 보여준다 */}
      <div
        aria-hidden="true"
        className="select-none overflow-hidden rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)] opacity-60"
      >
        {/* 이메일 클라이언트 창 헤더 */}
        <div className="flex items-center gap-2 border-b border-[var(--line-1)] bg-[var(--bg-0)] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[var(--bg-3)]" />
          <span className="h-3 w-3 rounded-full bg-[var(--bg-3)]" />
          <span className="h-3 w-3 rounded-full bg-[var(--bg-3)]" />
          <span className="ml-3 text-xs text-[var(--text-3)]">
            새 메시지 — 초안 없음
          </span>
        </div>

        {/* 메일 메타 — 보낸사람은 고정, 제목/프리헤더는 고스트 바 */}
        <div className="border-b border-[var(--line-1)] px-5 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--text-3)]">
              <Logo withWordmark={false} className="text-[20px]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text-2)]">
                octopus{" "}
                <span className="font-normal text-[var(--text-3)]">
                  &lt;agent@octopus.marketing&gt;
                </span>
              </div>
              <div className="text-xs text-[var(--text-3)]">
                받는사람: 뉴스레터 구독자 전체
              </div>
            </div>
          </div>
          {/* 제목 자리 */}
          <GhostBar className="h-5 w-4/5" />
          {/* 프리헤더 자리 */}
          <div className="mt-2.5 flex items-center gap-2">
            <GhostBar className="h-3 w-1/2" />
            <span className="rounded bg-[var(--bg-3)] px-1.5 py-0.5 text-[10px] text-[var(--text-3)]">
              프리헤더
            </span>
          </div>
        </div>

        {/* 본문 구조 자리 — 제목 1 + 문단 + 리스트 + 문단 */}
        <div className="flex flex-col gap-2.5 bg-[var(--bg-1)] px-6 py-5">
          <GhostBar className="h-4 w-2/5" />
          <GhostBar className="h-3 w-full" />
          <GhostBar className="h-3 w-11/12" />
          <GhostBar className="h-3 w-3/4" />
          <div className="mt-2 flex flex-col gap-2 pl-4">
            <GhostBar className="h-3 w-2/3" />
            <GhostBar className="h-3 w-3/5" />
            <GhostBar className="h-3 w-1/2" />
          </div>
          <GhostBar className="mt-2 h-3 w-5/6" />
          <GhostBar className="h-3 w-2/3" />
        </div>

        <div className="border-t border-[var(--line-1)] px-5 py-3 text-center">
          <span className="text-xs text-[var(--text-3)]">
            초안 미리보기 — 발송 전 사람의 검토를 거칩니다
          </span>
        </div>
      </div>

      {/* 중앙 빈 상태 오버레이 — 에이전트에게 요청 CTA */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="surface-raised w-full max-w-[340px] rounded-xl border border-[var(--line-2)] bg-[var(--bg-3)]/95 px-6 py-6 text-center backdrop-blur-sm">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-tint)] text-[var(--accent)]">
            <Logo withWordmark={false} className="text-[20px]" />
          </div>
          <h3 className="mt-3 text-lg font-bold text-[var(--text-1)]">
            아직 뉴스레터 초안이 없습니다
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">
            콘솔에서 &ldquo;뉴스레터 초안 써줘&rdquo;라고 요청하면
            이 프레임에 실물 프리뷰가 채워집니다.
          </p>
          <Link
            href="/console"
            className="btn-lift mt-4 inline-block rounded-[10px] border border-[var(--line-1)] bg-[var(--bg-2)] px-4 py-2 text-[13px] font-semibold text-[var(--text-1)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]"
          >
            에이전트에게 요청
          </Link>
        </div>
      </div>
    </div>
  );
}
