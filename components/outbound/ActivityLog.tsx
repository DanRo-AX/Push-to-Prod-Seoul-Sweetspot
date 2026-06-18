"use client";

// 활동 로그 — 컨텍스트 events 중 email_sent / approval_required / approval_resolved 만
// 타임라인 행으로 표시한다. 승인 게이트 통과 서사(요청 → 승인 → 발송)가 한눈에 읽히게 한다.
import type { AgentEvent } from "@/lib/types";

const MONO = "font-[family-name:var(--font-geist-mono)]";

type LogEvent = Extract<
  AgentEvent,
  { type: "email_sent" } | { type: "approval_required" } | { type: "approval_resolved" }
>;

function isLogEvent(e: AgentEvent): e is LogEvent {
  return (
    e.type === "email_sent" ||
    e.type === "approval_required" ||
    e.type === "approval_resolved"
  );
}

interface RowMeta {
  dot: string;       // 마커 색
  title: string;     // 행 제목
  titleColor: string;
  tag: string;       // 모노 태그
  desc: string;      // 설명 한 줄
  sub?: string;      // 보조 줄 (메일 제목 등)
}

function metaOf(e: LogEvent): RowMeta {
  switch (e.type) {
    case "approval_required":
      return {
        dot: "var(--warn)",
        title: "승인 요청",
        titleColor: "var(--warn)",
        tag: "GATE",
        desc:
          e.approval.kind === "instagram_publish"
            ? "인스타그램 게시물 1건 — 발행 전 사람의 승인을 기다립니다"
            : `콜드메일 ${e.approval.emails.length}건 — 발송 전 사람의 승인을 기다립니다`,
      };
    case "approval_resolved":
      return e.approved
        ? {
            dot: "var(--ok)",
            title: "승인 완료",
            titleColor: "var(--ok)",
            tag: "GATE PASS",
            desc: "발송 게이트 통과 — 화이트리스트 검증 후 발송이 시작됩니다",
          }
        : {
            dot: "var(--danger)",
            title: "발송 거부",
            titleColor: "var(--danger)",
            tag: "GATE STOP",
            desc: "사람이 발송을 중단했습니다 — 어떤 메일도 나가지 않았습니다",
          };
    case "email_sent":
      return {
        dot: "var(--ok)",
        title: "발송 완료",
        titleColor: "var(--text-1)",
        tag: "SENT",
        desc: `${e.company} · ${e.to}`,
        sub: e.subject,
      };
  }
}

export function ActivityLog({ events }: { events: AgentEvent[] }) {
  const rows = events.filter(isLogEvent);

  return (
    <section className="flex flex-col gap-4">
      {/* 섹션 헤더 — 공통 idiom: 모노 eyebrow 위 + 한국어 타이틀 아래 + 우측 메타 */}
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={`${MONO} text-[11px] font-semibold tracking-[0.18em] text-[var(--text-3)]`}>
            ACTIVITY
          </div>
          <h2 className="mt-1 truncate text-xl font-bold text-[var(--text-1)]">활동 로그</h2>
        </div>
        {rows.length > 0 && (
          <span key={rows.length} className={`num anim-tick shrink-0 text-[12px] text-[var(--text-3)] ${MONO}`}>
            {rows.length}건
          </span>
        )}
      </header>

      <div className="surface-raised rounded-2xl border border-[var(--line-1)] bg-[var(--bg-1)] px-6 py-5">
        {rows.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[14px] font-semibold text-[var(--text-2)]">
              아직 발송 이력이 없습니다
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-3)] [text-wrap:pretty]">
              모든 발송은 승인 게이트를 거칩니다 — 승인·발송 이벤트가 여기에 기록됩니다
            </p>
          </div>
        ) : (
          <ol className="flex flex-col">
            {rows.map((e, i) => {
              const meta = metaOf(e);
              const isLast = i === rows.length - 1;
              // 가장 최근 발송 행은 1회 발광으로 갱신을 강조
              const flash = isLast && e.type === "email_sent" ? "anim-flash-ok rounded-[10px]" : "";
              return (
                <li key={i} className="anim-rise relative flex gap-3">
                  {/* 마커 + 연결선 */}
                  <div className="flex w-3 shrink-0 flex-col items-center">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: meta.dot }}
                    />
                    {!isLast && <span className="mt-1 w-px flex-1 bg-[var(--line-1)]" />}
                  </div>
                  <div className={`min-w-0 flex-1 ${isLast ? "pb-0.5" : "pb-5"} ${flash}`}>
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span
                        className="text-[14.5px] font-bold"
                        style={{ color: meta.titleColor }}
                      >
                        {meta.title}
                      </span>
                      <span className={`${MONO} text-[10px] font-semibold tracking-[0.14em] text-[var(--text-2)]`}>
                        {meta.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">{meta.desc}</p>
                    {meta.sub && (
                      <p className="mt-1.5 truncate rounded-[6px] bg-[var(--bg-inset)] px-2.5 py-1.5 text-[12px] text-[var(--text-2)]">
                        제목: {meta.sub}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
