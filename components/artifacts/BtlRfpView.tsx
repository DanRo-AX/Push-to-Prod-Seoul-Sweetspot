"use client";

// BtlRfpView — RFP 문서 렌더러
// ide-doc-* 토큰 기반: 다크(.ide 스코프)·라이트 양쪽 대응.

import type { RfpDocument } from "@/lib/types";
import { useCardSpec } from "@/lib/active-workflow-context";
import { SignalBand, CardSection } from "@/components/artifacts/card-sections";

function KRW(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export function BtlRfpView({ rfp }: { rfp: RfpDocument }) {
  const budgetText = rfp.budget_range
    ? `${KRW(rfp.budget_range.min ?? 0)} ~ ${KRW(rfp.budget_range.max ?? 0)}`
    : "미정";

  // RFP 카드 정의(CardSpec) — 활성 팩에서(편집 즉시 반영), 없으면 정적 폴백.
  const spec = useCardSpec("rfp");

  return (
    <div className="ide-doc-in" data-testid="btl-rfp-view">
      {/* 문서 헤더 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-file" aria-hidden />
        <span className="ide-doc-head-title">RFP 문서</span>
        <span className="ide-doc-head-meta">{rfp.rfp_id}</span>
      </div>

      {/* 시그널 띠 — CardSpec.signals 를 RFP 데이터에서 뽑아 렌더(읽기 전용). */}
      {spec?.signals && (
        <SignalBand signals={spec.signals} data={rfp as unknown as Record<string, unknown>} />
      )}

      {/* 클라이언트 callout */}
      <div className="ide-doc-callout ide-doc-callout--ok">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ok)]">
          <i className="codicon codicon-organization" aria-hidden style={{ fontSize: 12 }} />
          클라이언트
        </div>
        <p className="text-[14px] font-semibold text-[var(--text-1)]">
          {rfp.client_brand.client_name}
          <span className="ml-2 text-[12px] font-normal text-[var(--text-3)]">
            {rfp.client_brand.brand_name} · {rfp.client_brand.industry}
          </span>
        </p>
      </div>

      {/* 프로젝트 개요 섹션 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-info" aria-hidden />
          <span>프로젝트 개요</span>
        </div>
        <dl className="btl-field-list">
          <dt>프로젝트명</dt>
          <dd>{rfp.project_title}</dd>
          <dt>목표</dt>
          <dd>{rfp.objective}</dd>
          <dt>타겟 고객</dt>
          <dd>{rfp.target_audience}</dd>
        </dl>
      </section>

      {/* 일정·장소·예산 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-calendar" aria-hidden />
          <span>일정 · 장소 · 예산</span>
        </div>
        <dl className="btl-field-list">
          <dt>기간</dt>
          <dd>{rfp.period.start} ~ {rfp.period.end}</dd>
          <dt>장소</dt>
          <dd>
            {rfp.venue_requirement.area}
            {rfp.venue_requirement.size_pyeong != null && ` (${rfp.venue_requirement.size_pyeong}평)`}
            {rfp.venue_requirement.type && ` · ${rfp.venue_requirement.type}`}
          </dd>
          <dt>예산 범위</dt>
          <dd>{budgetText}</dd>
          {rfp.submission_deadline && (
            <>
              <dt>제출 마감</dt>
              <dd>{rfp.submission_deadline}</dd>
            </>
          )}
        </dl>
      </section>

      {/* 필수 요건 */}
      {rfp.mandatory_requirements.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-checklist" aria-hidden />
            <span>필수 요건</span>
          </div>
          <ul className="btl-bullet-list">
            {rfp.mandatory_requirements.map((req, i) => (
              <li key={i}>{req}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 전시/캠페인 서사 파트 — 제안 컨셉의 척추 */}
      {rfp.narrative_parts && rfp.narrative_parts.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-symbol-structure" aria-hidden />
            <span>서사 파트 ({rfp.narrative_parts.length})</span>
          </div>
          <ul className="btl-bullet-list">
            {rfp.narrative_parts.map((p, i) => (
              <li key={i}>
                <b>{p.name}</b>
                {p.description ? ` — ${p.description}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 의무 견적 골격 — 견적서가 맞춰야 할 비용 카테고리 */}
      {rfp.required_quote_sections && rfp.required_quote_sections.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-symbol-numeric" aria-hidden />
            <span>요구 견적 항목</span>
          </div>
          <ul className="btl-bullet-list">
            {rfp.required_quote_sections.map((s, i) => (
              <li key={i}>
                <b>{s.name}</b>
                {s.items.length > 0 ? ` — ${s.items.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 납품 산출물 */}
      {rfp.deliverables && rfp.deliverables.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-package" aria-hidden />
            <span>납품 산출물</span>
          </div>
          <ul className="btl-bullet-list">
            {rfp.deliverables.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 자사 적합도 — main RFP 분석 흡수(게이지 + 근거) */}
      {typeof rfp.fit_score === "number" && (
        <div className="ide-doc-callout mt-1">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--text-2)]">자사 적합도</span>
            <span className="text-[15px] font-bold text-[var(--accent)]">{rfp.fit_score}</span>
          </div>
          <div aria-hidden style={{ height: 6, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${rfp.fit_score}%`, background: "var(--accent)" }} />
          </div>
          {rfp.fit_rationale && <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-2)]">{rfp.fit_rationale}</p>}
        </div>
      )}

      {/* 평가 기준 — 배점(있으면) 우선, 없으면 문자열 목록 */}
      {(rfp.evaluation_weights && rfp.evaluation_weights.length > 0) ? (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-law" aria-hidden />
            <span>평가 기준 · 배점</span>
          </div>
          <dl className="btl-field-list">
            {rfp.evaluation_weights.map((w, i) => (
              <span key={i} style={{ display: "contents" }}>
                <dt>{w.label}</dt>
                <dd>{w.weight}%</dd>
              </span>
            ))}
          </dl>
        </section>
      ) : rfp.evaluation_criteria.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-law" aria-hidden />
            <span>평가 기준</span>
          </div>
          <ul className="btl-bullet-list">
            {rfp.evaluation_criteria.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 리스크 · 대응 — main 흡수 */}
      {rfp.risks && rfp.risks.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-warning" aria-hidden />
            <span>리스크 · 대응</span>
          </div>
          <ul className="btl-bullet-list">
            {rfp.risks.map((r, i) => (
              <li key={i}><b>{r.label}</b>{r.mitigation ? ` → ${r.mitigation}` : ""}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 수주 전략 — main 흡수 */}
      {rfp.win_themes && rfp.win_themes.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-flame" aria-hidden />
            <span>수주 전략</span>
          </div>
          <ul className="btl-bullet-list">
            {rfp.win_themes.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 유의사항·권리귀속 — 리스크 검토 대상 */}
      {rfp.terms && rfp.terms.length > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-warning" aria-hidden />
            <span>유의사항 · 권리귀속</span>
          </div>
          <ul className="btl-bullet-list">
            {rfp.terms.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 범위 + 계약방식 + 기간옵션 태그 */}
      <div className="btl-tag-row">
        {rfp.contract_method && (
          <span className="btl-tag">계약: {rfp.contract_method}</span>
        )}
        {rfp.scope_requirement.map((s) => (
          <span key={s} className="btl-tag">{s}</span>
        ))}
        {rfp.period_options?.map((p, i) => (
          <span key={`po-${i}`} className="btl-tag">
            {p.label}: {p.start}~{p.end}
          </span>
        ))}
      </div>

      {/* CardSpec.sections — typed_view(위 본문) 제외 나머지(검토 포인트 등). */}
      {(spec?.sections ?? [])
        .filter((k) => k !== "typed_view")
        .map((kind) => (
          <CardSection key={kind} kind={kind} slotId="rfp" name={rfp.rfp_id} ext="" />
        ))}
    </div>
  );
}
