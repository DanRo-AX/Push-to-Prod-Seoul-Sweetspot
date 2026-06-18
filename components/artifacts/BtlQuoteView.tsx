"use client";

// BtlQuoteView — 견적서 렌더러
// production_items × 단가 마스터 결과를 금액 테이블 + 합계로 표시.
// ide-doc-* 토큰 기반.

import type { QuoteDocument } from "@/lib/types";

function KRW(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

const CATEGORY_COLORS: Record<string, string> = {
  시공: "#e07b54",
  제작물: "#5a9fd4",
  렌탈: "#8b7ecb",
  인력: "#5aad8f",
  운영: "#c4934a",
  기타: "#888",
};

export function BtlQuoteView({ quote }: { quote: QuoteDocument }) {
  return (
    <div className="ide-doc-in" data-testid="btl-quote-view">
      {/* 문서 헤더 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-list-ordered" aria-hidden />
        <span className="ide-doc-head-title">견적서</span>
        <span className="ide-doc-head-meta">
          {quote.quote_id} · v{quote.version}
        </span>
      </div>

      {/* 클라이언트 callout */}
      <div className="ide-doc-callout ide-doc-callout--ok">
        <p className="text-[14px] font-semibold text-[var(--text-1)]">
          {quote.client_brand.client_name} · {quote.client_brand.brand_name}
          <span className="ml-2 text-[12px] font-normal text-[var(--text-3)]">
            {quote.client_brand.industry}
          </span>
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
          발행: {new Date(quote.issued_at).toLocaleDateString("ko-KR")} ·
          유효: {quote.validity.until}까지
        </p>
      </div>

      {/* 견적 라인 아이템 테이블 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-table" aria-hidden />
          <span>견적 항목 ({quote.line_items.length}건)</span>
        </div>
        {quote.line_items.length === 0 ? (
          <p className="btl-empty">견적 항목 없음</p>
        ) : (
          <table className="btl-table btl-quote-table">
            <thead>
              <tr>
                <th>항목명</th>
                <th>분류</th>
                <th className="text-right">수량</th>
                <th className="text-right">단가</th>
                <th className="text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {quote.line_items.map((line) => (
                <tr key={line.line_id}>
                  <td className="font-medium text-[var(--text-1)]">{line.name}</td>
                  <td>
                    <span
                      className="btl-category-badge"
                      style={{ color: CATEGORY_COLORS[line.category] ?? "#888" }}
                    >
                      {line.category}
                    </span>
                  </td>
                  <td className="text-right">{line.qty}</td>
                  <td className="text-right text-[var(--text-2)]">
                    {line.unit_price > 0 ? KRW(line.unit_price) : "—"}
                  </td>
                  <td className="text-right font-medium text-[var(--text-1)]">
                    {line.amount > 0 ? KRW(line.amount) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 합계 박스 */}
      <div className="btl-totals-box">
        <div className="btl-total-row">
          <span>공급가</span>
          <span>{KRW(quote.subtotal)}</span>
        </div>
        <div className="btl-total-row">
          <span>간접비 (8%)</span>
          <span>{KRW(quote.overhead)}</span>
        </div>
        <div className="btl-total-row">
          <span>마진 (12%)</span>
          <span>{KRW(quote.margin)}</span>
        </div>
        <div className="btl-total-row btl-total-row--grand">
          <span>합계 ({quote.currency})</span>
          <span data-testid="quote-total">{KRW(quote.total)}</span>
        </div>
        <p className="btl-vat-note">※ VAT 별도</p>
      </div>

      {/* 범위 */}
      {(quote.scope_boundary.included.length > 0 ||
        quote.scope_boundary.excluded.length > 0) && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-checklist" aria-hidden />
            <span>범위</span>
          </div>
          <div className="btl-scope-grid">
            {quote.scope_boundary.included.length > 0 && (
              <div>
                <p className="btl-scope-label btl-scope-label--in">포함</p>
                <ul className="btl-bullet-list">
                  {quote.scope_boundary.included.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {quote.scope_boundary.excluded.length > 0 && (
              <div>
                <p className="btl-scope-label btl-scope-label--out">제외</p>
                <ul className="btl-bullet-list">
                  {quote.scope_boundary.excluded.map((s, i) => (
                    <li key={i} className="text-[var(--text-3)]">{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 전제 조건 */}
      {quote.assumptions.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-info" aria-hidden />
            <span>전제 조건</span>
          </div>
          <ul className="btl-bullet-list">
            {quote.assumptions.map((a, i) => (
              <li key={i} className="text-[var(--text-3)]">{a}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
