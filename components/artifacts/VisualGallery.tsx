"use client";

// 비주얼 갤러리 카드 — Higgsfield 등으로 생성한 이미지/영상을 그리드로 보여 준다.
// source 가 "mock" 이면(키 미설정/실패) 정직성 라벨을 띄운다(콜드메일 mock 패턴과 동일 결).
// 토큰 기반(.ide-doc) — 라이트/다크 무관.
import type { VisualSet } from "@/lib/types";

const isVideo = (url: string) => /\.(mp4|mov|webm)(\?|$)/i.test(url);
// data-URI(목업)는 다운로드 프록시 대상 아님 — 실제 http(s) URL 만.
const downloadable = (url: string) => /^https?:\/\//i.test(url);
const downloadHref = (url: string, name: string) =>
  `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;

export function VisualGallery({ set }: { set: VisualSet }) {
  const mock = set.source === "mock";
  return (
    <div className="ide-doc-in">
      <div className="ide-doc-head">
        <i className="codicon codicon-sparkle" aria-hidden />
        <span className="ide-doc-head-title">{set.title}</span>
        <span
          className="ide-doc-head-meta"
          style={{ fontFamily: "inherit", color: mock ? "var(--warn)" : "var(--ok)" }}
        >
          {mock ? "목업" : "Higgsfield"} · {set.aspect}
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-[var(--text-2)]">{set.brief}</p>

      {set.note ? (
        <div
          className={`ide-doc-callout mt-2 ${mock ? "ide-doc-callout--warn" : "ide-doc-callout--ok"}`}
        >
          <span className={mock ? "text-[var(--warn)]" : "text-[var(--ok)]"}>{set.note}</span>
        </div>
      ) : null}

      {/* 비주얼 그리드 */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {set.visuals.map((v, i) => (
          <figure key={i} className="m-0">
            <div
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: "var(--line-1)", background: "var(--bg-2)", aspectRatio: aspectRatio(set.aspect) }}
            >
              {isVideo(v.url) ? (
                <video src={v.url} controls className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.url} alt={v.prompt} className="h-full w-full object-cover" />
              )}
            </div>
            <figcaption className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--text-3)]">
              {v.prompt}
            </figcaption>
            {downloadable(v.url) && (
              <a
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
                href={downloadHref(v.url, `${set.title}-${i + 1}`)}
              >
                <i className="codicon codicon-cloud-download" aria-hidden style={{ fontSize: 12 }} />
                다운로드
              </a>
            )}
            {v.savedPath && (
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--ok)]" title={v.savedPath}>
                <i className="codicon codicon-save" aria-hidden style={{ fontSize: 11 }} />
                <span className="truncate">로컬 저장됨</span>
              </div>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}

// "1:1" | "9:16" | "16:9" → CSS aspect-ratio 값.
function aspectRatio(a: string): string {
  const m = a.match(/(\d+)\s*[:x/]\s*(\d+)/);
  if (m) return `${m[1]} / ${m[2]}`;
  return "1 / 1";
}
