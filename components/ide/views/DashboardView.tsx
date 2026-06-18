"use client";

// components/ide/views/DashboardView.tsx — 성과 대시보드 (VS Code 뷰 idiom).
//
// 흰 /dashboard 페이지(app/(app)/dashboard/page.tsx)는 라우트 단독용으로 그대로 두고,
// IDE 에디터 탭 안에서는 이 뷰가 VS Code 에디터/뷰 어휘로 다시 그린다(단순 다크화 X):
//   · 상단 .ide-viewbar(제목 + refresh 액션 + 라이브 칩).
//   · KPI = .ide-statgrid(델타 up/down) — VS Code 상태 타일.
//   · 성장 추이 = recharts AreaChart(다크 톤 — 축/그리드 밝게).
//   · 전환 퍼널 = .ide-vlist 행(단계 + 카운트 + 폭 막대 + 병목 pill).
//   · 키워드 기회 = .ide-vlist 행(키워드 + 검색량/순위 + 기회 스코어 막대).
//
// 데이터: GET /api/workspace 베이스라인 + useAgentStreamContext 라이브 아티팩트(같은 kind
// 최신본 우선). 기능/소스 보존 — 페이지와 동일 파생 규칙. recharts 유지(다크 가독).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import type {
  Artifact,
  FunnelReport,
  KeywordReport,
  MetricsTimeline,
  WeeklyMetric,
  WorkspaceData,
} from "@/lib/types";
import {
  ViewChrome,
  ViewSection,
  ViewSkeleton,
  ViewEmpty,
  IconBtn,
  Pill,
  LivePill,
} from "@/components/ide/views/ViewChrome";
import {
  D_AXIS_TICK,
  D_COLOR,
  D_GRID_STROKE,
  D_LEGEND_STYLE,
  D_TOOLTIP_LABEL_STYLE,
  D_TOOLTIP_STYLE,
} from "@/components/ide/views/chart-theme-dark";

// artifacts(시간순)에서 특정 kind 의 최신본 + 도착 횟수(라이브 반영 카운터).
function latestOfKind<K extends Artifact["kind"]>(
  artifacts: Artifact[],
  kind: K,
): { artifact: Extract<Artifact, { kind: K }> | null; version: number } {
  let found: Extract<Artifact, { kind: K }> | null = null;
  let version = 0;
  for (const a of artifacts) {
    if (a.kind === kind) {
      found = a as Extract<Artifact, { kind: K }>;
      version += 1;
    }
  }
  return { artifact: found, version };
}

// ── KPI 정의 — 흰 페이지 KpiStrip 과 동일 4지표. ──
interface KpiDef {
  label: string;
  icon: string;
  pick: (w: WeeklyMetric) => number;
}
const KPI_DEFS: KpiDef[] = [
  { label: "팔로워", icon: "person", pick: (w) => w.followers },
  { label: "뉴스레터 구독", icon: "mail", pick: (w) => w.newsletterSubs },
  { label: "아웃바운드 회신", icon: "reply", pick: (w) => w.outboundReplies },
  { label: "미팅 성사", icon: "calendar", pick: (w) => w.meetings },
];

function StatGrid({ metrics }: { metrics: MetricsTimeline }) {
  const weeks = metrics.weeks;
  if (weeks.length === 0) return null;
  const latest = weeks[weeks.length - 1];
  const prev = weeks.length > 1 ? weeks[weeks.length - 2] : latest;
  return (
    <div className="ide-statgrid">
      {KPI_DEFS.map((def) => {
        const value = def.pick(latest);
        const delta = value - def.pick(prev);
        const up = delta > 0;
        const flat = delta === 0;
        return (
          <div className="ide-stat" key={def.label}>
            <span className="ide-stat-label">
              <i className={`codicon codicon-${def.icon}`} aria-hidden />
              {def.label}
            </span>
            <span className="ide-stat-value">{value.toLocaleString()}</span>
            <span
              className={`ide-stat-delta ${
                flat ? "" : up ? "ide-stat-delta--up" : "ide-stat-delta--down"
              }`}
            >
              {flat
                ? "±0"
                : `${up ? "+" : "−"}${Math.abs(delta).toLocaleString()} vs ${prev.week}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 성장 추이 — 다크 AreaChart. ──
function GrowthChart({ metrics }: { metrics: MetricsTimeline }) {
  if (metrics.weeks.length === 0) {
    return <ViewEmpty icon="graph" title="아직 집계된 지표가 없습니다." />;
  }
  return (
    <div style={{ height: 240, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={metrics.weeks}
          margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
        >
          <defs>
            <linearGradient id="ide-dash-foll" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={D_COLOR.accent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={D_COLOR.accent} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ide-dash-subs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={D_COLOR.ok} stopOpacity={0.24} />
              <stop offset="100%" stopColor={D_COLOR.ok} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={D_GRID_STROKE} />
          <XAxis dataKey="week" tick={D_AXIS_TICK} stroke={D_GRID_STROKE} />
          <YAxis tick={D_AXIS_TICK} stroke={D_GRID_STROKE} />
          <Tooltip
            contentStyle={D_TOOLTIP_STYLE}
            labelStyle={D_TOOLTIP_LABEL_STYLE}
            cursor={{ stroke: D_GRID_STROKE }}
          />
          <Legend wrapperStyle={D_LEGEND_STYLE} />
          <Area
            type="monotone"
            dataKey="followers"
            name="팔로워"
            stroke={D_COLOR.accent}
            strokeWidth={2.4}
            fill="url(#ide-dash-foll)"
            dot={{ r: 3, fill: D_COLOR.accent }}
          />
          <Area
            type="monotone"
            dataKey="newsletterSubs"
            name="뉴스레터 구독"
            stroke={D_COLOR.ok}
            strokeWidth={2.4}
            fill="url(#ide-dash-subs)"
            dot={{ r: 3, fill: D_COLOR.ok }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 전환 퍼널 — VS Code 리스트 행 + 폭 막대. ──
function FunnelList({ report }: { report: FunnelReport }) {
  const max = Math.max(1, ...report.stages.map((s) => s.count));
  return (
    <div className="ide-vlist">
      {report.stages.map((s, i) => {
        const bottleneck = s.stage === report.bottleneckStage;
        const pct = Math.max(2, (s.count / max) * 100);
        return (
          <div className="ide-vrow" key={s.stage} style={{ alignItems: "stretch" }}>
            <i className="codicon codicon-chevron-right" aria-hidden />
            <span className="ide-vrow-main" style={{ whiteSpace: "normal" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="ide-mono"
                  style={{ color: "var(--ide-text-faint)", fontSize: 11 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ color: "var(--ide-text-strong)", fontSize: 13 }}>
                  {s.stage}
                </span>
                {bottleneck && <Pill tone="warn">병목</Pill>}
                {s.conversionFromPrev !== null && (
                  <span
                    className="ide-mono"
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      color: bottleneck
                        ? "var(--ide-warn)"
                        : "var(--ide-text-dim)",
                    }}
                  >
                    전환 {s.conversionFromPrev}%
                  </span>
                )}
              </span>
              {/* 폭 막대 */}
              <span
                className="persona-bar"
                style={{ marginTop: 6, display: "block" }}
                aria-hidden
              >
                <span
                  className="persona-bar-fill"
                  style={{
                    ["--pct" as string]: `${pct}%`,
                    ["--arch" as string]: bottleneck
                      ? "var(--ide-warn)"
                      : "var(--ide-accent-bright)",
                  }}
                />
              </span>
            </span>
            <span className="ide-vrow-sub">{s.count.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── 키워드 기회 — VS Code 리스트 행(스코어 막대 + 순위 변동). ──
function KeywordList({ report }: { report: KeywordReport }) {
  const rows = report.rows.slice(0, 12);
  return (
    <div className="ide-vlist">
      {rows.map((r) => {
        const up = r.rankDelta > 0;
        const flat = r.rankDelta === 0;
        return (
          <div className="ide-vrow" key={r.keyword} style={{ alignItems: "stretch" }}>
            <i
              className="codicon codicon-search"
              aria-hidden
              style={{ color: r.competitorGap ? "var(--ide-warn)" : undefined }}
            />
            <span className="ide-vrow-main" style={{ whiteSpace: "normal" }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ color: "var(--ide-text-strong)", fontSize: 13 }}>
                  {r.keyword}
                </span>
                <span
                  className="ide-pill"
                  style={{ height: 17, fontSize: 10 }}
                >
                  {r.intent}
                </span>
                <span
                  className="ide-pill"
                  style={{ height: 17, fontSize: 10 }}
                >
                  {r.audience}
                </span>
                {r.competitorGap && <Pill tone="warn">경쟁 갭</Pill>}
              </span>
              <span
                className="persona-bar"
                style={{ marginTop: 6, display: "block" }}
                aria-hidden
              >
                <span
                  className="persona-bar-fill"
                  style={{
                    ["--pct" as string]: `${r.opportunityScore}%`,
                    ["--arch" as string]: "var(--ide-ok)",
                  }}
                />
              </span>
            </span>
            <span className="ide-vrow-sub-block" style={{ textAlign: "right" }}>
              <span style={{ color: "var(--ide-text)" }}>
                {r.monthlySearches.toLocaleString()}
              </span>
              <span
                className="ide-mono"
                style={{
                  display: "block",
                  fontSize: 10,
                  color: flat
                    ? "var(--ide-text-faint)"
                    : up
                      ? "var(--ide-ok)"
                      : "var(--ide-danger)",
                }}
              >
                {r.rank === null ? "미노출" : `#${r.rank}`}
                {!flat && ` ${up ? "▲" : "▼"}${Math.abs(r.rankDelta)}`}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardView() {
  const { artifacts, running, mode } = useAgentStreamContext();

  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // load 는 setState 를 fetch 콜백(비동기)에서만 한다 — effect 동기 setState 금지 규칙 준수.
  const load = useCallback(() => {
    fetch("/api/workspace")
      .then((r) => {
        if (!r.ok) throw new Error(`서버 응답 오류 (${r.status})`);
        return r.json() as Promise<WorkspaceData>;
      })
      .then((d) => {
        setData(d);
        setLoadError(null);
      })
      .catch((e) =>
        setLoadError(
          e instanceof Error ? e.message : "작업 공간 데이터를 불러오지 못했습니다.",
        ),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const liveMetrics = useMemo(() => latestOfKind(artifacts, "metrics"), [artifacts]);
  const liveFunnel = useMemo(() => latestOfKind(artifacts, "funnel"), [artifacts]);
  const liveKeywords = useMemo(
    () => latestOfKind(artifacts, "keywords"),
    [artifacts],
  );

  const metrics = liveMetrics.artifact?.metrics ?? data?.metrics ?? null;
  const funnel = liveFunnel.artifact?.report ?? data?.funnel ?? null;
  const keywords = liveKeywords.artifact?.report ?? data?.keywords ?? null;

  const liveCount =
    liveMetrics.version + liveFunnel.version + liveKeywords.version;
  const analyzing = running && (mode === "live" || mode === "replay");
  const ready = metrics !== null && funnel !== null && keywords !== null;

  const actions = (
    <>
      {analyzing ? (
        <LivePill label="분석 중" />
      ) : liveCount > 0 ? (
        <Pill tone="ok" icon="pass-filled">
          라이브 {liveCount}건
        </Pill>
      ) : null}
      <IconBtn icon="refresh" label="새로고침" onClick={load} />
    </>
  );

  return (
    <ViewChrome
      icon="dashboard"
      title="성과 대시보드"
      sub={data ? data.scenario.brandName : "performance"}
      actions={actions}
    >
      {!ready && loadError ? (
        <div className="p-4">
          <Pill tone="danger" icon="error">
            {loadError}
          </Pill>
          <div className="mt-3">
            <button
              type="button"
              className="ide-icon-btn"
              onClick={load}
              style={{ width: "auto", padding: "0 12px", gap: 6 }}
            >
              <i className="codicon codicon-refresh" aria-hidden />
              다시 시도
            </button>
          </div>
        </div>
      ) : !ready ? (
        <ViewSkeleton />
      ) : (
        <>
          <ViewSection
            icon="pulse"
            title="핵심 지표"
            meta={metrics ? `최신 ${metrics.weeks.at(-1)?.week ?? ""}` : undefined}
          >
            {metrics && <StatGrid metrics={metrics} />}
          </ViewSection>

          <ViewSection
            icon="graph-line"
            title="팔로워 · 구독자 성장"
            meta={metrics?.note}
          >
            {metrics && <GrowthChart metrics={metrics} />}
          </ViewSection>

          <ViewSection
            icon="filter"
            title="전환 퍼널"
            meta={funnel?.period}
          >
            {funnel && <FunnelList report={funnel} />}
            {funnel && (
              <div className="mt-3">
                <Pill tone="warn" icon="warning">
                  최대 이탈 — {funnel.bottleneckStage}
                </Pill>
              </div>
            )}
          </ViewSection>

          <ViewSection
            icon="search"
            title="키워드 기회"
            meta={keywords ? `${keywords.totalTracked.toLocaleString()} 추적` : undefined}
          >
            {keywords && <KeywordList report={keywords} />}
          </ViewSection>
        </>
      )}
    </ViewChrome>
  );
}
