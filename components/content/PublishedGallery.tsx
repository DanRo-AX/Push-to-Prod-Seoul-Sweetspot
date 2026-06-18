"use client";

// 발행된 인스타그램 게시물 갤러리 — contentPerformance 의 발행작을 "실물 카드"로 보여준다.
// 이미지 대신 순백 미니멀 토큰 그라데이션 플레이스홀더 + 성과 수치 오버레이.
// (초안 폰 프레임은 components/artifacts/InstagramMockup 재사용 — 여기는 발행작 전용 변형)

import type { ContentPerformanceReport, PostPerformance } from "@/lib/types";
import { Logo } from "@/components/Logo";

const MONO = "font-[family-name:var(--font-geist-mono)]";

// 발행작 썸네일의 추상 이미지 표면 — 순백 미니멀 계열.
// 버밀리언 틴트(--accent 알파) ↔ 가라앉은 표면 톤(--bg-2/오커 알파)으로 짠 미세 그라디언트.
// 글로우/보라/시안 폐기. 토큰 리터럴: accent #d9472a · warn #b8791f · bg-2 #f0f0ef
const CARD_GRADIENTS = [
  "from-[rgba(217,71,42,0.16)] to-[rgba(184,121,31,0.08)]",
  "from-[rgba(184,121,31,0.14)] to-[rgba(217,71,42,0.07)]",
  "from-[rgba(217,71,42,0.12)] to-[rgba(240,240,239,0.6)]",
  "from-[rgba(184,121,31,0.10)] to-[rgba(217,71,42,0.14)]",
];

// 1만 이상은 한국어 컴팩트 표기('1.8만') — 좁은 성과 셀에서 자릿수 중간 줄바꿈 방지
const compactKo = new Intl.NumberFormat("ko", {
  notation: "compact",
  maximumFractionDigits: 1,
});
function fmtCount(n: number): string {
  return n >= 10_000 ? compactKo.format(n) : n.toLocaleString("ko-KR");
}

// 최신 스냅샷 — D+7 집계가 있으면 D+7, 없으면 D+1
function latestSnapshot(p: PostPerformance) {
  return p.metricsD7
    ? { label: "D+7", m: p.metricsD7 }
    : { label: "D+1", m: p.metricsD1 };
}

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="anim-rise overflow-hidden rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="anim-shimmer aspect-square bg-[var(--bg-inset)]" />
      <div className="flex flex-col gap-2 border-t border-[var(--line-1)] px-3 py-3">
        <div className="anim-shimmer h-3 w-3/4 rounded bg-[var(--bg-3)]" />
        <div className="anim-shimmer h-3 w-1/2 rounded bg-[var(--bg-3)]" />
      </div>
    </div>
  );
}

// report 가 null 이면 로딩 스켈레톤 3장
export function PublishedGallery({
  report,
}: {
  report: ContentPerformanceReport | null;
}) {
  if (report === null) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} delay={i * 80} />
        ))}
      </div>
    );
  }

  // 최신 발행 먼저 — saveRate 정렬(report 기본)이 아니라 발행 시점 역순으로 갤러리를 깐다
  const posts = [...report.posts].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--line-2)] py-12 text-center text-sm text-[var(--text-3)]">
        아직 발행된 게시물이 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {posts.map((p, i) => {
        const snap = latestSnapshot(p);
        return (
          <article
            key={p.postId}
            className="anim-pop overflow-hidden rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)] transition-colors hover:border-[var(--line-2)]"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            {/* 이미지 플레이스홀더 — 발행 배지 + 발행일 + 하단 컨셉 오버레이.
                다크 오버레이(black/white) 폐기 → 종이 칩 + 잉크 워시로 라이트화. */}
            <div
              className={`relative aspect-square bg-gradient-to-br ${
                CARD_GRADIENTS[i % CARD_GRADIENTS.length]
              }`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[var(--ink)]/15">
                <Logo withWordmark={false} className="text-[40px]" />
              </span>
              <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--bg-1)]/85 px-2.5 py-1 text-[11px] font-bold text-[var(--ok)] backdrop-blur-sm">
                발행됨
              </span>
              <span
                className={`absolute right-2.5 top-2.5 rounded-full bg-[var(--bg-1)]/85 px-2 py-1 ${MONO} text-[10px] text-[var(--text-2)] backdrop-blur-sm`}
              >
                {p.publishedAt}
              </span>
              {/* 하단 컨셉 — 종이 워시(잉크 가독성 확보) */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--bg-1)] via-[var(--bg-1)]/85 to-transparent px-3 pb-2.5 pt-8">
                <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--ink)]">
                  {p.concept}
                </p>
                <span
                  className={`mt-1.5 inline-block rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-2)] px-1.5 py-0.5 ${MONO} text-[10px] text-[var(--text-2)]`}
                >
                  {p.format}
                </span>
              </div>
            </div>

            {/* 성과 수치 바 — 최신 스냅샷(D+7 우선) + 저장률 */}
            <div className="grid grid-cols-4 divide-x divide-[var(--line-1)] border-t border-[var(--line-1)] bg-[var(--bg-1)]/60">
              {(
                [
                  { label: "도달", value: fmtCount(snap.m.reach) },
                  { label: "좋아요", value: fmtCount(snap.m.likes) },
                  { label: "저장", value: fmtCount(snap.m.saves) },
                ] as const
              ).map((cell) => (
                <div key={cell.label} className="min-w-0 px-1 py-2.5 text-center">
                  <div className="num whitespace-nowrap text-[13px] font-bold text-[var(--text-1)]">
                    {cell.value}
                  </div>
                  <div className="truncate text-[10px] text-[var(--text-3)]">
                    {cell.label} · {snap.label}
                  </div>
                </div>
              ))}
              <div className="min-w-0 px-1 py-2.5 text-center">
                {p.saveRateD7 !== null ? (
                  <>
                    <div className="num whitespace-nowrap text-[13px] font-bold text-[var(--ok)]">
                      {p.saveRateD7}%
                    </div>
                    <div className="truncate text-[10px] text-[var(--text-3)]">
                      저장률 · D+7
                    </div>
                  </>
                ) : (
                  <>
                    <div className="num whitespace-nowrap text-[13px] font-bold text-[var(--text-3)]">
                      —
                    </div>
                    <div className="truncate text-[10px] text-[var(--text-3)]">
                      D+7 집계 전
                    </div>
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
