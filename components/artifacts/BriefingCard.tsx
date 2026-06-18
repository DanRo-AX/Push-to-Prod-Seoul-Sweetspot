"use client";

// 아침 브리핑 카드 — "출근 전에 도착한 브리핑" 아티팩트 렌더링
// VS Code 문서 idiom(.ide-doc-*): 문서 헤더 + 오늘의 픽 callout + 항목별 섹션/리스트.
// 토큰 기반이라 .ide-doc 다크 스코프에선 자동 다크, 흰 standalone 에서도 안 깨진다.
import type { MorningBriefing } from "@/lib/types";

function formatKoreanDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export function BriefingCard({ briefing }: { briefing: MorningBriefing }) {
  return (
    <div className="ide-doc-in">
      {/* 문서 헤더 — codicon + 제목 + 우측 한글 날짜 메타 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-coffee" aria-hidden />
        <span className="ide-doc-head-title">출근 전에 도착한 브리핑</span>
        {/* 한글 날짜 — 모노(메타) 대신 시스템 톤 우측 정렬 */}
        <span
          className="ide-doc-head-meta"
          style={{ fontFamily: "inherit", letterSpacing: "-0.01em" }}
        >
          {formatKoreanDate(briefing.date)}
        </span>
      </div>

      {/* 오늘의 추천 액션 — 문서의 첫 시선 포인트(callout) */}
      <div className="ide-doc-callout ide-doc-callout--warn">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--warn)]">
          <i className="codicon codicon-star-full" aria-hidden style={{ fontSize: 12 }} />
          오늘의 추천 액션
        </div>
        <p className="text-[14px] font-semibold leading-relaxed text-[var(--text-1)]">
          {briefing.todaysPick}
        </p>
      </div>

      {/* 브리핑 항목 — 각 항목을 섹션으로(헤드라인=섹션 헤더, 본문/출처/할 일) */}
      {briefing.items.map((item, i) => (
        <section key={i} className="ide-doc-section">
          <div className="ide-doc-section-head">
            <span className="num" style={{ color: "var(--text-3)", letterSpacing: 0 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 truncate normal-case tracking-normal text-[var(--text-1)]">
              {item.headline}
            </span>
            <span className="ide-doc-section-meta">{item.source}</span>
          </div>
          <p className="text-[13px] leading-relaxed text-[var(--text-2)]">
            {item.summary}
          </p>
          {/* recommendedAction — ok 톤 callout */}
          <div className="ide-doc-callout ide-doc-callout--ok mt-2.5 flex gap-2">
            <i
              className="codicon codicon-arrow-right shrink-0 text-[var(--ok)]"
              aria-hidden
              style={{ marginTop: 2 }}
            />
            <span>
              <span className="mr-1.5 font-semibold text-[var(--ok)]">오늘 할 일</span>
              <span className="text-[var(--text-1)]">{item.recommendedAction}</span>
            </span>
          </div>
        </section>
      ))}
    </div>
  );
}
