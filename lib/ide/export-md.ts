// lib/ide/export-md.ts — 보드 산출물 카드 → 사람 가독 마크다운(.octopus.md) 직렬화.
//
// 폴더에 저장할 때(또는 폴더 재오픈 상태에서) 구조화 카드(btl_rfp/btl_proposal/btl_quote)를
// 사람이 그대로 읽을 수 있는 마크다운으로 내보낸다. 파일명은 `{카드라벨}.octopus.md` —
// 입력 파일(사람 원본)과 절대 충돌하지 않게 `.octopus.md` 접미사를 붙이고, 사람 파일은
// 덮어쓰지 않는다(이 함수는 .octopus.md 만 만든다).
//
// 파일 포인터 카드(btl_doc_file/btl_*_file 등)는 그 자체가 폴더 파일이므로 내보낼 게 없다 → null.

import type {
  Artifact,
  RfpDocument,
  ProposalDocument,
  QuoteDocument,
} from "@/lib/types";

export interface ExportedDoc {
  /** 파일명 — `{라벨}.octopus.md` */
  filename: string;
  markdown: string;
}

const NF = new Intl.NumberFormat("ko-KR");
const won = (n: number) => `${NF.format(Math.round(n))}원`;

/** 파일명에 못 쓰는 문자 제거(슬래시 등). 한글은 그대로 둔다. */
function safeLabel(label: string): string {
  return label.replace(/[\\/:*?"<>|]/g, "").trim() || "산출물";
}

function fileFor(label: string): string {
  return `${safeLabel(label)}.octopus.md`;
}

function bullets(items: string[] | undefined): string {
  if (!items?.length) return "_(없음)_\n";
  return items.map((s) => `- ${s}`).join("\n") + "\n";
}

function rfpMd(rfp: RfpDocument): string {
  const b = rfp.client_brand;
  const L: string[] = [];
  L.push(`# ${rfp.project_title}`);
  L.push("");
  L.push(`> ${b.brand_name} (${b.client_name}) · ${b.industry}`);
  L.push("");
  L.push("## 개요");
  L.push(`- **목적**: ${rfp.objective}`);
  L.push(`- **타깃**: ${rfp.target_audience}`);
  L.push(`- **기간**: ${rfp.period.start} ~ ${rfp.period.end}`);
  if (rfp.venue_requirement?.type || rfp.venue_requirement?.size_pyeong) {
    const v = rfp.venue_requirement;
    L.push(`- **공간**: ${[v.type, v.area, v.size_pyeong ? `${v.size_pyeong}평` : ""].filter(Boolean).join(" · ")}`);
  }
  if (rfp.budget_range) {
    const { min, max, currency } = rfp.budget_range;
    L.push(`- **예산**: ${[min, max].filter((x) => x != null).map((x) => NF.format(x!)).join(" ~ ")} ${currency}`);
  }
  if (rfp.contract_method) L.push(`- **계약방식**: ${rfp.contract_method}`);
  if (rfp.submission_deadline) L.push(`- **제출마감**: ${rfp.submission_deadline}`);
  L.push("");

  if (rfp.fit_score != null) {
    L.push("## 자사 적합도");
    L.push(`**${rfp.fit_score}/100** — ${rfp.fit_rationale ?? ""}`.trim());
    L.push("");
  }
  if (rfp.win_themes?.length) {
    L.push("## 수주 전략");
    L.push(bullets(rfp.win_themes));
  }
  L.push("## 과업 범위");
  L.push(bullets(rfp.scope_requirement));
  L.push("## 필수 요건");
  L.push(bullets(rfp.mandatory_requirements));
  L.push("## 평가 기준");
  if (rfp.evaluation_weights?.length) {
    L.push(rfp.evaluation_weights.map((w) => `- ${w.label} — **${w.weight}%**`).join("\n") + "\n");
  } else {
    L.push(bullets(rfp.evaluation_criteria));
  }
  if (rfp.narrative_parts?.length) {
    L.push("## 전시 서사 파트");
    L.push(rfp.narrative_parts.map((p) => `- **${p.name}**${p.description ? ` — ${p.description}` : ""}`).join("\n") + "\n");
  }
  if (rfp.deliverables?.length) {
    L.push("## 납품 산출물");
    L.push(bullets(rfp.deliverables));
  }
  if (rfp.risks?.length) {
    L.push("## 리스크 · 대응");
    L.push(rfp.risks.map((r) => `- **${r.label}** → ${r.mitigation}`).join("\n") + "\n");
  } else if (rfp.terms?.length) {
    L.push("## 유의사항");
    L.push(bullets(rfp.terms));
  }
  if (rfp.raw_text?.trim()) {
    L.push("---");
    L.push("## 원문");
    L.push("```");
    L.push(rfp.raw_text.trim());
    L.push("```");
  }
  return L.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

function proposalMd(p: ProposalDocument): string {
  const L: string[] = [];
  L.push(`# 기획안 — ${p.client_brand.brand_name}`);
  L.push("");
  L.push("## 핵심 메시지");
  L.push(`- **코어 메시지**: ${p.proposal_angle.core_message}`);
  L.push(`- **why now**: ${p.proposal_angle.why_now}`);
  L.push(`- **차별점**: ${p.proposal_angle.differentiation}`);
  L.push("");
  L.push("## 컨셉");
  L.push(`- **테마**: ${p.concept.theme}`);
  L.push(`- **무드**: ${p.concept.mood.join(", ")}`);
  L.push(`- **핵심 경험**: ${p.concept.key_experience}`);
  L.push("");
  L.push("## 타깃");
  L.push(`- **1차**: ${p.target_segment.primary}`);
  if (p.target_segment.segments?.length) L.push(`- **세그먼트**: ${p.target_segment.segments.join(", ")}`);
  L.push(`- **인사이트**: ${p.target_segment.insight}`);
  L.push("");
  L.push("## 공간 계획");
  L.push(`${p.space_plan.size_pyeong}평 — ${p.space_plan.layout_note}`);
  if (p.space_plan.zones?.length) {
    L.push("");
    L.push(p.space_plan.zones.map((z) => `- **${z.name}**: ${z.purpose}`).join("\n"));
  }
  L.push("");
  if (p.production_items?.length) {
    L.push("## 제작 항목");
    L.push("| 항목 | 분류 | 수량 | 비고 |");
    L.push("| --- | --- | --: | --- |");
    for (const it of p.production_items) {
      L.push(`| ${it.item_name} | ${it.category} | ${it.qty} | ${it.spec_note ?? ""} |`);
    }
    L.push("");
  }
  L.push("## 일정");
  L.push(`- **리드타임**: ${p.schedule.lead_time_days}일`);
  L.push(bullets(p.schedule.milestones));
  L.push("## 범위");
  L.push(`- **포함**: ${p.scope_boundary.included.join(", ") || "—"}`);
  L.push(`- **제외**: ${p.scope_boundary.excluded.join(", ") || "—"}`);
  L.push("");
  L.push("## 성공 지표");
  L.push(bullets(p.success_metric));
  return L.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

function quoteMd(q: QuoteDocument): string {
  const L: string[] = [];
  L.push(`# 견적서 — ${q.client_brand.brand_name}`);
  L.push("");
  L.push(`> v${q.version} · 발행 ${q.issued_at} · 유효 ${q.validity.until}까지`);
  L.push("");
  L.push("| 항목 | 분류 | 수량 | 단가 | 금액 |");
  L.push("| --- | --- | --: | --: | --: |");
  for (const li of q.line_items) {
    L.push(`| ${li.name} | ${li.category} | ${li.qty} | ${won(li.unit_price)} | ${won(li.amount)} |`);
  }
  L.push("");
  L.push(`- 소계: **${won(q.subtotal)}**`);
  L.push(`- 간접비: ${won(q.overhead)}`);
  L.push(`- 마진: ${won(q.margin)}`);
  L.push(`- **합계: ${won(q.total)}** (${q.currency})`);
  L.push("");
  L.push("## 범위");
  L.push(`- **포함**: ${q.scope_boundary.included.join(", ") || "—"}`);
  L.push(`- **제외**: ${q.scope_boundary.excluded.join(", ") || "—"}`);
  if (q.assumptions?.length) {
    L.push("");
    L.push("## 전제");
    L.push(bullets(q.assumptions));
  }
  return L.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

/**
 * 아티팩트 하나를 .octopus.md 로 직렬화. 내보낼 콘텐츠가 없는(파일 포인터 등) 카드는 null.
 * 구조화 카드(RFP/기획안/견적서)만 사람 가독 마크다운으로 만든다.
 */
export function artifactToMarkdown(a: Artifact): ExportedDoc | null {
  switch (a.kind) {
    case "btl_rfp":
      return { filename: fileFor("RFP"), markdown: rfpMd(a.rfp) };
    case "btl_proposal":
      return { filename: fileFor("기획안"), markdown: proposalMd(a.proposal) };
    case "btl_quote":
      return { filename: fileFor("견적서"), markdown: quoteMd(a.quote) };
    default:
      return null; // 파일 포인터/로딩/facet 등 — 내보낼 본문 없음
  }
}

/** 보드 전체에서 내보낼 수 있는 .octopus.md 목록. */
export function boardToMarkdownDocs(artifacts: Artifact[]): ExportedDoc[] {
  return artifacts.map(artifactToMarkdown).filter((d): d is ExportedDoc => d != null);
}
