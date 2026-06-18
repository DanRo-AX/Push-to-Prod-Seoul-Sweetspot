"use client";

// components/ide/views/OutboundView.tsx — 아웃바운드 파이프라인 (VS Code 뷰 idiom).
//
// 흰 /outbound 페이지는 라우트 단독용으로 그대로 두고, IDE 탭 안에서는 이 뷰가 VS Code
// 에디터/뷰 어휘로 다시 그린다:
//   · CRM 파이프라인 = 단계별 컬럼형 섹션(트리 톤) — 리드 행(스코어 막대 + D+N).
//   · 오늘의 팔로업 = .ide-vlist 행(액션 + 단계 pill + 경과일).
//   · 콜드메일 초안 = .ide-vlist 행(회사/수신 + 제목 + 팔로업) + 승인 게이트 안내.
//   · 활동 로그 = 타임라인 행(승인 요청→승인→발송 서사).
//
// 데이터: GET /api/workspace(crm/contacts) + useAgentStreamContext(cold_emails 아티팩트 +
// email_sent/approval_* 이벤트). computeFollowUps/STAGE_LABELS 재사용(규칙 단일 진실).
// 발송은 전부 승인 게이트를 거친다(엔진 무수정 — 여기서는 표시만).

import { useEffect, useMemo, useState } from "react";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import type { AgentEvent, ColdEmail, CrmLead, WorkspaceData } from "@/lib/types";
import {
  computeFollowUps,
  STAGE_LABELS,
  type FollowUpItem,
} from "@/components/outbound/followups";
import {
  ViewChrome,
  ViewSection,
  ViewSkeleton,
  ViewEmpty,
  Pill,
  LivePill,
} from "@/components/ide/views/ViewChrome";

// 단계 순서 + 단계 점 색(VS Code 톤). 마지막(성사)은 청록(ok).
const STAGES: { id: CrmLead["stage"]; color: string }[] = [
  { id: "new", color: "var(--ide-text-faint)" },
  { id: "contacted", color: "var(--ide-text-dim)" },
  { id: "replied", color: "var(--ide-warn)" },
  { id: "meeting", color: "var(--ide-accent-bright)" },
  { id: "won", color: "var(--ide-ok)" },
];

const STAGE_PILL_TONE: Record<
  CrmLead["stage"],
  "accent" | "ok" | "warn" | undefined
> = {
  new: undefined,
  contacted: undefined,
  replied: "warn",
  meeting: "accent",
  won: "ok",
};

function daysSince(iso: string, asOf: Date): number {
  return Math.max(
    0,
    Math.floor((asOf.getTime() - new Date(iso).getTime()) / 86400000),
  );
}

function scoreColor(score: number): string {
  if (score >= 75) return "var(--ide-ok)";
  if (score >= 55) return "var(--ide-accent-bright)";
  return "var(--ide-text-faint)";
}

// ── CRM 파이프라인 — 단계별 컬럼(트리 헤더 + 리드 행). ──
function PipelineColumns({ leads, asOf }: { leads: CrmLead[]; asOf: Date }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 8,
        alignItems: "start",
      }}
    >
      {STAGES.map((stage) => {
        const items = leads
          .filter((l) => l.stage === stage.id)
          .sort((a, b) => b.score - a.score);
        return (
          <div
            key={stage.id}
            style={{
              border: "1px solid var(--ide-border-strong)",
              borderRadius: 7,
              background: "var(--ide-bg-alt)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 9px",
                borderBottom: "1px solid var(--ide-border)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 9999,
                  background: stage.color,
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--ide-text-strong)",
                }}
              >
                {STAGE_LABELS[stage.id]}
              </span>
              <span
                className="ide-mono"
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: "var(--ide-text-faint)",
                }}
              >
                {items.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", padding: 6, gap: 6 }}>
              {items.length === 0 ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ide-text-faint)",
                    padding: "8px 4px",
                    textAlign: "center",
                  }}
                >
                  리드 없음
                </span>
              ) : (
                items.map((lead) => (
                  <div
                    key={lead.email}
                    style={{
                      border: "1px solid var(--ide-border-strong)",
                      borderRadius: 6,
                      background: "var(--ide-elevated)",
                      padding: "7px 9px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--ide-text-strong)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lead.name}
                      </span>
                      <span
                        className="ide-mono"
                        style={{
                          marginLeft: "auto",
                          fontSize: 10,
                          color: "var(--ide-text-faint)",
                        }}
                        title={`마지막 접촉 ${lead.lastTouch}`}
                      >
                        D+{daysSince(lead.lastTouch, asOf)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--ide-text-dim)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {lead.company}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 5,
                      }}
                    >
                      <span className="persona-bar" style={{ flex: 1 }} aria-hidden>
                        <span
                          className="persona-bar-fill"
                          style={{
                            ["--pct" as string]: `${lead.score}%`,
                            ["--arch" as string]: scoreColor(lead.score),
                          }}
                        />
                      </span>
                      <span
                        className="ide-mono"
                        style={{
                          fontSize: 10,
                          color: "var(--ide-text-dim)",
                        }}
                      >
                        {lead.score}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 팔로업 큐 ──
function FollowUpList({
  due,
  upcoming,
}: {
  due: FollowUpItem[];
  upcoming: FollowUpItem[];
}) {
  const rows: { item: FollowUpItem; due: boolean }[] = [
    ...due.map((item) => ({ item, due: true })),
    ...upcoming.map((item) => ({ item, due: false })),
  ];
  if (rows.length === 0) {
    return <ViewEmpty icon="check" title="오늘 처리할 팔로업이 없습니다." />;
  }
  return (
    <div className="ide-vlist">
      {rows.map(({ item, due: isDue }) => (
        <div className="ide-vrow" key={item.email + item.action} style={{ alignItems: "flex-start" }}>
          <i
            className={`codicon codicon-${isDue ? "circle-filled" : "circle-outline"}`}
            aria-hidden
            style={{
              marginTop: 2,
              color: isDue ? "var(--ide-warn)" : "var(--ide-text-faint)",
            }}
          />
          <span className="ide-vrow-main" style={{ whiteSpace: "normal" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ color: "var(--ide-text-strong)", fontSize: 13 }}>
                {item.name}
              </span>
              <Pill tone={STAGE_PILL_TONE[item.stage]}>
                {STAGE_LABELS[item.stage]}
              </Pill>
            </span>
            <span className="ide-vrow-sub-block">
              {item.company} · {item.action}
            </span>
          </span>
          <span className="ide-vrow-sub">
            {isDue
              ? `방치 ${item.daysSinceLastTouch}일`
              : `D-${item.dueInDays ?? 0}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 콜드메일 초안 ──
function ColdEmailList({ emails }: { emails: ColdEmail[] }) {
  if (emails.length === 0) {
    return <ViewEmpty icon="mail" title="콜드메일 초안이 없습니다." />;
  }
  return (
    <div className="ide-vlist">
      {emails.map((m, i) => (
        <div className="ide-vrow" key={i} style={{ alignItems: "flex-start" }}>
          <i className="codicon codicon-mail" aria-hidden style={{ marginTop: 2 }} />
          <span className="ide-vrow-main" style={{ whiteSpace: "normal" }}>
            <span style={{ color: "var(--ide-text-strong)", fontSize: 13 }}>
              {m.company}
            </span>
            <span className="ide-vrow-sub-block">
              {m.to} · {m.subject}
            </span>
          </span>
          <span className="ide-vrow-sub">무응답 시 D+{m.followUpInDays}</span>
        </div>
      ))}
    </div>
  );
}

// ── 활동 로그(타임라인) ──
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
function ActivityList({ events }: { events: AgentEvent[] }) {
  const logs = events.filter(isLogEvent);
  if (logs.length === 0) {
    return (
      <ViewEmpty icon="history" title="아직 발송/승인 활동이 없습니다." />
    );
  }
  return (
    <div className="ide-vlist">
      {logs.map((e, i) => {
        let icon = "mail";
        let tone: "accent" | "ok" | "warn" | "danger" | undefined;
        let title = "";
        let desc = "";
        if (e.type === "approval_required") {
          icon = "warning";
          tone = "warn";
          title = "승인 요청";
          desc =
            e.approval.kind === "instagram_publish"
              ? "인스타그램 게시물 1건 — 발행 전 승인 대기"
              : `콜드메일 ${e.approval.emails.length}건 — 발송 전 승인 대기`;
        } else if (e.type === "approval_resolved") {
          if (e.approved) {
            icon = "pass-filled";
            tone = "ok";
            title = "승인 완료";
            desc = "게이트 통과 — 화이트리스트 검증 후 발송";
          } else {
            icon = "circle-slash";
            tone = "danger";
            title = "발송 거부";
            desc = "사람이 발송을 중단 — 어떤 메일도 나가지 않음";
          }
        } else {
          icon = "check-all";
          tone = "ok";
          title = "발송 완료";
          desc = `${e.company} · ${e.to}`;
        }
        return (
          <div className="ide-vrow" key={i} style={{ alignItems: "flex-start" }}>
            <i
              className={`codicon codicon-${icon}`}
              aria-hidden
              style={{
                marginTop: 2,
                color:
                  tone === "ok"
                    ? "var(--ide-ok)"
                    : tone === "warn"
                      ? "var(--ide-warn)"
                      : tone === "danger"
                        ? "var(--ide-danger)"
                        : undefined,
              }}
            />
            <span className="ide-vrow-main" style={{ whiteSpace: "normal" }}>
              <span style={{ color: "var(--ide-text-strong)", fontSize: 13 }}>
                {title}
              </span>
              <span className="ide-vrow-sub-block" style={{ whiteSpace: "normal" }}>
                {desc}
                {e.type === "email_sent" && (
                  <span style={{ display: "block", color: "var(--ide-text-faint)" }}>
                    {e.subject}
                  </span>
                )}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function OutboundView() {
  const { events, artifacts, running } = useAgentStreamContext();

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace")
      .then((r) => {
        if (!r.ok) throw new Error(`workspace ${r.status}`);
        return r.json() as Promise<WorkspaceData>;
      })
      .then((d) => {
        if (!cancelled) setWorkspace(d);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const asOf = useMemo(() => new Date(), []);

  const liveColdEmails = useMemo(() => {
    let latest: ColdEmail[] | null = null;
    for (const a of artifacts) {
      if (a.kind === "cold_emails") latest = a.emails;
    }
    return latest;
  }, [artifacts]);

  const followUps = useMemo(
    () => (workspace ? computeFollowUps(workspace.crm.leads, asOf) : null),
    [workspace, asOf],
  );

  const sentCount = useMemo(
    () => events.filter((e) => e.type === "email_sent").length,
    [events],
  );
  const approvalPending = useMemo(() => {
    let pending = false;
    for (const e of events) {
      if (e.type === "approval_required") pending = true;
      else if (e.type === "approval_resolved") pending = false;
    }
    return pending;
  }, [events]);

  const actions = (
    <>
      {approvalPending && (
        <Pill tone="warn" icon="warning">
          승인 대기
        </Pill>
      )}
      {sentCount > 0 && (
        <Pill tone="ok" icon="check-all">
          발송 {sentCount}
        </Pill>
      )}
      {running && <LivePill label="실행 중" />}
    </>
  );

  if ((!workspace || !followUps) && !loadError) {
    return (
      <ViewChrome icon="send" title="아웃바운드" sub="outbound">
        <ViewSkeleton />
      </ViewChrome>
    );
  }

  return (
    <ViewChrome
      icon="send"
      title="아웃바운드"
      sub={workspace ? workspace.scenario.brandName : "outbound"}
      actions={actions}
    >
      {loadError && !workspace ? (
        <div className="p-4">
          <Pill tone="danger" icon="error">
            작업 공간 데이터를 불러오지 못했습니다.
          </Pill>
        </div>
      ) : (
        workspace &&
        followUps && (
          <>
            <ViewSection
              icon="list-tree"
              title="CRM 파이프라인"
              meta={`리드 ${workspace.crm.leads.length}`}
            >
              <PipelineColumns leads={workspace.crm.leads} asOf={asOf} />
            </ViewSection>

            <ViewSection
              icon="checklist"
              title="오늘의 팔로업"
              meta={`due ${followUps.due.length} · 예정 ${followUps.upcoming.length}`}
            >
              <FollowUpList due={followUps.due} upcoming={followUps.upcoming} />
            </ViewSection>

            <ViewSection
              icon="mail"
              title="콜드메일 초안"
              meta={liveColdEmails ? `${liveColdEmails.length}건` : undefined}
            >
              <div style={{ marginBottom: 10 }}>
                <Pill tone={approvalPending ? "warn" : undefined} icon="shield">
                  {approvalPending
                    ? "승인 게이트 — 발송 대기 중"
                    : "모든 발송은 승인 게이트를 거칩니다"}
                </Pill>
              </div>
              {liveColdEmails ? (
                <ColdEmailList emails={liveColdEmails} />
              ) : (
                <ViewEmpty
                  icon="mail"
                  title="초안이 없습니다."
                  hint="좌측 대화에서 콜드메일을 요청하세요."
                />
              )}
            </ViewSection>

            <ViewSection
              icon="history"
              title="활동 로그"
              meta={sentCount > 0 ? `발송 ${sentCount}` : undefined}
            >
              <ActivityList events={events} />
            </ViewSection>
          </>
        )
      )}
    </ViewChrome>
  );
}
