"use client";

// components/ide/DefinitionEditor.tsx — 중앙 탭: 워크플로/카드 스펙 편집기.
//
// 정의 패널에서 워크플로 추가/카드 클릭으로 열린다. 팩 메타(라벨·설명)와 카드 스펙
// (제목·소스·섹션·시그널)을 편집 → WorkflowStore 에 즉시 반영(picker·정의패널 갱신).
// 데모는 메모리 저장(영속화 후속). 정의는 작업이 아니라 셋업이라 중앙 '탭'으로 연다.

import { useWorkflowStore } from "@/lib/ide/workflow-store";
import { useDefEditor } from "@/lib/def-editor-context";
import type { CardSource, CardSectionKind, CardSignalSpec } from "@/lib/ide/card-spec";

const ALL_SECTIONS: { kind: CardSectionKind; label: string }[] = [
  { kind: "typed_view", label: "구조 뷰" },
  { kind: "raw_open", label: "원문 열기" },
  { kind: "estimate", label: "시장 견적" },
  { kind: "rfp_quote_check", label: "요구항목 대조" },
  { kind: "review_points", label: "검토 포인트" },
];
const SOURCES: { v: CardSource; label: string }[] = [
  { v: "extract", label: "추출(입력 문서 파싱)" },
  { v: "bound_file", label: "본인 파일(그대로)" },
  { v: "generated", label: "생성(엔진)" },
];
const SIGNAL_AS: CardSignalSpec["as"][] = ["dday", "count", "money_range", "text"];

export function DefinitionEditor() {
  const { target } = useDefEditor();
  const { getPack, updatePackMeta, addCard, updateCard, removeCard, addSlot, updateSlot, removeSlot } = useWorkflowStore();
  if (!target) return null;
  const pack = getPack(target.packId);
  if (!pack) return null;

  return (
    <div className="def-edit">
      {/* 팩 메타 */}
      <section className="def-block">
        <label className="def-label">워크플로 이름</label>
        <input className="facet-edit-area" style={{ fontWeight: 700 }} value={pack.label}
          onChange={(e) => updatePackMeta(pack.id, { label: e.target.value })} />
        <label className="def-label">설명(흐름)</label>
        <input className="facet-edit-area" value={pack.description}
          onChange={(e) => updatePackMeta(pack.id, { description: e.target.value })} />
      </section>

      {/* 슬롯(문서타입 단계) */}
      <section className="def-block">
        <div className="def-block-head"><span>슬롯 ({pack.slots.length})</span></div>
        <p className="def-note" style={{ marginTop: 0, marginBottom: 8 }}>워크플로의 단계(문서타입). 카드의 slot 과 id 가 연결됩니다.</p>
        {pack.slots.map((s) => (
          <div key={s.id} className="def-slot-row">
            <span className="def-slot-id">{s.id}</span>
            <input className="def-inline" placeholder="라벨" value={s.label}
              onChange={(e) => updateSlot(pack.id, s.id, { label: e.target.value })} />
            <input className="def-inline" placeholder="설명(hint)" value={s.hint}
              onChange={(e) => updateSlot(pack.id, s.id, { hint: e.target.value })} />
            <button type="button" className="def-x" title="슬롯 삭제" onClick={() => removeSlot(pack.id, s.id)}>
              <i className="codicon codicon-trash" aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" className="def-add" onClick={() => addSlot(pack.id)}>
          <i className="codicon codicon-add" aria-hidden /> 슬롯 추가
        </button>
      </section>

      {/* 카드 목록 */}
      <section className="def-block">
        <div className="def-block-head">
          <span>카드 ({pack.cards.length})</span>
        </div>
        {pack.cards.map((c) => {
          const focused = target.cardSlot === c.slot;
          return (
            <div key={c.slot} className="def-card" style={focused ? { borderColor: "var(--ide-accent-bright)" } : undefined}>
              <div className="def-card-head">
                <input className="def-inline" value={c.header.title}
                  onChange={(e) => updateCard(pack.id, c.slot, { header: { ...c.header, title: e.target.value } })} />
                <span className="def-slot">slot: {c.slot}</span>
                <button type="button" className="def-x" title="카드 삭제" onClick={() => removeCard(pack.id, c.slot)}>
                  <i className="codicon codicon-trash" aria-hidden />
                </button>
              </div>

              <label className="def-label">소스</label>
              <select className="def-select" value={c.source}
                onChange={(e) => updateCard(pack.id, c.slot, { source: e.target.value as CardSource })}>
                {SOURCES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>

              <label className="def-label">섹션(순서대로)</label>
              <div className="flex flex-col gap-1">
                {ALL_SECTIONS.map((s) => {
                  const idx = c.sections.indexOf(s.kind);
                  const on = idx >= 0;
                  return (
                    <div key={s.kind} className="def-sec-row">
                      <label className="def-sec-toggle">
                        <input type="checkbox" checked={on} onChange={(e) => {
                          const next = e.target.checked
                            ? [...c.sections, s.kind]
                            : c.sections.filter((k) => k !== s.kind);
                          updateCard(pack.id, c.slot, { sections: next });
                        }} />
                        {s.label}
                      </label>
                      {on && (
                        <span className="def-sec-ord">
                          <button type="button" disabled={idx === 0} onClick={() => {
                            const next = [...c.sections];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            updateCard(pack.id, c.slot, { sections: next });
                          }}><i className="codicon codicon-chevron-up" aria-hidden /></button>
                          <button type="button" disabled={idx === c.sections.length - 1} onClick={() => {
                            const next = [...c.sections];
                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            updateCard(pack.id, c.slot, { sections: next });
                          }}><i className="codicon codicon-chevron-down" aria-hidden /></button>
                          <span className="def-sec-pos">{idx + 1}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <label className="def-label">시그널</label>
              {(c.signals ?? []).map((sig, i) => (
                <div key={i} className="def-sig-row">
                  <input className="def-inline def-sig-from" placeholder="필드(from)" value={sig.from}
                    onChange={(e) => {
                      const next = [...(c.signals ?? [])]; next[i] = { ...sig, from: e.target.value };
                      updateCard(pack.id, c.slot, { signals: next });
                    }} />
                  <select className="def-select def-sig-as" value={sig.as}
                    onChange={(e) => {
                      const next = [...(c.signals ?? [])]; next[i] = { ...sig, as: e.target.value as CardSignalSpec["as"] };
                      updateCard(pack.id, c.slot, { signals: next });
                    }}>
                    {SIGNAL_AS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <input className="def-inline def-sig-label" placeholder="라벨" value={sig.label ?? ""}
                    onChange={(e) => {
                      const next = [...(c.signals ?? [])]; next[i] = { ...sig, label: e.target.value };
                      updateCard(pack.id, c.slot, { signals: next });
                    }} />
                  <button type="button" className="def-x" onClick={() => {
                    updateCard(pack.id, c.slot, { signals: (c.signals ?? []).filter((_, j) => j !== i) });
                  }}><i className="codicon codicon-close" aria-hidden /></button>
                </div>
              ))}
              <button type="button" className="def-add" onClick={() => {
                updateCard(pack.id, c.slot, { signals: [...(c.signals ?? []), { from: "", as: "count" }] });
              }}>
                <i className="codicon codicon-add" aria-hidden /> 시그널 추가
              </button>
            </div>
          );
        })}

        {/* 카드는 슬롯을 따라 생긴다. 카드 없는 슬롯이 있으면 여기서 다시 붙인다. */}
        {pack.slots.filter((s) => !pack.cards.some((c) => c.slot === s.id)).map((s) => (
          <button key={s.id} type="button" className="def-add" style={{ marginRight: 6 }}
            onClick={() => addCard(pack.id, s.id)}>
            <i className="codicon codicon-add" aria-hidden /> {s.label} 카드
          </button>
        ))}
      </section>

      <p className="def-note">변경은 즉시 반영(메모리). 새로고침 시 기본값으로 복귀 — 파일 영속화는 후속.</p>
    </div>
  );
}
