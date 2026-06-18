"use client";

// components/artifacts/card-sections.tsx — CardSpec 의 section 종류별 렌더러.
//
// 카드 본문은 이제 CardSpec.sections(데이터)에 선언된 순서대로 이 컴포넌트들이 그린다.
// 각 섹션은 자기 상태/훅을 들고 독립적으로 동작 — 새 워크플로는 sections 배열만 바꾸면 된다.

import { useEffect, useState } from "react";
import type { RagEstimate } from "@/lib/agent/btl-rag-estimate";
import { cardSpecForSlot, type CardSectionKind, type CardSignalSpec } from "@/lib/ide/card-spec";
import { useActiveWorkflow } from "@/lib/active-workflow-context";
import type { WorkflowSlotId } from "@/lib/ide/workflow";
import { useBoardDocs } from "@/lib/board-docs-context";
import { useProjectFolder } from "@/lib/project-folder-context";
import { archetypeByType } from "@/lib/oasis";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { DEMO_REVIEW } from "@/lib/demo/demo-fixtures";
import { useEditorDoc } from "@/lib/editor-doc-context";
import { useAgentStreamContext } from "@/lib/agent-stream-context";

const TEXT_EXTS = new Set(["md", "markdown", "txt", "text", "csv", "tsv", "json", "yaml", "yml", "log"]);
const RAW_READ_MAX = 500_000;

function KRW(n: number) {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억원`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString("ko-KR")}만원`;
  return `${n.toLocaleString("ko-KR")}원`;
}
function KRWShort(n: number) {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(n % 1_0000_0000 === 0 ? 0 : 1)}억`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString("ko-KR")}만`;
  return n.toLocaleString("ko-KR");
}
function daysUntil(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date();
  const ms = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round(ms / 86_400_000);
}
// tone 조건("<=3", ">=1") 평가.
function meetsTone(cond: string | undefined, metric: number): boolean {
  if (!cond) return false;
  const m = cond.match(/^(<=|>=|<|>|=)\s*(-?\d+)$/);
  if (!m) return false;
  const n = Number(m[2]);
  switch (m[1]) {
    case "<=": return metric <= n;
    case ">=": return metric >= n;
    case "<": return metric < n;
    case ">": return metric > n;
    case "=": return metric === n;
  }
  return false;
}

// ── SignalBand — CardSpec.signals 를 데이터에서 뽑아 읽기 칩으로(받자마자 보는 신호) ──
export function SignalBand({ signals, data }: { signals: CardSignalSpec[]; data: Record<string, unknown> }) {
  const chips: { key: string; icon?: string; label: string; tone?: "danger" | "warn" }[] = [];
  signals.forEach((sig, i) => {
    const v = data[sig.from];
    let label: string | null = null;
    let metric: number | null = null;
    if (sig.as === "dday") {
      if (typeof v !== "string") return;
      const d = daysUntil(v);
      if (d === null) return;
      metric = d;
      label = `${sig.label ?? "마감"} ${d >= 0 ? `D-${d}` : `${-d}일 경과`}`;
    } else if (sig.as === "count") {
      const n = Array.isArray(v) ? v.length : 0;
      if (n === 0) return;
      metric = n;
      label = `${sig.label ?? "항목"} ${n}`;
    } else if (sig.as === "money_range") {
      const r = v as { min?: number; max?: number } | undefined;
      if (!r) return;
      label = `${sig.label ? `${sig.label} ` : ""}${KRWShort(r.min ?? 0)}~${KRWShort(r.max ?? 0)}`;
    } else {
      if (v == null) return;
      label = `${sig.label ? `${sig.label} ` : ""}${String(v)}`;
    }
    if (label === null) return;
    const tone = metric !== null
      ? (meetsTone(sig.tone?.danger, metric) ? "danger" : meetsTone(sig.tone?.warn, metric) ? "warn" : undefined)
      : undefined;
    chips.push({ key: `${sig.from}-${i}`, icon: sig.icon, label, tone });
  });
  if (chips.length === 0) return null;
  return (
    <div className="btl-signals">
      {chips.map((c) => (
        <span key={c.key} className={`btl-signal${c.tone ? ` btl-signal--${c.tone}` : ""}`}>
          {c.icon && <i className={`codicon codicon-${c.icon}`} aria-hidden />}
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ── 원문 열기 → 중앙 에디터 탭 ──
function RawOpenSection({ slotId, name, ext }: { slotId: WorkflowSlotId; name: string; ext: string }) {
  const { docs } = useBoardDocs();
  const { openDoc } = useEditorDoc();
  const handle = docs.find((d) => d.slotId === slotId)?.handle;
  const isText = TEXT_EXTS.has(ext.toLowerCase());
  const [err, setErr] = useState(false);
  const [opening, setOpening] = useState(false);
  const openRaw = async () => {
    if (!handle || opening) return;
    setOpening(true); setErr(false);
    try {
      const text = (await (await handle.getFile()).text()).slice(0, RAW_READ_MAX);
      openDoc({ name, content: text, ext });
    } catch { setErr(true); } finally { setOpening(false); }
  };
  return (
    <>
      {isText ? (
        <button
          type="button"
          className="btl-discuss-btn"
          style={{ background: "var(--bg-2)", color: "var(--text-1)", border: "1px solid var(--line-1)", marginTop: 0, marginBottom: 4 }}
          onClick={() => void openRaw()}
          disabled={!handle || opening}
          title={handle ? "원문을 중앙 에디터에서 열기" : "폴더에서 지정해야 열 수 있습니다"}
        >
          <i className={`codicon ${opening ? "codicon-loading codicon-modifier-spin" : "codicon-go-to-file"}`} aria-hidden />
          {opening ? "여는 중…" : "원문 열기"}
        </button>
      ) : (
        <p className="mb-1 text-[11px]" style={{ color: "var(--text-3)" }}>
          <i className="codicon codicon-file-binary" aria-hidden style={{ fontSize: 12, marginRight: 4 }} />
          .{ext} 는 미리보기를 지원하지 않습니다 — 원본 앱에서 열어 작업하세요.
        </p>
      )}
      {err && <p className="mb-1 text-[11px]" style={{ color: "var(--danger)" }}>원문을 읽지 못했습니다.</p>}
    </>
  );
}

// ── 시장 견적 추정(RAG) ──
function EstimateSection() {
  const [estimate, setEstimate] = useState<RagEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fetchEstimate = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/btl/estimate");
      const data = (await res.json()) as { estimate?: RagEstimate; error?: string };
      if (res.ok && data.estimate) setEstimate(data.estimate);
      else setErr(data.error ?? "견적 추정 실패");
    } catch { setErr("견적기에 연결하지 못했습니다."); } finally { setLoading(false); }
  };
  return (
    <section className="ide-doc-section">
      <div className="ide-doc-section-head">
        <i className="codicon codicon-symbol-numeric" aria-hidden />
        <span>시장 견적 추정 (참고)</span>
      </div>
      {!estimate && (
        <button
          type="button"
          className="btl-discuss-btn"
          style={{ background: "var(--bg-2)", color: "var(--text-1)", border: "1px solid var(--line-1)", marginTop: 4 }}
          onClick={() => void fetchEstimate()}
          disabled={loading}
        >
          <i className={`codicon ${loading ? "codicon-loading codicon-modifier-spin" : "codicon-graph"}`} aria-hidden />
          {loading ? "견적기 조회 중…" : "시장 견적 추정 불러오기"}
        </button>
      )}
      {err && <p className="mt-1 text-[11.5px]" style={{ color: "var(--danger)" }}>{err}</p>}
      {estimate && (
        <div className="mt-1">
          <p className="text-[15px] font-bold text-[var(--text-1)]">
            {KRW(estimate.min)} ~ {KRW(estimate.max)}
            <span className="ml-2 text-[11px] font-normal text-[var(--text-3)]">중앙값 {KRW(estimate.mid)}</span>
          </p>
          <dl className="btl-field-list mt-1.5">
            <dt>공간·시공</dt><dd>{KRW(estimate.categories.construction)}</dd>
            <dt>운영</dt><dd>{KRW(estimate.categories.operation)}</dd>
            <dt>임대</dt><dd>{KRW(estimate.categories.rent)}</dd>
            <dt>기타</dt><dd>{KRW(estimate.categories.others)}</dd>
          </dl>
          <p className="mt-1 text-[10.5px]" style={{ color: "var(--text-3)" }}>
            출처: {estimate.source} · 내 견적 검증용 참고치(자동 반영 아님)
          </p>
        </div>
      )}
    </section>
  );
}

// ── RFP 요구 견적항목 대조 체크리스트 ──
function QuoteCheckSection() {
  const { artifacts } = useAgentStreamContext();
  const rfp = artifacts.find((a) => a.kind === "btl_rfp");
  const required = rfp?.kind === "btl_rfp" ? rfp.rfp.required_quote_sections ?? [] : [];
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const covered = required.filter((s) => checked[s.name]).length;
  if (required.length === 0) return null;
  return (
    <section className="ide-doc-section">
      <div className="ide-doc-section-head">
        <i className="codicon codicon-checklist" aria-hidden />
        <span>RFP 요구 견적항목 — {covered}/{required.length} 반영</span>
      </div>
      <p className="mb-1 text-[10.5px]" style={{ color: "var(--text-3)" }}>
        RFP 가 요구한 비용 항목. 내 견적서가 각 항목을 담았는지 체크.
      </p>
      <div className="flex flex-col gap-1">
        {required.map((s) => (
          <label key={s.name} className="btl-check-row">
            <input type="checkbox" checked={!!checked[s.name]} onChange={(e) => setChecked((c) => ({ ...c, [s.name]: e.target.checked }))} />
            <span className="btl-check-meta">
              <span className="btl-check-name">{s.name}</span>
              {s.items.length > 0 && <span className="btl-check-items">{s.items.join(", ")}</span>}
            </span>
          </label>
        ))}
      </div>
      {covered < required.length && (
        <p className="mt-1 text-[10.5px]" style={{ color: "var(--warn)" }}>
          미체크 {required.length - covered}개 — 누락 시 평가 감점/실격 위험.
        </p>
      )}
    </section>
  );
}

// ── 검토 포인트 — 이 산출물에서 짚어야 할 의제. 끌어온 페르소나가 이걸 인지한 채 검토한다. ──
function ReviewPointsSection({ slotId }: { slotId: WorkflowSlotId }) {
  const points = cardSpecForSlot(slotId)?.reviewPoints ?? [];
  if (points.length === 0) return null;
  return (
    <section className="ide-doc-section">
      <div className="ide-doc-section-head">
        <i className="codicon codicon-checklist" aria-hidden />
        <span>검토 포인트</span>
      </div>
      <p className="mb-1.5 text-[10.5px]" style={{ color: "var(--text-3)" }}>
        오른쪽에서 페르소나를 끌어다 놓으면 이 포인트들을 자기 렌즈로 짚어 검토합니다.
      </p>
      <ul className="rp-list">
        {points.map((p, i) => (
          <li key={i} className="rp-item">
            <i className="codicon codicon-circle-small-filled" aria-hidden style={{ color: "var(--accent)", fontSize: 13 }} />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 콘텐츠 루프 — 군집 sharp 피드백 → 판정·반응율·비포애프터 ──
interface ContentReview {
  verdict: "drop" | "pivot" | "sharpen";
  verdict_reason: string;
  pivot_to?: string;
  segments: { type: string; relevant: boolean; engage_before: boolean; engage_after: boolean; note?: string }[];
  findings: { target: string; issue: string; fix: string; segment?: string }[];
  after?: string;
}
const VERDICT = {
  sharpen: { label: "다듬기", tone: "var(--accent)", icon: "tools" },
  pivot: { label: "방향 전환", tone: "var(--warn)", icon: "arrow-swap" },
  drop: { label: "버리기·재기획", tone: "var(--danger)", icon: "trash" },
} as const;

// 관련 군집의 '인구 가중' 반응율(%) — 단순 개수 아닌 실제 방문 인구 추정(군집 size 기준).
function reactionPct(segs: ContentReview["segments"], key: "engage_before" | "engage_after"): number {
  let pop = 0, react = 0;
  for (const s of segs) {
    if (!s.relevant) continue;
    const c = archetypeByType(s.type as never)?.count ?? 0;
    pop += c;
    if (s[key]) react += c;
  }
  return pop === 0 ? 0 : Math.round((react / pop) * 100);
}

// 슬롯별 루프 라벨 — 콘텐츠(SNS)와 기획안 등 산출물에 같은 엔진을 다른 옷으로.
function loopLabels(slotId: string) {
  const spec = cardSpecForSlot(slotId);
  const title = spec?.header.title ?? "산출물";
  const isProposal = slotId === "proposal";
  return {
    icon: spec?.header.icon ?? "organization",
    head: `${title} — 방문객 군집 피드백`,
    placeholder: isProposal
      ? "기획안 초안을 붙여넣거나, 카드에 파일을 불러오면 자동으로 불러옵니다 (예: 컨셉·공간·운영·확산…)"
      : "게시글 아이디어/초안을 던지세요 (예: 성수 디저트 팝업 오픈, 한정 크루아상 + 포토존…)",
    outFile: `${title}.octopus.md`,
  };
}

// 방문객 군집 sharp 루프 — 산출물(콘텐츠/기획안)을 군집 데이터로 깎아 판정·반응율·비포애프터.
// 채택하면 사람 입력 파일은 그대로 두고 `{라벨}.octopus.md` 로만 내보낸다(폴더 열려 있을 때).
function AudienceLoopSection({ slotId }: { slotId: WorkflowSlotId }) {
  const { docs } = useBoardDocs();
  const { writeOutput, hasFolder } = useProjectFolder();
  const handle = docs.find((d) => d.slotId === slotId)?.handle;
  const L = loopLabels(slotId);
  const [content, setContent] = useState("");
  const [review, setReview] = useState<ContentReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // 바운드 파일이 있으면 본문을 불러와 시작점으로(편집 가능).
  useEffect(() => {
    if (!handle) return;
    handle.getFile().then((f) => f.text()).then((t) => setContent((c) => c || t.slice(0, 20000))).catch(() => {});
  }, [handle]);

  const run = async () => {
    if (!content.trim() || loading) return;
    setLoading(true); setErr(null); setReview(null); setSaved(null);
    // 시연 모드 — 느린 LLM 호출 대신 고정 리뷰(0%→78%)를 스피너 잠깐 후 보여준다.
    if (isDemoMode()) {
      setTimeout(() => { setReview(DEMO_REVIEW as ContentReview); setLoading(false); }, 1400);
      return;
    }
    try {
      const res = await fetch("/api/btl/persona-feedback", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
      });
      const d = (await res.json()) as { review?: ContentReview; error?: string };
      if (res.ok && d.review) setReview(d.review);
      else setErr(d.error ?? "피드백 실패");
    } catch { setErr("연결 실패"); } finally { setLoading(false); }
  };

  // 채택 — after 를 작업 텍스트로(재검토 가능) + 폴더에 산출물 파일 출력(사람 파일 불변).
  const accept = async (after: string) => {
    setContent(after); setReview(null);
    if (isDemoMode()) { setSaved(L.outFile); return; } // 시연 — 실제 쓰기 없이 출력 표시
    const ok = await writeOutput(L.outFile, after);
    setSaved(ok ? L.outFile : "(folderless)");
  };

  const rel = review ? review.segments.filter((s) => s.relevant) : [];
  const pb = review ? reactionPct(review.segments, "engage_before") : 0;
  const pa = review ? reactionPct(review.segments, "engage_after") : 0;
  const v = review ? VERDICT[review.verdict] : null;

  return (
    <section className="ide-doc-section">
      <div className="ide-doc-section-head">
        <i className={`codicon codicon-${L.icon}`} aria-hidden />
        <span>{L.head}</span>
      </div>
      <textarea
        className="facet-edit-area" rows={4}
        placeholder={L.placeholder}
        value={content} onChange={(e) => setContent(e.target.value)}
      />
      <button type="button" className="btl-discuss-btn" onClick={() => void run()} disabled={!content.trim() || loading}>
        <i className={`codicon ${loading ? "codicon-loading codicon-modifier-spin" : "codicon-organization"}`} aria-hidden />
        {loading ? "군집 검토 중…" : "방문객 군집 피드백"}
      </button>
      {err && <p className="mt-1 text-[11.5px]" style={{ color: "var(--danger)" }}>{err}</p>}

      {review && v && (
        <div className="cl-review">
          {/* 판정 + 반응율(인구 가중 %) */}
          <div className="cl-verdict" style={{ borderColor: v.tone }}>
            <span className="cl-verdict-badge" style={{ background: v.tone }}>
              <i className={`codicon codicon-${v.icon}`} aria-hidden /> {v.label}
            </span>
            <span className="cl-engage">
              반응 인구 <b style={{ color: "var(--text-3)" }}>{pb}%</b> → <b style={{ color: "var(--accent)" }}>{pa}%</b>
              <span style={{ color: "var(--text-3)" }}> · 군집 {rel.filter((s) => s.engage_before).length}→{rel.filter((s) => s.engage_after).length}/{rel.length}</span>
            </span>
          </div>
          <p className="cl-reason">{review.verdict_reason}</p>
          {review.pivot_to && <p className="cl-pivot"><i className="codicon codicon-arrow-right" aria-hidden /> {review.pivot_to}</p>}

          {/* 요소 단위 지적 */}
          {review.findings.length > 0 && (
            <div className="cl-findings">
              {review.findings.map((f, i) => (
                <div key={i} className="cl-finding">
                  <span className="cl-finding-target">{f.target}{f.segment ? ` · ${f.segment}` : ""}</span>
                  <span className="cl-finding-fix"><i className="codicon codicon-arrow-small-right" aria-hidden />{f.fix}</span>
                </div>
              ))}
            </div>
          )}

          {/* 비포애프터 — after 채택 → .octopus.md 출력 */}
          {review.after && (
            <div className="cl-after">
              <div className="cl-after-head">다듬은 안 (after)</div>
              <pre className="cl-after-body">{review.after}</pre>
              <button type="button" className="btl-discuss-btn" style={{ marginTop: 6 }}
                onClick={() => void accept(review.after!)}>
                <i className="codicon codicon-check" aria-hidden />
                {hasFolder || isDemoMode() ? `이 안 채택 → ${L.outFile} 출력` : "이 안 채택 → 작업본 교체"}
              </button>
            </div>
          )}
        </div>
      )}
      {saved && saved !== "(folderless)" && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--ok)" }}>
          <i className="codicon codicon-save" aria-hidden /> 폴더에 출력됨: {saved} (입력 파일은 그대로)
        </p>
      )}
      {saved === "(folderless)" && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
          작업본 교체됨. ‘폴더에 저장’하면 {L.outFile} 로 내보냅니다.
        </p>
      )}
    </section>
  );
}

// ── 비주얼 생성(Higgsfield) — 콘텐츠 루프의 끝. 다듬은 콘텐츠를 실제 이미지로(목업 폴백). ──
function VisualGenSection({ slotId }: { slotId: WorkflowSlotId }) {
  const { docs } = useBoardDocs();
  const { requestApproval } = useAgentStreamContext();
  const handle = docs.find((d) => d.slotId === slotId)?.handle;
  const [prompt, setPrompt] = useState("");
  const [caption, setCaption] = useState("");
  const [aspect, setAspect] = useState("4:5");
  const [url, setUrl] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ mock: boolean; permalink?: string; note?: string } | null>(null);

  // 콘텐츠 본문이 있으면 이미지 프롬프트·캡션 시드로.
  useEffect(() => {
    if (!handle) return;
    handle.getFile().then((f) => f.text()).then((t) => {
      setPrompt((p) => p || t.slice(0, 240));
      setCaption((c) => c || t.slice(0, 400));
    }).catch(() => {});
  }, [handle]);

  // 인스타 발행 — 외부 비가역 액션이라 승인 게이트 먼저. 목업 이미지/미연결이면 mock.
  const publish = async () => {
    if (!url || publishing) return;
    setPublished(null);
    const ok = await requestApproval({
      id: `ig-${slotId}-${url.slice(-12)}`, kind: "instagram_publish",
      post: { caption, imageUrl: url, mediaType: "IMAGE", account: "달무드", concept: "콘텐츠 카드 발행" },
    });
    if (!ok) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/btl/publish-instagram", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url, caption }),
      });
      const d = (await res.json()) as { mock?: boolean; permalink?: string; note?: string; error?: string };
      if (d.error) setErr(d.error);
      else setPublished({ mock: !!d.mock, permalink: d.permalink, note: d.note });
    } catch { setErr("발행 연결 실패"); } finally { setPublishing(false); }
  };

  const run = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true); setErr(null); setUrl(null);
    try {
      const res = await fetch("/api/btl/visual", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, aspect }),
      });
      const d = (await res.json()) as { url?: string; mock?: boolean; error?: string };
      if (d.url) { setUrl(d.url); setMock(!!d.mock); }
      else setErr(d.error ?? "비주얼 생성 실패");
    } catch { setErr("연결 실패"); } finally { setLoading(false); }
  };

  return (
    <section className="ide-doc-section">
      <div className="ide-doc-section-head">
        <i className="codicon codicon-device-camera" aria-hidden />
        <span>비주얼 생성 (Higgsfield)</span>
      </div>
      <textarea
        className="facet-edit-area" rows={3}
        placeholder="이미지 연출 프롬프트 (예: 성수 캔들 팝업, 달빛 조명, 따뜻한 우드톤, 시향하는 손…)"
        value={prompt} onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="flex items-center gap-1.5" style={{ marginTop: 6 }}>
        <select className="wf-pick-select" style={{ flex: "0 0 auto", maxWidth: 110 }} value={aspect} onChange={(e) => setAspect(e.target.value)} aria-label="비율">
          <option value="4:5">피드 4:5</option>
          <option value="9:16">릴스/스토리 9:16</option>
          <option value="1:1">정방 1:1</option>
          <option value="16:9">가로 16:9</option>
        </select>
        <button type="button" className="btl-discuss-btn" onClick={() => void run()} disabled={!prompt.trim() || loading}>
          <i className={`codicon ${loading ? "codicon-loading codicon-modifier-spin" : "codicon-sparkle"}`} aria-hidden />
          {loading ? "생성 중…" : "비주얼 생성"}
        </button>
      </div>
      {err && <p className="mt-1 text-[11.5px]" style={{ color: "var(--danger)" }}>{err}</p>}
      {url && (
        <div className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- 생성/목업 비주얼 미리보기 */}
          <img src={url} alt="생성 비주얼" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line-1)" }} />
          {mock && <p className="mt-1 text-[10.5px]" style={{ color: "var(--text-3)" }}>Higgsfield 미연결 — 목업입니다. 설정에서 계정 연결 시 실제 생성.</p>}

          {/* 인스타 발행 — 캡션 + 승인 게이트(외부 비가역). */}
          <div className="ide-doc-section-head mt-2" style={{ borderTop: "1px solid var(--line-1)", paddingTop: 8 }}>
            <i className="codicon codicon-send" aria-hidden />
            <span>인스타 발행</span>
          </div>
          <textarea className="facet-edit-area" rows={3} placeholder="발행 캡션(해시태그 포함)" value={caption} onChange={(e) => setCaption(e.target.value)} />
          <button type="button" className="btl-discuss-btn" style={{ marginTop: 6 }} onClick={() => void publish()} disabled={!caption.trim() || publishing}>
            <i className={`codicon ${publishing ? "codicon-loading codicon-modifier-spin" : "codicon-send"}`} aria-hidden />
            {publishing ? "발행 중…" : "인스타 발행 (승인 후)"}
          </button>
          {mock && <p className="mt-1 text-[10.5px]" style={{ color: "var(--text-3)" }}>목업 이미지는 실발행 불가 — 실제 비주얼을 먼저 생성하세요.</p>}
          {published && (
            <p className="mt-1 text-[11px]" style={{ color: published.mock ? "var(--text-3)" : "var(--ok)" }}>
              <i className={`codicon ${published.mock ? "codicon-info" : "codicon-pass-filled"}`} aria-hidden />{" "}
              {published.mock ? (published.note ?? "mock 발행") : "발행 완료"}
              {published.permalink && <> · <a href={published.permalink} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>게시물 보기</a></>}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ── 합성(composite) — 구성 카드(참조) 진척 + 합본. 제안서 = 기획안+운영안+견적. ──
function CompositeSection() {
  const { pack } = useActiveWorkflow();
  const { artifacts, addArtifact } = useAgentStreamContext();
  const composes = pack?.composes ?? [];
  if (composes.length === 0) return null;

  // 구성 카드가 보드에 있는지(=참조 가능). slotId 보유 아티팩트로 판정.
  const present = (slot: string) =>
    artifacts.some((a) => ("slotId" in a && a.slotId === slot) || (slot === "rfp" && a.kind === "btl_rfp"));
  const done = composes.filter(present).length;

  return (
    <section className="ide-doc-section">
      <div className="ide-doc-section-head">
        <i className="codicon codicon-package" aria-hidden />
        <span>구성 — {done}/{composes.length} 준비</span>
      </div>
      <p className="mb-1 text-[10.5px]" style={{ color: "var(--text-3)" }}>
        제안서는 아래 구성 카드를 <b>참조</b>해 묶습니다(복사 아님 — 원본 수정 시 반영).
      </p>
      <div className="flex flex-col gap-1">
        {composes.map((slot) => {
          const spec = cardSpecForSlot(slot);
          const has = present(slot);
          return (
            <div key={slot} className="cm-row">
              <i className={`codicon ${has ? "codicon-pass-filled" : "codicon-circle-large-outline"}`} style={{ color: has ? "var(--ok)" : "var(--text-3)", fontSize: 14 }} aria-hidden />
              <span className="cm-name">{spec?.header.title ?? slot}</span>
              {!has && (
                <button type="button" className="cm-add" onClick={() => addArtifact({ kind: "btl_doc_file", slotId: slot, name: spec?.header.title ?? slot, ext: "" })}>
                  <i className="codicon codicon-add" aria-hidden /> 추가
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="btl-discuss-btn" disabled={done < composes.length}
        title={done < composes.length ? "구성 카드를 모두 준비하면 합본할 수 있습니다" : "구성을 묶어 제안서 합본"}>
        <i className="codicon codicon-combine" aria-hidden />
        {done < composes.length ? `합본 — 구성 ${composes.length - done}개 더 필요` : "제안서 합본 보기"}
      </button>
    </section>
  );
}

// CardSpec.sections 의 kind → 섹션 렌더. (typed_view 는 카드 본체가 직접 렌더 — 여기선 제외)
export function CardSection({
  kind, slotId, name, ext,
}: {
  kind: CardSectionKind;
  slotId: WorkflowSlotId;
  name: string;
  ext: string;
}) {
  switch (kind) {
    case "raw_open": return <RawOpenSection slotId={slotId} name={name} ext={ext} />;
    case "estimate": return <EstimateSection />;
    case "rfp_quote_check": return <QuoteCheckSection />;
    case "review_points": return <ReviewPointsSection slotId={slotId} />;
    case "content_loop": return <AudienceLoopSection slotId={slotId} />;
    case "visual_gen": return <VisualGenSection slotId={slotId} />;
    case "audience_loop": return <AudienceLoopSection slotId={slotId} />;
    case "composite": return <CompositeSection />;
    case "typed_view": return null; // 추출 뷰는 카드 본체가 렌더(RFP)
  }
}
