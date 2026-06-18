"use client";

// components/ide/views/ContentView.tsx — 콘텐츠 스튜디오 (VS Code 뷰 idiom).
//
// 흰 /content 페이지는 라우트 단독용으로 그대로 두고, IDE 탭 안에서는 이 뷰가 VS Code
// 에디터/뷰 어휘로 다시 그린다(파일/항목 행 톤):
//   · 인스타그램 = .ide-vlist 항목 행(초안/발행 codicon + 캡션 미리보기 + 성과).
//   · 뉴스레터  = 제목 후보(.ide-kv) + 섹션 리스트.
//   · 주간 캘린더 = 채널별(.ide-section) 항목 행(상태 pill).
//   · D+1/D+7 성과 = .ide-vlist 행(포맷 + reach/save 수치).
//
// 데이터: GET /api/workspace 베이스라인 + useAgentStreamContext 라이브 아티팩트(같은 kind
// 최신본 우선). 기능/소스 보존 — 페이지와 동일 파생 규칙.

import { useEffect, useMemo, useState } from "react";
import type {
  Artifact,
  ContentCalendar,
  ContentPerformanceReport,
  InstagramPost,
  NewsletterDraft,
  WorkspaceData,
} from "@/lib/types";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import {
  ViewChrome,
  ViewSection,
  ViewSkeleton,
  ViewEmpty,
  Pill,
  LivePill,
} from "@/components/ide/views/ViewChrome";

// artifacts 에서 kind별 최신본 + 도착 순번(라이브 우선).
function findLatest<K extends Artifact["kind"]>(
  artifacts: Artifact[],
  kind: K,
): { artifact: Extract<Artifact, { kind: K }>; seq: number } | null {
  for (let i = artifacts.length - 1; i >= 0; i--) {
    const a = artifacts[i];
    if (a.kind === kind) {
      return { artifact: a as Extract<Artifact, { kind: K }>, seq: i };
    }
  }
  return null;
}

const CHANNEL_ICON: Record<string, string> = {
  instagram: "device-camera",
  newsletter: "mail",
  blog: "book",
};
const CHANNEL_LABEL: Record<string, string> = {
  instagram: "인스타그램",
  newsletter: "뉴스레터",
  blog: "블로그",
};
const STATUS_TONE: Record<
  string,
  "accent" | "ok" | "warn" | undefined
> = {
  planned: undefined,
  drafted: "warn",
  published: "ok",
};
const STATUS_LABEL: Record<string, string> = {
  planned: "예정",
  drafted: "초안",
  published: "발행",
};

// ── 인스타그램 초안 행 ──
function InstaList({ posts }: { posts: InstagramPost[] }) {
  if (posts.length === 0) {
    return <ViewEmpty icon="device-camera" title="인스타그램 초안이 없습니다." />;
  }
  return (
    <div className="ide-vlist">
      {posts.map((p, i) => (
        <div className="ide-vrow" key={i} style={{ alignItems: "flex-start" }}>
          <i className="codicon codicon-device-camera" aria-hidden style={{ marginTop: 3 }} />
          <span className="ide-vrow-main" style={{ whiteSpace: "normal" }}>
            <span style={{ color: "var(--ide-text-strong)", fontSize: 13 }}>
              {p.concept}
            </span>
            <span className="ide-vrow-sub-block" style={{ whiteSpace: "normal" }}>
              {p.caption}
            </span>
            {p.hashtags.length > 0 && (
              <span
                className="ide-mono"
                style={{
                  display: "block",
                  marginTop: 3,
                  fontSize: 10.5,
                  color: "var(--ide-accent-bright)",
                }}
              >
                {p.hashtags.map((t) => `#${t}`).join(" ")}
              </span>
            )}
          </span>
          <span className="ide-vrow-sub">{p.suggestedPostTime}</span>
        </div>
      ))}
    </div>
  );
}

// ── 발행작 성과 행 ──
function PublishedList({ report }: { report: ContentPerformanceReport }) {
  if (report.posts.length === 0) {
    return <ViewEmpty icon="history" title="발행 성과 데이터가 없습니다." />;
  }
  return (
    <div className="ide-vlist">
      {report.posts.map((p) => {
        const d = p.metricsD7 ?? p.metricsD1;
        return (
          <div className="ide-vrow" key={p.postId} style={{ alignItems: "flex-start" }}>
            <i className="codicon codicon-file-media" aria-hidden style={{ marginTop: 2 }} />
            <span className="ide-vrow-main" style={{ whiteSpace: "normal" }}>
              <span style={{ color: "var(--ide-text-strong)", fontSize: 13 }}>
                {p.concept}
              </span>
              <span className="ide-vrow-sub-block">
                {p.format} · {p.publishedAt}
              </span>
            </span>
            <span className="ide-vrow-sub-block" style={{ textAlign: "right" }}>
              <span className="ide-mono" style={{ color: "var(--ide-text)" }}>
                도달 {d.reach.toLocaleString()}
              </span>
              <span
                className="ide-mono"
                style={{
                  display: "block",
                  fontSize: 10.5,
                  color: "var(--ide-ok)",
                }}
              >
                저장 {d.saves}
                {p.saveRateD7 !== null ? ` · ${p.saveRateD7}%` : ""}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 뉴스레터 ──
function NewsletterBlock({ draft }: { draft: NewsletterDraft }) {
  return (
    <>
      <div className="ide-kv">
        <span className="ide-kv-key">제목</span>
        <span className="ide-kv-val ide-kv-val--text">{draft.subject}</span>
      </div>
      <div className="ide-kv">
        <span className="ide-kv-key">프리헤더</span>
        <span className="ide-kv-val ide-kv-val--text">{draft.preheader}</span>
      </div>
      <div className="ide-kv">
        <span className="ide-kv-key">프레임워크</span>
        <span className="ide-kv-val">
          {draft.framework} · 읽기 {draft.estimatedReadSeconds}초
        </span>
      </div>
      {draft.subjectVariants.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="ide-vlist">
            {draft.subjectVariants.map((v, i) => (
              <div className="ide-vrow" key={i} style={{ alignItems: "flex-start" }}>
                <i className="codicon codicon-symbol-text" aria-hidden style={{ marginTop: 2 }} />
                <span className="ide-vrow-main" style={{ whiteSpace: "normal" }}>
                  <span style={{ color: "var(--ide-text)", fontSize: 12.5 }}>
                    {v.text}
                  </span>
                  <span className="ide-vrow-sub-block">
                    {v.angle} · {v.charCount}자
                  </span>
                </span>
                <Pill
                  tone={
                    v.spamRisk === "none" || v.spamRisk === "low"
                      ? "ok"
                      : v.spamRisk === "medium"
                        ? "warn"
                        : "danger"
                  }
                >
                  스팸 {v.spamRisk}
                </Pill>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── 캘린더(채널별 그룹) ──
function CalendarBlock({ calendar }: { calendar: ContentCalendar }) {
  const byChannel = useMemo(() => {
    const m = new Map<string, ContentCalendar["entries"]>();
    for (const e of calendar.entries) {
      const list = m.get(e.channel) ?? [];
      list.push(e);
      m.set(e.channel, list);
    }
    return [...m.entries()];
  }, [calendar]);

  if (calendar.entries.length === 0) {
    return <ViewEmpty icon="calendar" title="계획된 항목이 없습니다." />;
  }
  return (
    <div className="flex flex-col gap-3">
      {byChannel.map(([channel, entries]) => (
        <div key={channel}>
          <div
            className="ide-section-head"
            style={{ marginBottom: 6, fontSize: 10.5 }}
          >
            <i
              className={`codicon codicon-${CHANNEL_ICON[channel] ?? "circle-small"}`}
              aria-hidden
            />
            <span>{CHANNEL_LABEL[channel] ?? channel}</span>
            <span className="ide-section-meta">{entries.length}</span>
          </div>
          <div className="ide-vlist">
            {entries.map((e, i) => (
              <div className="ide-vrow" key={i} style={{ alignItems: "flex-start" }}>
                <i className="codicon codicon-circle-small-filled" aria-hidden style={{ marginTop: 3 }} />
                <span className="ide-vrow-main" style={{ whiteSpace: "normal" }}>
                  <span style={{ color: "var(--ide-text-strong)", fontSize: 13 }}>
                    {e.title}
                  </span>
                  <span className="ide-vrow-sub-block" style={{ whiteSpace: "normal" }}>
                    {e.objective}
                  </span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span className="ide-vrow-sub">{e.date.slice(5)}</span>
                  <Pill tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status] ?? e.status}</Pill>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ContentView() {
  const { artifacts, running } = useAgentStreamContext();

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

  const liveIg = useMemo(() => findLatest(artifacts, "instagram_posts"), [artifacts]);
  const liveNl = useMemo(() => findLatest(artifacts, "newsletter"), [artifacts]);
  const liveCal = useMemo(() => findLatest(artifacts, "calendar"), [artifacts]);
  const liveCp = useMemo(
    () => findLatest(artifacts, "content_performance"),
    [artifacts],
  );

  const performanceReport =
    liveCp?.artifact.report ?? workspace?.contentPerformance ?? null;
  const publishedCount = workspace?.contentPerformance.posts.length ?? 0;
  const draftCount = liveIg?.artifact.posts.length ?? 0;

  const actions = running ? <LivePill label="갱신 중" /> : null;

  if (!workspace && !loadError) {
    return (
      <ViewChrome icon="device-camera" title="콘텐츠 스튜디오" sub="content">
        <ViewSkeleton />
      </ViewChrome>
    );
  }

  return (
    <ViewChrome
      icon="device-camera"
      title="콘텐츠 스튜디오"
      sub={workspace ? workspace.scenario.brandName : "content"}
      actions={actions}
    >
      {loadError && !workspace ? (
        <div className="p-4">
          <Pill tone="danger" icon="error">
            작업 공간 데이터를 불러오지 못했습니다.
          </Pill>
        </div>
      ) : (
        <>
          <ViewSection
            icon="device-camera"
            title="인스타그램"
            meta={`발행 ${publishedCount} · 초안 ${draftCount}`}
          >
            {liveIg && (
              <div style={{ marginBottom: 10 }}>
                <Pill tone="accent" icon="edit">
                  초안 {draftCount}건 · 검토 대기
                </Pill>
              </div>
            )}
            {liveIg ? (
              <InstaList posts={liveIg.artifact.posts} />
            ) : (
              <ViewEmpty
                icon="device-camera"
                title="아직 초안이 없습니다."
                hint="좌측 대화에서 인스타 콘텐츠를 요청하세요."
              />
            )}
          </ViewSection>

          <ViewSection
            icon="mail"
            title="뉴스레터"
            meta={liveNl ? "초안 1건" : "초안 없음"}
          >
            {liveNl ? (
              <NewsletterBlock draft={liveNl.artifact.draft} />
            ) : (
              <ViewEmpty icon="mail" title="뉴스레터 초안이 없습니다." />
            )}
          </ViewSection>

          <ViewSection
            icon="calendar"
            title="주간 캘린더"
            meta={
              liveCal
                ? `${liveCal.artifact.calendar.entries.length}건 · ${liveCal.artifact.calendar.weekLabel}`
                : undefined
            }
          >
            {liveCal ? (
              <CalendarBlock calendar={liveCal.artifact.calendar} />
            ) : (
              <ViewEmpty icon="calendar" title="계획된 캘린더가 없습니다." />
            )}
          </ViewSection>

          <ViewSection
            icon="history"
            title="D+1 / D+7 성과"
            meta={
              performanceReport
                ? `상위 패턴 — ${performanceReport.topPattern}`
                : undefined
            }
          >
            {performanceReport ? (
              <PublishedList report={performanceReport} />
            ) : (
              <ViewEmpty icon="history" title="성과 데이터가 없습니다." />
            )}
          </ViewSection>
        </>
      )}
    </ViewChrome>
  );
}
