"use client";

// BtlProposalView — 기획제안서 렌더러
// field_provenance 배지(출처·자신감) + review_queue 인라인 표시.
// ide-doc-* 토큰 기반.

import type { ProposalDocument, FieldProvenance, ReviewQueueItem } from "@/lib/types";

const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** 출처 배지 — persona/rfp/data/calc/user */
function ProvBadge({ prov }: { prov: FieldProvenance }) {
  const isLow = prov.confidence < LOW_CONFIDENCE_THRESHOLD;
  const label =
    prov.source === "persona"
      ? `페르소나 · ${Math.round(prov.confidence * 100)}%`
      : prov.source === "rfp"
      ? "RFP"
      : prov.source === "data"
      ? "데이터"
      : prov.source === "calc"
      ? "계산"
      : "사용자";

  return (
    <span
      className="btl-prov-badge"
      data-low={isLow ? "true" : undefined}
      title={`출처: ${prov.source}${prov.card_id ? ` · 카드: ${prov.card_id}` : ""}${prov.persona_id ? ` · 페르소나: ${prov.persona_id}` : ""}`}
    >
      {isLow && <i className="codicon codicon-warning" aria-hidden style={{ fontSize: 10 }} />}
      {label}
    </span>
  );
}

/** 검토 대기 항목 — confidence < 0.7 인 필드 */
function ReviewQueueBanner({ items }: { items: ReviewQueueItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="btl-review-queue" data-testid="review-queue">
      <div className="btl-review-queue-head">
        <i className="codicon codicon-shield" aria-hidden style={{ fontSize: 13 }} />
        <span>검토 필요 ({items.length}개 필드)</span>
        <span className="btl-review-queue-hint">신뢰도 70% 미만 — 사람 확인 권장</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="btl-review-item">
          <code className="btl-review-path">{item.field_path}</code>
          <span className="btl-review-conf">{Math.round(item.confidence * 100)}%</span>
          {item.choices.length > 0 && (
            <div className="btl-review-choices">
              {item.choices.map((c, j) => (
                <button key={j} type="button" className="btl-choice-btn" disabled>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** 제작 항목 테이블 */
function ProductionItemsTable({ proposal }: { proposal: ProposalDocument }) {
  const items = proposal.production_items;
  if (items.length === 0) return <p className="btl-empty">제작 항목 없음</p>;

  const CATEGORY_COLORS: Record<string, string> = {
    시공: "#e07b54",
    제작물: "#5a9fd4",
    렌탈: "#8b7ecb",
    인력: "#5aad8f",
    운영: "#c4934a",
    기타: "#888",
  };

  return (
    <table className="btl-table">
      <thead>
        <tr>
          <th>항목명</th>
          <th>분류</th>
          <th className="text-right">수량</th>
          <th>사양 노트</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.item_id}>
            <td className="font-medium text-[var(--text-1)]">{item.item_name}</td>
            <td>
              <span
                className="btl-category-badge"
                style={{ color: CATEGORY_COLORS[item.category] ?? "#888" }}
              >
                {item.category}
              </span>
            </td>
            <td className="text-right">{item.qty}</td>
            <td className="text-[var(--text-3)]">{item.spec_note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BtlProposalView({ proposal }: { proposal: ProposalDocument }) {
  const provenanceByPath = new Map(
    proposal.field_provenance.map((p) => [p.field_path, p]),
  );

  function getProv(path: string) {
    return provenanceByPath.get(path);
  }

  return (
    <div className="ide-doc-in" data-testid="btl-proposal-view">
      {/* 문서 헤더 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-file-text" aria-hidden />
        <span className="ide-doc-head-title">기획제안서</span>
        <span className="ide-doc-head-meta">{proposal.proposal_id}</span>
      </div>

      {/* 클라이언트 */}
      <div className="ide-doc-callout ide-doc-callout--ok">
        <p className="text-[14px] font-semibold text-[var(--text-1)]">
          {proposal.client_brand.client_name} · {proposal.client_brand.brand_name}
          <span className="ml-2 text-[12px] font-normal text-[var(--text-3)]">
            {proposal.client_brand.industry}
          </span>
        </p>
      </div>

      {/* 검토 큐 — review_queue 존재 시 최상단 표시 */}
      <ReviewQueueBanner items={proposal.review_queue} />

      {/* 제안 핵심 메시지 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-lightbulb" aria-hidden />
          <span>제안 핵심</span>
          {getProv("proposal.proposal_angle.core_message") && (
            <ProvBadge prov={getProv("proposal.proposal_angle.core_message")!} />
          )}
        </div>
        <p className="text-[14px] font-semibold leading-relaxed text-[var(--text-1)]">
          {proposal.proposal_angle.core_message}
        </p>

        <dl className="btl-field-list mt-3">
          <dt className="flex items-center gap-1.5">
            왜 지금인가
            {getProv("proposal.proposal_angle.why_now") && (
              <ProvBadge prov={getProv("proposal.proposal_angle.why_now")!} />
            )}
          </dt>
          <dd>{proposal.proposal_angle.why_now}</dd>
          <dt className="flex items-center gap-1.5">
            차별점
            {getProv("proposal.proposal_angle.differentiation") && (
              <ProvBadge prov={getProv("proposal.proposal_angle.differentiation")!} />
            )}
          </dt>
          <dd>{proposal.proposal_angle.differentiation}</dd>
        </dl>

        {proposal.proposal_angle.evidence_refs.length > 0 && (
          <ul className="btl-bullet-list mt-2">
            {proposal.proposal_angle.evidence_refs.map((ref, i) => (
              <li key={i} className="text-[var(--text-3)]">
                <i className="codicon codicon-link" aria-hidden style={{ fontSize: 11 }} />
                {" "}{ref}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 컨셉 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-color-mode" aria-hidden />
          <span>컨셉</span>
          {getProv("proposal.concept.mood") && (
            <ProvBadge prov={getProv("proposal.concept.mood")!} />
          )}
        </div>
        <p className="text-[14px] font-semibold text-[var(--text-1)]">{proposal.concept.theme}</p>
        <div className="btl-tag-row mt-2">
          {proposal.concept.mood.map((m) => (
            <span key={m} className="btl-tag">{m}</span>
          ))}
        </div>
        <dl className="btl-field-list mt-2">
          <dt className="flex items-center gap-1.5">
            핵심 체험
            {getProv("proposal.concept.key_experience") && (
              <ProvBadge prov={getProv("proposal.concept.key_experience")!} />
            )}
          </dt>
          <dd>{proposal.concept.key_experience}</dd>
        </dl>
      </section>

      {/* 공간 계획 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-layout" aria-hidden />
          <span>공간 계획 ({proposal.space_plan.size_pyeong}평)</span>
          {getProv("proposal.space_plan.zones") && (
            <ProvBadge prov={getProv("proposal.space_plan.zones")!} />
          )}
        </div>
        <ul className="btl-zone-list">
          {proposal.space_plan.zones.map((z, i) => (
            <li key={i}>
              <span className="btl-zone-name">{z.name}</span>
              <span className="btl-zone-purpose">{z.purpose}</span>
            </li>
          ))}
        </ul>
        {proposal.space_plan.layout_note && (
          <p className="mt-2 text-[12px] text-[var(--text-3)]">
            <i className="codicon codicon-info" aria-hidden /> {proposal.space_plan.layout_note}
          </p>
        )}
      </section>

      {/* 제작 항목 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-list-ordered" aria-hidden />
          <span>제작 항목 ({proposal.production_items.length}건)</span>
          {getProv("proposal.production_items") && (
            <ProvBadge prov={getProv("proposal.production_items")!} />
          )}
        </div>
        <ProductionItemsTable proposal={proposal} />
      </section>

      {/* 일정 */}
      {proposal.schedule.milestones.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-calendar" aria-hidden />
            <span>마일스톤 (리드타임 {proposal.schedule.lead_time_days}일)</span>
          </div>
          <ul className="btl-bullet-list">
            {proposal.schedule.milestones.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 성과 지표 */}
      {proposal.success_metric.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-graph" aria-hidden />
            <span>성과 목표</span>
            {getProv("proposal.success_metric") && (
              <ProvBadge prov={getProv("proposal.success_metric")!} />
            )}
          </div>
          <ul className="btl-bullet-list">
            {proposal.success_metric.map((m, i) => (
              <li key={i} className="font-medium text-[var(--text-1)]">{m}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 범위 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-checklist" aria-hidden />
          <span>범위</span>
        </div>
        <div className="btl-scope-grid">
          <div>
            <p className="btl-scope-label btl-scope-label--in">포함</p>
            <ul className="btl-bullet-list">
              {proposal.scope_boundary.included.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="btl-scope-label btl-scope-label--out">제외</p>
            <ul className="btl-bullet-list">
              {proposal.scope_boundary.excluded.map((s, i) => (
                <li key={i} className="text-[var(--text-3)]">{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 기여 페르소나 */}
      {proposal.contributors.length > 0 && (
        <div className="btl-contributor-row">
          {proposal.contributors.map((c) => (
            <span key={c.persona_id} className="btl-contributor-chip">
              <i className="codicon codicon-account" aria-hidden style={{ fontSize: 11 }} />
              {c.persona_id}
              <span className="btl-contributor-exp">Lv.{c.experience_level}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
