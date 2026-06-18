"use client";

// 주간 캘린더 보드 — calendar 아티팩트(라이브)를 요일 그리드 보드로 펼친다.
// 라이브가 없어도 월~일 그리드 골격과 채널 칩·status 점 범례가 항상 보인다.
// (components/artifacts/CalendarBoard 의 날짜 그룹 리스트와 별개 — 스튜디오 보드 변형)

import Link from "next/link";
import type { CalendarEntry, ContentCalendar } from "@/lib/types";

const MONO = "font-[family-name:var(--font-geist-mono)]";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

// 채널 3종 — 단일 액센트 원칙상 info(=accent) 대신 에디토리얼 색으로 구분한다.
// 인스타그램=버밀리언, 뉴스레터=오커, 블로그=딥그린.
const CHANNEL_STYLE: Record<
  CalendarEntry["channel"],
  { label: string; cls: string }
> = {
  instagram: {
    label: "인스타그램",
    cls: "bg-[var(--accent-tint)] text-[var(--accent)]",
  },
  newsletter: { label: "뉴스레터", cls: "bg-[var(--warn-dim)] text-[var(--warn)]" },
  blog: { label: "블로그", cls: "bg-[var(--ok-dim)] text-[var(--ok)]" },
};

const STATUS_STYLE: Record<
  CalendarEntry["status"],
  { label: string; dot: string }
> = {
  planned: { label: "예정", dot: "bg-[var(--text-3)]" },
  drafted: { label: "초안", dot: "bg-[var(--accent)]" },
  published: { label: "발행", dot: "bg-[var(--ok)]" },
};

// ISO date → 월요일 시작 요일 인덱스 (월=0 … 일=6). 파싱 실패 시 null.
function dayIndex(iso: string): number | null {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return (d.getDay() + 6) % 7;
}

function formatMonthDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 채널 칩 + status 점 범례 — 빈 상태에서도 보드 문법을 미리 설명한다
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {Object.values(CHANNEL_STYLE).map((c) => (
        <span
          key={c.label}
          className={`rounded-[4px] px-2 py-0.5 text-[11px] font-semibold ${c.cls}`}
        >
          {c.label}
        </span>
      ))}
      <span className="h-3 w-px bg-[var(--line-2)]" aria-hidden="true" />
      {Object.values(STATUS_STYLE).map((s) => (
        <span
          key={s.label}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-3)]"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function CalendarWeekBoard({
  calendar,
}: {
  calendar: ContentCalendar | null;
}) {
  // 요일 버킷 — 라이브가 없으면 전부 빈 골격
  const buckets: CalendarEntry[][] = Array.from({ length: 7 }, () => []);
  const dayDates: (string | null)[] = Array.from({ length: 7 }, () => null);
  if (calendar) {
    const sorted = [...calendar.entries].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    for (const e of sorted) {
      const idx = dayIndex(e.date);
      if (idx === null) continue;
      buckets[idx].push(e);
      if (dayDates[idx] === null) dayDates[idx] = e.date;
    }
  }

  const total = calendar?.entries.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* 보드 헤더 — weekLabel + 범례 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-lg font-bold text-[var(--text-1)]">
            {calendar ? calendar.weekLabel : "이번 주"}
          </h3>
          {calendar && (
            <span className="num text-[12px] text-[var(--text-3)]">
              {calendar.brandName} · {total}건
            </span>
          )}
        </div>
        <Legend />
      </div>

      {/* 요일 그리드 — 좁은 화면은 가로 스크롤로 보드 형태 유지 */}
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[880px] grid-cols-7 gap-2">
          {DAY_LABELS.map((label, i) => {
            const entries = buckets[i];
            const date = dayDates[i];
            return (
              <div key={label} className="flex min-w-0 flex-col gap-1.5">
                {/* 요일 헤더 */}
                <div className="flex items-baseline justify-between px-1">
                  <span
                    className={`${MONO} text-[11px] font-semibold tracking-[0.14em] ${
                      i >= 5 ? "text-[var(--text-3)]" : "text-[var(--text-2)]"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="num text-[10px] text-[var(--text-3)]">
                    {date ? formatMonthDay(date) : ""}
                  </span>
                </div>

                {/* 슬롯 컬럼 */}
                {entries.length === 0 ? (
                  <div className="flex min-h-[112px] flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--line-1)] bg-[var(--bg-inset)]/60">
                    <span className="text-[11px] text-[var(--text-3)]">
                      비어 있음
                    </span>
                  </div>
                ) : (
                  <div className="flex min-h-[112px] flex-col gap-1.5">
                    {entries.map((e, j) => {
                      const channel = CHANNEL_STYLE[e.channel];
                      const status = STATUS_STYLE[e.status];
                      return (
                        <article
                          key={`${e.date}-${j}`}
                          title={e.objective}
                          className="anim-rise rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)] p-2.5 transition-colors hover:border-[var(--line-2)]"
                          style={{ animationDelay: `${(i * 2 + j) * 45}ms` }}
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-1.5">
                            <span
                              className={`truncate rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold ${channel.cls}`}
                            >
                              {channel.label}
                            </span>
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`}
                              title={status.label}
                            />
                          </div>
                          <h4 className="line-clamp-2 text-[13px] font-bold leading-snug text-[var(--text-1)]">
                            {e.title}
                          </h4>
                          {e.keywordRef && (
                            <span
                              className={`mt-1.5 inline-block max-w-full truncate rounded-[4px] border border-[var(--line-1)] bg-[var(--bg-3)] px-1.5 py-0.5 ${MONO} text-[10px] text-[var(--text-2)]`}
                            >
                              {e.keywordRef}
                            </span>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 빈 상태 힌트 — 골격은 위에 이미 보이므로 한 줄 안내만 */}
      {!calendar && (
        <p className="text-center text-[13px] text-[var(--text-3)]">
          아직 계획된 콘텐츠가 없습니다 —{" "}
          <Link
            href="/console"
            className="font-semibold text-[var(--text-2)] underline decoration-[var(--line-2)] underline-offset-4 transition-colors hover:text-[var(--accent)]"
          >
            콘솔에서 주간 캘린더를 요청
          </Link>
          하면 보드가 채워집니다.
        </p>
      )}
    </div>
  );
}
