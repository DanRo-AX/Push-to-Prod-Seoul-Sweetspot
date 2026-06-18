"use client";

// BtlBoundDocView — 산출물 카드(빈 양식). 카탈로그에서 추가하면 빈 카드로 뜨고, 파일이 필요하면
// '카드 안에서' 직접 불러온다(슬롯 지정 단계 없음 — 카드가 일급 단위).
//   · bound_file(제안서·견적·운영·콘텐츠) → '파일 불러오기' → board-docs 핸들로 섹션 구동.
//   · extract(RFP) → 'RFP 불러와 분석' → 추출 후 btl_rfp 카드로 교체.
// 본문 섹션은 CardSpec(데이터)이 선언(card-sections.tsx).

import { useState } from "react";
import { workflowSlot, extOf, type WorkflowSlotId } from "@/lib/ide/workflow";
import { useCardSpec } from "@/lib/active-workflow-context";
import { useBoardDocs } from "@/lib/board-docs-context";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import { pickFile } from "@/lib/fs-access";
import { useCardDrafter } from "@/lib/use-card-drafter";
import type { RfpDocument } from "@/lib/types";
import { CardSection } from "@/components/artifacts/card-sections";

export function BtlBoundDocView({ slotId, name, ext }: { slotId: string; name: string; ext: string }) {
  const sid = slotId as WorkflowSlotId;
  const slot = workflowSlot(sid);
  const spec = useCardSpec(slotId);
  const isExtract = spec?.source === "extract";
  const isBoundFile = spec?.source === "bound_file"; // generated 는 파일 인테이크 없음(합성 등)

  const { docs, bindDoc } = useBoardDocs();
  const ctx = useAgentStreamContext();
  const { draftCard, drafting } = useCardDrafter();
  const bound = docs.find((d) => d.slotId === slotId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // AI 초안 — draftGuide 있고 보드에 RFP 분석본이 있을 때만(초안은 RFP 근거).
  const canDraft = !!spec?.draftGuide && ctx.artifacts.some((a) => a.kind === "btl_rfp");
  const isDrafting = drafting === slotId;
  const runDraft = async () => {
    setErr(null);
    const r = await draftCard(slotId);
    if (!r.ok) setErr(r.error ?? "초안 생성 실패");
  };

  // bound_file 파일 불러오기 — 카드 안에서.
  const loadFile = async () => {
    const handle = await pickFile();
    if (!handle) return;
    const file = await handle.getFile();
    bindDoc({ slotId, name: file.name, ext: extOf(file.name), handle });
  };

  // RFP 불러와 분석 — 추출 후 btl_rfp 로 교체(이 빈 카드는 제거).
  const loadAndExtract = async () => {
    const handle = await pickFile();
    if (!handle) return;
    setBusy(true); setErr(null);
    ctx.addArtifact({ kind: "btl_doc_loading", slotId, label: spec?.header.title ?? "RFP" });
    try {
      const file = await handle.getFile();
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/btl/extract-rfp", { method: "POST", body: fd });
      const data = (await res.json()) as { rfp?: unknown; error?: string };
      if (res.ok && data.rfp) {
        ctx.addArtifact({ kind: "btl_rfp", rfp: data.rfp as RfpDocument });
        ctx.removeArtifact("btl_doc_file", slotId); // 빈 RFP 카드 제거
      } else setErr(data.error ?? "RFP 추출 실패");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "분석 실패");
    } finally {
      ctx.removeArtifact("btl_doc_loading");
      setBusy(false);
    }
  };

  return (
    <div className="ide-doc-in" data-testid="btl-bound-doc-view">
      <div className="ide-doc-head">
        <i className={`codicon codicon-${spec?.header.icon ?? "file-text"}`} aria-hidden />
        <span className="ide-doc-head-title">{spec?.header.title ?? slot?.label ?? "산출물"}</span>
        <span className="ide-doc-head-meta">{bound ? (bound.ext ? `.${bound.ext}` : "파일") : "빈 카드"}</span>
      </div>

      {/* 파일 인테이크 — 아직 파일 없으면 카드 안에서 불러오기 */}
      {isExtract ? (
        <div className="ide-doc-callout">
          <p className="text-[12.5px] text-[var(--text-1)]">RFP 파일을 불러오면 분석·구조화합니다.</p>
          <button type="button" className="btl-discuss-btn" style={{ marginTop: 8 }} onClick={() => void loadAndExtract()} disabled={busy}>
            <i className={`codicon ${busy ? "codicon-loading codicon-modifier-spin" : "codicon-go-to-file"}`} aria-hidden />
            {busy ? "분석 중…" : "RFP 불러와 분석"}
          </button>
          {err && <p className="mt-1 text-[11px]" style={{ color: "var(--danger)" }}>{err}</p>}
        </div>
      ) : isBoundFile ? (
        <div className="ide-doc-callout">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--text-3)]">
            <i className="codicon codicon-folder" aria-hidden style={{ fontSize: 12 }} />
            {bound ? "내 작업 폴더 문서" : "파일 없음"}
          </div>
          {bound ? (
            <p className="text-[14px] font-semibold text-[var(--text-1)]">{bound.name}</p>
          ) : (
            <p className="text-[12px] text-[var(--text-3)]">{slot?.hint ?? "이 카드에 쓸 파일을 불러오세요(선택)."}</p>
          )}
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
            {/* AI 초안 — RFP 근거로 이 카드를 채운다(before). 군집이 이어서 깎는다. */}
            {canDraft && (
              <button type="button" className="btl-discuss-btn" onClick={() => void runDraft()} disabled={isDrafting}>
                <i className={`codicon ${isDrafting ? "codicon-loading codicon-modifier-spin" : "codicon-sparkle"}`} aria-hidden />
                {isDrafting ? "초안 작성 중…" : bound ? "AI 초안 다시" : "AI 초안 생성"}
              </button>
            )}
            <button type="button" className="btl-discuss-btn" style={{ background: "var(--bg-2)", color: "var(--text-1)", border: "1px solid var(--line-1)" }} onClick={() => void loadFile()}>
              <i className="codicon codicon-go-to-file" aria-hidden />
              {bound ? "파일로 교체" : "파일 불러오기"}
            </button>
          </div>
          {err && <p className="mt-1 text-[11px]" style={{ color: "var(--danger)" }}>{err}</p>}
        </div>
      ) : null}

      {/* CardSpec.sections — 선언된 순서대로 (extract 의 typed_view 는 btl_rfp 카드가 렌더) */}
      {!isExtract && (spec?.sections ?? []).map((kind) => (
        <CardSection key={kind} kind={kind} slotId={sid} name={bound?.name ?? name} ext={bound?.ext ?? ext} />
      ))}
    </div>
  );
}
