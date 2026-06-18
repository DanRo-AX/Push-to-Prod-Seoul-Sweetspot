"use client";

// 비딩/견적 카드 — 카테고리별 견적 항목 + 소계/마진/총액 + 경쟁력 + 전제.
// VS Code 문서 idiom + 토큰 기반(라이트/다크 무관).
import type { Bid, BidLineItem } from "@/lib/types";

const won = (n: number) => `₩${Math.round(n).toLocaleString("ko-KR")}`;

export function BidCard({ bid }: { bid: Bid }) {
  // 카테고리별 그룹핑(표시 순서 유지).
  const groups: { category: string; items: BidLineItem[] }[] = [];
  for (const li of bid.lineItems) {
    let g = groups.find((x) => x.category === li.category);
    if (!g) {
      g = { category: li.category, items: [] };
      groups.push(g);
    }
    g.items.push(li);
  }

  return (
    <div className="ide-doc-in">
      <div className="ide-doc-head">
        <i className="codicon codicon-briefcase" aria-hidden />
        <span className="ide-doc-head-title">비딩 견적 · {bid.title}</span>
        <span className="ide-doc-head-meta" style={{ fontFamily: "inherit" }}>
          {bid.client}
        </span>
      </div>

      {/* 항목 — 카테고리별 */}
      {groups.map((g, gi) => (
        <section className="ide-doc-section" key={gi}>
          <div className="ide-doc-section-head">
            <span className="normal-case tracking-normal text-[var(--text-2)]">{g.category}</span>
          </div>
          {g.items.map((li, i) => (
            <div className="ide-doc-kv" key={i} style={{ alignItems: "baseline" }}>
              <span className="ide-doc-kv-key" style={{ minWidth: 0, flex: 1 }}>
                {li.item}
                {li.qty ? <span className="text-[var(--text-3)]"> · {li.qty}</span> : null}
                {li.note ? <span className="text-[var(--text-3)]"> ({li.note})</span> : null}
              </span>
              <span className="ide-doc-kv-val" style={{ flex: "0 0 auto", textAlign: "right" }}>
                {won(li.amount)}
              </span>
            </div>
          ))}
        </section>
      ))}

      {/* 합계 */}
      <section className="ide-doc-section">
        <div className="ide-doc-kv">
          <span className="ide-doc-kv-key" style={{ flex: 1 }}>소계</span>
          <span className="ide-doc-kv-val" style={{ flex: "0 0 auto" }}>{won(bid.subtotal)}</span>
        </div>
        <div className="ide-doc-kv">
          <span className="ide-doc-kv-key" style={{ flex: 1 }}>마진 ({bid.marginPct}%)</span>
          <span className="ide-doc-kv-val" style={{ flex: "0 0 auto" }}>
            {won(bid.total - bid.subtotal)}
          </span>
        </div>
        <div
          className="ide-doc-kv"
          style={{ borderTop: "1px solid var(--line-strong)", marginTop: 4, paddingTop: 8 }}
        >
          <span className="ide-doc-kv-key" style={{ flex: 1, fontWeight: 700, color: "var(--text-1)" }}>
            총액
          </span>
          <span
            className="ide-doc-kv-val"
            style={{ flex: "0 0 auto", fontSize: 15, fontWeight: 700, color: "var(--accent)" }}
          >
            {won(bid.total)}
          </span>
        </div>
      </section>

      {/* 경쟁력 */}
      <div className="ide-doc-callout ide-doc-callout--ok mt-3 flex gap-2">
        <i className="codicon codicon-flame shrink-0 text-[var(--ok)]" aria-hidden style={{ marginTop: 2 }} />
        <span className="text-[var(--text-1)]">{bid.competitiveness}</span>
      </div>

      {/* 전제 */}
      {bid.assumptions.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-info" aria-hidden />
            <span className="normal-case tracking-normal">견적 전제</span>
          </div>
          <ul className="ml-4 list-disc text-[12.5px] leading-relaxed text-[var(--text-2)]">
            {bid.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
