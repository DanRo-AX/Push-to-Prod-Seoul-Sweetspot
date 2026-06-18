"use client";

// 인스타그램 발행 결과 카드 — 승인 후 실제(또는 mock) 발행된 게시물.
// 토큰 미설정/비공개 이미지 등으로 실제 발행이 안 된 경우 mock 라벨로 정직하게 표시한다
// (콜드메일 mock 패턴과 동일 결). 토큰 기반(.ide-doc) — 라이트/다크 무관.
import type { InstagramPublishResult } from "@/lib/types";

export function InstagramPublishedCard({
  result,
  brandName,
}: {
  result: InstagramPublishResult;
  brandName: string;
}) {
  const mock = result.mock;
  const account = result.account ?? brandName;
  return (
    <div className="ide-doc-in">
      <div className="ide-doc-head">
        <i className="codicon codicon-broadcast" aria-hidden />
        <span className="ide-doc-head-title">@{account} 발행</span>
        <span
          className="ide-doc-head-meta"
          style={{ fontFamily: "inherit", color: mock ? "var(--warn)" : "var(--ok)" }}
        >
          {mock ? "mock 발행" : "실제 발행"}
        </span>
      </div>

      <div className="flex gap-4">
        {result.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.imageUrl}
            alt="발행 비주얼"
            className="aspect-[4/5] w-28 shrink-0 rounded-lg border object-cover"
            style={{ borderColor: "var(--line-1)" }}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-1)]">
            {result.caption}
          </p>
        </div>
      </div>

      {result.note ? (
        <div
          className={`ide-doc-callout mt-3 ${mock ? "ide-doc-callout--warn" : "ide-doc-callout--ok"}`}
        >
          <span className={mock ? "text-[var(--warn)]" : "text-[var(--ok)]"}>{result.note}</span>
        </div>
      ) : null}

      {result.permalink ? (
        <a
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
          href={result.permalink}
          target="_blank"
          rel="noreferrer"
        >
          <i className="codicon codicon-link-external" aria-hidden style={{ fontSize: 12 }} />
          게시물 보기
        </a>
      ) : null}
    </div>
  );
}
