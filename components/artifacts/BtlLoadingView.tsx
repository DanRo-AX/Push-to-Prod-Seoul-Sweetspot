"use client";

// BtlLoadingView — 추출 대기용 임시 카드 본문. 슬롯 지정 즉시 보드에 뜨고(카드 먼저),
// 추출이 끝나면 실제 산출물 카드(btl_rfp 등)로 교체된다. 내용은 '나중에' 채워진다.

export function BtlLoadingView({ label }: { label: string }) {
  return (
    <div className="ide-doc-in" data-testid="btl-loading-view">
      <div className="ide-doc-head">
        <i className="codicon codicon-loading codicon-modifier-spin" aria-hidden />
        <span className="ide-doc-head-title">{label}</span>
        <span className="ide-doc-head-meta">분석 중</span>
      </div>
      <div className="ide-doc-callout">
        <p className="text-[13px] font-semibold text-[var(--text-1)]">문서를 읽고 구조화하는 중…</p>
        <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
          잠시 후 이 카드에 내용이 채워집니다. 닫지 않아도 됩니다.
        </p>
      </div>
      {/* 스켈레톤 줄 — 채워질 자리 암시 */}
      <div className="mt-2 flex flex-col gap-1.5">
        {[88, 64, 76, 52].map((w, i) => (
          <span
            key={i}
            aria-hidden
            style={{
              height: 9,
              width: `${w}%`,
              borderRadius: 4,
              background: "var(--line-2)",
              opacity: 0.7,
            }}
          />
        ))}
      </div>
    </div>
  );
}
