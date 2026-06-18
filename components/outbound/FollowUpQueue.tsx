"use client";

// 오늘의 팔로업 큐 — computeFollowUps(클라이언트 계산) 결과를 렌더링.
// due(오늘 처리) 는 warn 톤으로 또렷하게, upcoming(예정) 은 가라앉혀 보조로 보여준다.
import type { FollowUpItem } from "@/components/outbound/followups";
import { STAGE_LABELS } from "@/components/outbound/followups";

const MONO = "font-[family-name:var(--font-geist-mono)]";

function DueRow({ item, delayMs }: { item: FollowUpItem; delayMs: number }) {
  return (
    <li
      className="anim-rise flex items-center gap-3 px-4 py-3"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warn)]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[15px] font-bold text-[var(--text-1)]">{item.name}</span>
          <span className="truncate text-[12px] text-[var(--text-3)]">{item.company}</span>
        </div>
        <div className="mt-0.5 text-[12px] text-[var(--text-3)]">
          {STAGE_LABELS[item.stage]} 단계 · 마지막 접촉{" "}
          <span className={`num ${MONO}`}>D+{item.daysSinceLastTouch}</span> · 스코어{" "}
          <span className={`num ${MONO}`}>{item.score}</span>
        </div>
      </div>
      <span className="shrink-0 rounded-[6px] bg-[var(--warn-dim)] px-2.5 py-1 text-[11px] font-semibold text-[var(--warn)]">
        {item.action}
      </span>
    </li>
  );
}

function UpcomingRow({ item }: { item: FollowUpItem }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bg-3)] ring-1 ring-[var(--line-2)]" />
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-semibold text-[var(--text-2)]">{item.name}</span>
        <span className="ml-2 truncate text-[12px] text-[var(--text-3)]">{item.company}</span>
      </div>
      <span className="shrink-0 text-[12px] text-[var(--text-3)]">
        {item.action} · <span className={`num ${MONO}`}>D-{item.dueInDays}</span>
      </span>
    </li>
  );
}

export function FollowUpQueue({
  due,
  upcoming,
  asOf,
}: {
  due: FollowUpItem[];
  upcoming: FollowUpItem[];
  asOf: string; // ISO date — 기준일 표시
}) {
  return (
    <section className="flex flex-col gap-4">
      {/* 섹션 헤더 — 공통 idiom: 모노 eyebrow 위 + 한국어 타이틀 아래 + 우측 메타 */}
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={`${MONO} text-[11px] font-semibold tracking-[0.18em] text-[var(--text-3)]`}>
            FOLLOW-UP
          </div>
          <h2 className="mt-1 truncate text-xl font-bold text-[var(--text-1)]">
            오늘의 팔로업 큐
          </h2>
        </div>
        <span className={`num shrink-0 text-[12px] text-[var(--text-3)] ${MONO}`}>{asOf}</span>
      </header>

      <div className="surface-raised overflow-hidden rounded-2xl border border-[var(--line-1)] bg-[var(--bg-1)]">
        {/* due — 오늘 처리 */}
        <div className="flex items-center gap-2 border-b border-[var(--line-1)] bg-[var(--bg-2)] px-4 py-2.5">
          <span className="text-[12px] font-semibold text-[var(--warn)]">오늘 처리</span>
          <span key={due.length} className={`num anim-tick text-[12px] font-bold text-[var(--text-1)] ${MONO}`}>
            {due.length}
          </span>
          <span className="ml-auto text-[11px] text-[var(--text-3)]">
            stage·마지막 접촉일 기준 자동 산출
          </span>
        </div>
        {due.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-[var(--text-3)]">
            오늘 처리할 팔로업이 없습니다
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line-1)]">
            {due.map((item, i) => (
              <DueRow key={item.email} item={item} delayMs={i * 50} />
            ))}
          </ul>
        )}

        {/* upcoming — 예정 */}
        {upcoming.length > 0 && (
          <>
            <div className="flex items-center gap-2 border-y border-[var(--line-1)] bg-[var(--bg-2)] px-4 py-2">
              <span className="text-[12px] font-semibold text-[var(--text-3)]">예정</span>
              <span className={`num text-[12px] text-[var(--text-3)] ${MONO}`}>
                {upcoming.length}
              </span>
            </div>
            <ul className="divide-y divide-[var(--line-1)]">
              {upcoming.map((item) => (
                <UpcomingRow key={item.email} item={item} />
              ))}
            </ul>
          </>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-[var(--text-3)]">
        팔로업 메일도 발송 전 반드시 승인 게이트를 거칩니다 — 콘솔에서 &ldquo;오늘 누구
        챙겨야 해?&rdquo;를 실행하면 에이전트가 같은 규칙으로 큐를 만들고 초안을 제출합니다.
      </p>
    </section>
  );
}
