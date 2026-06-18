"use client";

// 주간 콘텐츠 캘린더 — plan_content_calendar 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 날짜별 섹션 + 항목 리스트 행(채널 pill · status 점 · keywordRef).
import type { ContentCalendarProps, CalendarEntry } from "@/lib/types";

const CHANNEL_STYLE: Record<
  CalendarEntry["channel"],
  { label: string; pill: string; icon: string }
> = {
  instagram: { label: "인스타그램", pill: "ide-doc-pill--accent", icon: "device-camera" },
  newsletter: { label: "뉴스레터", pill: "ide-doc-pill--warn", icon: "mail" },
  blog: { label: "블로그", pill: "ide-doc-pill--ok", icon: "book" },
};

const STATUS_STYLE: Record<
  CalendarEntry["status"],
  { label: string; dot: string }
> = {
  planned: { label: "예정", dot: "bg-[var(--text-3)]" },
  drafted: { label: "초안", dot: "bg-[var(--accent)]" },
  published: { label: "발행", dot: "bg-[var(--ok)]" },
};

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

export function CalendarBoard({ calendar }: ContentCalendarProps) {
  const entries = calendar.entries;

  // 날짜별 그룹 (날짜 오름차순)
  const byDate = new Map<string, CalendarEntry[]>();
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const group = byDate.get(e.date);
    if (group) group.push(e);
    else byDate.set(e.date, [e]);
  }
  const groups = [...byDate.entries()];

  return (
    <div className="ide-doc-in">
      {/* 문서 헤더 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-calendar" aria-hidden />
        <span className="ide-doc-head-title">
          {calendar.weekLabel} 콘텐츠 캘린더
        </span>
        <span className="ide-doc-head-meta">
          {calendar.brandName} · {entries.length}건
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="ide-doc-callout">아직 계획된 콘텐츠가 없습니다.</div>
      ) : (
        groups.map(([date, dayEntries]) => (
          <section key={date} className="ide-doc-section">
            <div className="ide-doc-section-head">
              <i className="codicon codicon-calendar" aria-hidden />
              <span className="normal-case tracking-normal">{formatDay(date)}</span>
              <span className="ide-doc-section-meta">{dayEntries.length}건</span>
            </div>
            <div className="ide-doc-list">
              {dayEntries.map((e, i) => {
                const channel = CHANNEL_STYLE[e.channel];
                const status = STATUS_STYLE[e.status];
                return (
                  <div
                    key={`${date}-${i}`}
                    className="ide-doc-row"
                    style={{ alignItems: "flex-start", minHeight: 0, paddingBlock: 8 }}
                  >
                    <i
                      className={`codicon codicon-${channel.icon}`}
                      aria-hidden
                      style={{ marginTop: 2 }}
                    />
                    <div className="ide-doc-row-main" style={{ whiteSpace: "normal" }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-[var(--text-1)]">
                          {e.title}
                        </span>
                        <span className={`ide-doc-pill ${channel.pill}`}>
                          {channel.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--text-3)]">
                        {e.objective}
                      </p>
                      {e.keywordRef && (
                        <span className="mt-1.5 inline-block rounded border border-[var(--line-1)] bg-[var(--bg-2)] px-1.5 py-0.5 font-[family-name:var(--ide-mono,var(--font-geist-mono))] text-[10px] text-[var(--text-2)]">
                          {e.keywordRef}
                        </span>
                      )}
                    </div>
                    {/* status 점 + 라벨 */}
                    <span className="ide-doc-row-sub flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
