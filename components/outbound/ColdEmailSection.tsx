"use client";

// 콜드메일 섹션 — 라이브 cold_emails 아티팩트(기존 ColdEmailList 재사용) + 컨택 후보.
// 라이브 초안이 도착하면 컨테이너를 key 리마운트해 anim-flash-ok 로 갱신을 강조한다.
import Link from "next/link";
import type { ColdEmail, OutboundContact } from "@/lib/types";
import { ColdEmailList } from "@/components/artifacts/ColdEmailList";

const MONO = "font-[family-name:var(--font-geist-mono)]";

export function ColdEmailSection({
  emails,
  flashKey,
  contacts,
  approvalPending,
  sentCount,
}: {
  emails: ColdEmail[] | null; // 라이브 cold_emails 아티팩트 최신본 (없으면 null)
  flashKey: string; // 아티팩트 갱신 시 바뀌는 키 — flash 리마운트 트리거
  contacts: OutboundContact[];
  approvalPending: boolean;
  sentCount: number;
}) {
  return (
    <section className="flex flex-col gap-5">
      {/* 섹션 헤더 — 공통 idiom: 모노 eyebrow 위 + 한국어 타이틀 아래 + 우측 상태 칩 */}
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={`${MONO} text-[11px] font-semibold tracking-[0.18em] text-[var(--text-3)]`}>
            COLD EMAIL
          </div>
          <h2 className="mt-1 truncate text-xl font-bold text-[var(--text-1)]">콜드메일</h2>
        </div>
        {/* 승인 게이트 상태 칩 — 대기 중이면 warn 펄스, 발송되면 ok */}
        {approvalPending ? (
          <span className="flex shrink-0 items-center gap-2 rounded-full bg-[var(--warn-dim)] px-3 py-1 text-[12px] font-semibold text-[var(--warn)]">
            <span className="anim-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
            승인 대기
          </span>
        ) : sentCount > 0 ? (
          <span
            key={sentCount}
            className="anim-tick shrink-0 rounded-full bg-[var(--ok-dim)] px-3 py-1 text-[12px] font-semibold text-[var(--ok)]"
          >
            발송 {sentCount}건 완료
          </span>
        ) : null}
      </header>

      {emails ? (
        <div key={flashKey} className="anim-flash-ok rounded-[10px]">
          <ColdEmailList emails={emails} />
        </div>
      ) : (
        // 빈 상태 — 콘솔 실행 유도
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line-2)] bg-[var(--bg-1)] px-6 py-10 text-center">
          <p className="text-[15px] font-semibold text-[var(--text-2)]">
            콜드메일 초안이 아직 없습니다
          </p>
          <p className="max-w-[420px] text-[13px] leading-relaxed text-[var(--text-3)]">
            콘솔에서 &ldquo;협업 후보 찾아서 제안 메일 보내줘&rdquo;를 실행하면 에이전트가
            아래 컨택 후보를 바탕으로 개인화 초안을 만들어 이곳에 게시합니다. 발송은 승인
            게이트 통과 후에만 실행됩니다.
          </p>
          <Link
            href="/console"
            className="btn-lift mt-1 rounded-[10px] border border-[var(--line-1)] px-4 py-2 text-[13px] font-semibold text-[var(--text-1)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]"
          >
            콘솔에서 실행
          </Link>
        </div>
      )}

      {/* 컨택 후보 — 개인화 근거(context)를 함께 보여준다 */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-[var(--line-2)] pt-1">
          <h3 className="text-[16px] font-bold text-[var(--text-1)]">컨택 후보</h3>
          <span className={`num text-[12px] font-semibold text-[var(--text-2)] ${MONO}`}>
            {contacts.length}
          </span>
          <span className="text-[12px] text-[var(--text-3)]">
            최근 활동이 개인화 문구의 근거가 됩니다
          </span>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {contacts.map((c, i) => (
            <article
              key={c.email}
              className="anim-rise rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)] px-4 py-4"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] font-bold text-[var(--text-1)]">
                  {c.company}
                </span>
                <span className="shrink-0 text-[11.5px] text-[var(--text-2)]">
                  {c.name} · {c.role}
                </span>
              </div>
              <p className="mt-2.5 border-l-2 border-[var(--accent)]/35 pl-3 text-[12.5px] leading-relaxed text-[var(--text-2)]">
                {c.context}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
