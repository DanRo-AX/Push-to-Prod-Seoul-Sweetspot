"use client";

// lib/use-btl-orchestrator.ts — 채팅 오케스트레이터(클라). 사용자 메시지를 /api/btl/orchestrate
// 로 보내 보드 동작(op)을 받고, 보드에서 실행한다. 손으로 하는 동작을 채팅이 대신 호출(포용성).

import { useCallback, useState } from "react";
import { useAgentStreamContext } from "@/lib/agent-stream-context";
import { useBoardDocs } from "@/lib/board-docs-context";
import { useActiveCard } from "@/lib/active-card-context";
import { useCardDrafter } from "@/lib/use-card-drafter";
import { cardSpecForSlot } from "@/lib/ide/card-spec";
import { makeTextHandle } from "@/lib/fs-access";
import { artifactToMarkdown } from "@/lib/ide/export-md";
import type { BoardOp, OrchestrateResult } from "@/lib/ide/board-ops";
import type { Artifact, RfpDocument } from "@/lib/types";

interface PersonaReview {
  verdict: "drop" | "pivot" | "sharpen";
  verdict_reason: string;
  segments: { relevant: boolean; engage_before: boolean; engage_after: boolean }[];
  findings: { target: string; fix: string }[];
  after?: string;
}
const VERDICT_LABEL = { drop: "버리기·재기획", pivot: "방향 전환", sharpen: "다듬기" } as const;

export function useBtlOrchestrator() {
  const ctx = useAgentStreamContext();
  const { docs, bindDoc } = useBoardDocs();
  const { activeSlot } = useActiveCard();
  const { draftCard, draftAll } = useCardDrafter();
  const [busy, setBusy] = useState(false);

  // 보드에서 평가할 텍스트를 끌어온다 — 바운드 파일(기획안/콘텐츠) 우선, 없으면 구조화 산출물(RFP 등).
  const boardContent = useCallback(async (): Promise<string | null> => {
    const doc = docs.find((d) => d.handle && (d.slotId === "proposal" || d.slotId === "content")) ?? docs.find((d) => d.handle);
    if (doc?.handle) {
      try { return (await (await doc.handle.getFile()).text()).slice(0, 20000); } catch { /* fall through */ }
    }
    for (const a of ctx.artifacts) {
      const md = artifactToMarkdown(a);
      if (md) return md.markdown;
    }
    return null;
  }, [docs, ctx.artifacts]);

  const exec = useCallback(async (op: BoardOp) => {
    if (op.op === "add_card") {
      const spec = cardSpecForSlot(op.slot);
      ctx.addArtifact({ kind: "btl_doc_file", slotId: op.slot, name: spec?.header.title ?? op.slot, ext: "" });
    } else if (op.op === "draft_card") {
      const spec = cardSpecForSlot(op.slot);
      // 카드가 보드에 없으면 먼저 깔고(렌더 위해), AI 초안으로 채운다.
      if (!ctx.artifacts.some((a) => "slotId" in a && a.slotId === op.slot)) {
        ctx.addArtifact({ kind: "btl_doc_file", slotId: op.slot, name: spec?.header.title ?? op.slot, ext: "" });
      }
      const r = await draftCard(op.slot);
      ctx.pushEvent({ type: "text_delta", text: r.ok
        ? `「${spec?.header.title ?? op.slot}」 AI 초안을 카드에 채웠어요(검토/수정 필요). 방문객 군집을 끌어다 놓으면 검토 포인트로 깎아드려요.`
        : (r.error ?? "초안 생성 실패") });
    } else if (op.op === "draft_all") {
      const r = await draftAll();
      ctx.pushEvent({ type: "text_delta", text: r.error
        ? r.error
        : r.filled.length
          ? `${r.filled.join("·")} 초안을 채웠어요(모두 검토/수정 필요). 사람만 가능한 항목은 [사람 확인 필요]로 비워뒀어요.`
          : "채울 빈 카드가 없어요(워크플로를 먼저 로드하세요)." });
    } else if (op.op === "revise_card") {
      // 방금 받은 군집 코멘트(채팅 persona_comment)를 반영해 카드 수정 — 드래그 의견→실제 수정 루프.
      const slot = op.slot || activeSlot || "proposal";
      const spec = cardSpecForSlot(slot);
      const bound = docs.find((d) => d.slotId === slot);
      if (!bound?.handle) {
        ctx.pushEvent({ type: "text_delta", text: `「${spec?.header.title ?? slot}」 카드에 수정할 내용이 없어요. 먼저 초안을 만들거나(파일 불러오기) 채워 주세요.` });
        return;
      }
      // 최근 군집 코멘트 모으기(마지막 user_message 이후의 persona_comment).
      let cut = 0;
      for (let i = ctx.events.length - 1; i >= 0; i--) { if (ctx.events[i].type === "user_message") { cut = i; break; } }
      const comments = ctx.events
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.type === "persona_comment")
        .map(({ e }) => (e as { name: string; text: string }))
        .map((e) => `${e.name}: ${e.text}`);
      if (comments.length === 0) {
        ctx.pushEvent({ type: "text_delta", text: "반영할 군집 의견이 없어요. 우측에서 군집을 카드에 끌어다 의견을 먼저 받으세요." });
        return;
      }
      void cut;
      ctx.pushEvent({ type: "status", status: "thinking", message: `${spec?.header.title ?? slot} 수정 중(군집 의견 반영)` });
      try {
        const content = (await (await bound.handle.getFile()).text()).slice(0, 20000);
        const res = await fetch("/api/btl/revise-card", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, comments, reviewPoints: spec?.reviewPoints, label: spec?.header.title ?? slot }),
        });
        const data = (await res.json()) as { markdown?: string; error?: string };
        if (res.ok && data.markdown) {
          const name = `${spec?.header.title ?? slot}.octopus.md`;
          bindDoc({ slotId: slot, name, ext: "md", handle: makeTextHandle(name, data.markdown) });
          ctx.pushEvent({ type: "text_delta", text: `「${spec?.header.title ?? slot}」를 군집 의견을 반영해 수정했어요(AI 수정본·검토 필요). 카드에서 확인하세요.` });
        } else {
          ctx.pushEvent({ type: "text_delta", text: data.error ?? "수정 실패" });
        }
      } catch {
        ctx.pushEvent({ type: "text_delta", text: "수정 연결 실패" });
      }
    } else if (op.op === "persona_feedback") {
      // 채팅에 텍스트가 없으면 보드 카드(기획안/RFP 등)에서 직접 끌어온다.
      const content = op.content?.trim() || (await boardContent())?.trim();
      if (!content) {
        ctx.pushEvent({ type: "text_delta", text: "검토할 산출물이 없어요. 기획안 파일을 카드에 불러오거나 RFP를 먼저 분석해 주세요." });
        return;
      }
      ctx.pushEvent({ type: "status", status: "thinking", message: "방문객 군집이 콘텐츠 검토 중" });
      try {
        const res = await fetch("/api/btl/persona-feedback", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, types: op.types }),
        });
        const d = (await res.json()) as { review?: PersonaReview; error?: string };
        if (d.review) {
          const r = d.review;
          const rel = r.segments.filter((s) => s.relevant);
          const eb = rel.filter((s) => s.engage_before).length;
          const ea = rel.filter((s) => s.engage_after).length;
          const lines = [
            `판정: ${VERDICT_LABEL[r.verdict]} — ${r.verdict_reason}`,
            `반응 군집 ${eb} → ${ea} / ${rel.length}`,
            ...r.findings.slice(0, 4).map((f) => `· ${f.target}: ${f.fix}`),
            r.after ? `\n[다듬은 안]\n${r.after}` : "",
          ].filter(Boolean);
          ctx.pushEvent({ type: "text_delta", text: lines.join("\n") });
        } else {
          ctx.pushEvent({ type: "text_delta", text: d.error ?? "피드백 실패" });
        }
      } catch {
        ctx.pushEvent({ type: "text_delta", text: "피드백 연결 실패" });
      }
    }
  }, [ctx, boardContent, draftCard, draftAll, activeSlot, docs, bindDoc]);

  // 채팅에 파일 첨부 → RFP 로 분석(추출)해 보드에 RFP 카드 생성. 채팅 우선 흐름의 입력 게이트.
  const attachFile = useCallback(async (file: File) => {
    if (busy) return;
    setBusy(true);
    ctx.pushEvent({ type: "user_message", text: `「${file.name}」 첨부 — RFP 분석` });
    // 워크플로가 깐 빈 RFP 카드를 바로 로딩 카드로 교체(깜빡임 없이 한 자리에서 전환).
    ctx.removeArtifact("btl_doc_file", "rfp");
    ctx.addArtifact({ kind: "btl_doc_loading", slotId: "rfp", label: "RFP" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/btl/extract-rfp", { method: "POST", body: fd });
      const data = (await res.json()) as { rfp?: RfpDocument; error?: string };
      if (res.ok && data.rfp) {
        ctx.addArtifact({ kind: "btl_rfp", rfp: data.rfp });
        ctx.pushEvent({ type: "text_delta", text: `RFP 분석 완료 — 「${data.rfp.project_title}」. 적합도·평가배점·리스크를 카드에서 확인하세요. 기획안·견적·운영 카드에 초안을 올리면 방문객 군집이 검토 포인트로 깎아드려요.` });
      } else {
        ctx.pushEvent({ type: "text_delta", text: data.error ?? "RFP 분석 실패" });
      }
    } catch {
      ctx.pushEvent({ type: "text_delta", text: "RFP 분석 연결 실패" });
    } finally {
      ctx.removeArtifact("btl_doc_loading");
      setBusy(false);
    }
  }, [ctx, busy]);

  const sendBtl = useCallback(async (message: string) => {
    if (busy) return;
    setBusy(true);
    ctx.pushEvent({ type: "user_message", text: message });
    try {
      const cards = ctx.artifacts.map((a: Artifact) => ({
        slot: "slotId" in a ? a.slotId : a.kind === "btl_rfp" ? "rfp" : undefined,
        kind: a.kind,
        title: a.kind,
      }));
      const res = await fetch("/api/btl/orchestrate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, cards }),
      });
      const data = (await res.json()) as (OrchestrateResult & { error?: string });
      if (data.error) { ctx.pushEvent({ type: "text_delta", text: data.error }); return; }
      ctx.pushEvent({ type: "text_delta", text: data.reply });
      for (const op of data.ops ?? []) await exec(op);
    } catch {
      ctx.pushEvent({ type: "text_delta", text: "오케스트레이터 연결 실패" });
    } finally {
      setBusy(false);
    }
  }, [ctx, busy, exec]);

  return { sendBtl, attachFile, busy };
}
