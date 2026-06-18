"use client";

// 뉴스레터 미리보기 — 이메일 클라이언트 프레임 + 미니 마크다운 렌더러 (외부 라이브러리 없음)
// VS Code 문서 idiom(.ide-doc-*): 메타 키-값 + 제목 A/B 테이블 + 다크 이메일 프레임 + 구조 메타 pill.
// 하위호환 가드: 신규 구조 필드가 없는 구 초안(리플레이 sample.jsonl)도 깨지지 않고 렌더한다.
import type { ReactNode } from "react";
import type {
  NewsletterPreviewProps,
  SubjectVariant,
  NewsletterDraft,
} from "@/lib/types";
import { Logo } from "@/components/Logo";

const MONO = "font-[family-name:var(--ide-mono,var(--font-geist-mono))]";

// ── 라벨/색 매핑 (방법론 라벨 — 한국어) ──
const ANGLE_LABELS: Record<SubjectVariant["angle"], string> = {
  curiosity: "호기심",
  urgency: "긴급성",
  personalization: "개인화",
  social_proof: "사회적 증거",
  direct_benefit: "직접 혜택",
};

const FRAMEWORK_LABELS: Record<NonNullable<NewsletterDraft["framework"]>, string> = {
  AIDA: "AIDA",
  PAS: "PAS",
  BAB: "BAB",
  curation: "큐레이션",
};

const GOAL_LABELS: Record<NewsletterDraft["cta"]["goal"], string> = {
  engagement: "참여",
  sales: "전환/판매",
  education: "정보 전달",
  community: "커뮤니티",
};

// 스팸 위험 점 색 (var() 토큰)
const SPAM_DOT: Record<SubjectVariant["spamRisk"], string> = {
  none: "var(--ok)",
  low: "var(--warn)",
  medium: "var(--warn)",
  high: "var(--danger)",
};
const SPAM_LABEL: Record<SubjectVariant["spamRisk"], string> = {
  none: "스팸 위험 없음",
  low: "스팸 위험 낮음",
  medium: "스팸 위험 보통",
  high: "스팸 위험 높음",
};

// 인라인 **굵게** 처리
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-[var(--text-1)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

// 블록 단위 미니 마크다운: #/##/### 제목, - 리스트, 빈 줄 = 문단 구분
function renderMarkdown(md: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={key++} className="my-2.5 flex flex-col gap-1.5 pl-1">
        {listBuffer.map((item, i) => (
          <li
            key={i}
            className="flex gap-2 text-[13px] leading-relaxed text-[var(--text-2)]"
          >
            <span className="mt-0.5 shrink-0 text-[var(--accent-bright)]">•</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuffer.push(line.slice(2));
      continue;
    }
    flushList();
    if (!line) continue;

    if (line.startsWith("### ")) {
      blocks.push(
        <h4
          key={key++}
          className="mb-1.5 mt-4 text-[14px] font-bold text-[var(--text-1)]"
        >
          {renderInline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h3
          key={key++}
          className="mb-2 mt-5 text-[16px] font-bold text-[var(--text-1)]"
        >
          {renderInline(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h2
          key={key++}
          className="mb-2.5 mt-2 text-[18px] font-bold text-[var(--text-1)]"
        >
          {renderInline(line.slice(2))}
        </h2>
      );
    } else {
      blocks.push(
        <p
          key={key++}
          className="my-2 text-[13px] leading-relaxed text-[var(--text-2)]"
        >
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();
  return blocks;
}

// ── 제목 A/B 후보 행 (신규 구조 필드가 있을 때만) ──
function SubjectVariantRow({ variant }: { variant: SubjectVariant }) {
  return (
    <tr>
      <td>
        <div className="flex items-start gap-2">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: SPAM_DOT[variant.spamRisk] }}
            title={SPAM_LABEL[variant.spamRisk]}
          />
          <div className="min-w-0">
            <span className="text-[13px] font-semibold leading-snug text-[var(--text-1)]">
              {variant.text}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="ide-doc-pill ide-doc-pill--accent">
                {ANGLE_LABELS[variant.angle]}
              </span>
              {variant.truncatedOnMobile && (
                <span className="ide-doc-pill ide-doc-pill--warn">모바일 잘림</span>
              )}
              {variant.spamFlags.length > 0 && (
                <span
                  className={`${MONO} text-[10px]`}
                  style={{ color: SPAM_DOT[variant.spamRisk] }}
                >
                  {variant.spamFlags.join(" · ")}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="ide-doc-td-num" style={{ width: 48 }}>
        {variant.charCount}자
      </td>
    </tr>
  );
}

export function NewsletterPreview({ draft }: NewsletterPreviewProps) {
  // 하위호환 가드 — 구 초안엔 이 필드들이 undefined 일 수 있다.
  const variants = draft.subjectVariants ?? [];
  const hasVariants = variants.length > 0;
  const hasFramework = typeof draft.framework === "string";
  const hasReadTime =
    typeof draft.estimatedReadSeconds === "number" &&
    draft.estimatedReadSeconds > 0;
  const toneFlags = draft.toneFlags ?? [];
  const hasStructuredMeta = hasFramework || hasReadTime || draft.cta != null;
  // 메일 메타 제목은 항상 채워지는 하위호환 subject 사용.
  const metaSubject = draft.subject ?? variants[0]?.text ?? "(제목 없음)";

  return (
    <div className="ide-doc-in">
      {/* 문서 헤더 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-mail" aria-hidden />
        <span className="ide-doc-head-title">뉴스레터 초안</span>
        <span className="ide-doc-head-meta">
          {draft.segment ? `${draft.segment} 세그먼트` : "구독자 전체"}
        </span>
      </div>

      {/* 운영 콘솔용 원문 점검 키-값 */}
      <div className="ide-doc-kv">
        <span className="ide-doc-kv-key">제목</span>
        <span className="ide-doc-kv-val">{metaSubject}</span>
      </div>
      <div className="ide-doc-kv">
        <span className="ide-doc-kv-key">프리헤더</span>
        <span className="ide-doc-kv-val">
          {draft.preheader}
          {typeof draft.preheaderCharCount === "number" && (
            <span className="ml-1.5 text-[var(--text-3)]">
              ({draft.preheaderCharCount}자)
            </span>
          )}
        </span>
      </div>

      {/* 제목 A/B 후보 — 신규 구조 필드가 있을 때만 (구 초안은 표시 안 함) */}
      {hasVariants && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-list-selection" aria-hidden />
            제목 A/B 후보
            <span className="ide-doc-section-meta">{variants.length}개</span>
          </div>
          <table className="ide-doc-table">
            <thead>
              <tr>
                <th>제목 · 앵글</th>
                <th className="ide-doc-td-num">글자수</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <SubjectVariantRow key={`${v.text}-${i}`} variant={v} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 이메일 클라이언트 프레임 — VS Code 다크 톤 문서 프레임 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-preview" aria-hidden />
          받은편지함 미리보기
        </div>
        <div className="overflow-hidden rounded-md border border-[var(--line-1)] bg-[var(--bg-1)]">
          {/* 이메일 클라이언트 창 헤더 — VS Code 타이틀바 톤 */}
          <div className="flex items-center gap-2 border-b border-[var(--line-1)] bg-[var(--bg-2)] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--warn)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--ok)]" />
            <span className={`${MONO} ml-3 text-[11px] text-[var(--text-3)]`}>
              새 메시지 — 초안
            </span>
          </div>

          {/* 메일 메타 정보 */}
          <div className="border-b border-[var(--line-1)] px-5 py-4">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line-1)] bg-[var(--bg-2)] text-[var(--accent-bright)]">
                <Logo withWordmark={false} className="text-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-1)]">
                  octopus{" "}
                  <span className="font-normal text-[var(--text-3)]">
                    &lt;agent@octopus.marketing&gt;
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-3)]">
                  받는사람:{" "}
                  {draft.segment ? `${draft.segment} 세그먼트` : "뉴스레터 구독자 전체"}
                </div>
              </div>
            </div>
            <h2 className="mt-2 text-[18px] font-bold leading-snug text-[var(--text-1)]">
              {metaSubject}
            </h2>
            {/* 프리헤더 — 받은편지함 미리보기 텍스트 */}
            <p className="mt-1 text-[12px] italic text-[var(--text-3)]">
              {draft.preheader}
              <span className="ml-2 rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] not-italic text-[var(--text-2)]">
                프리헤더
              </span>
            </p>
          </div>

          {/* 본문 — 미니 마크다운 렌더 (하위호환 bodyMarkdown 합성본) */}
          <div className="bg-[var(--bg-0)] px-5 py-4">
            {renderMarkdown(draft.bodyMarkdown ?? "")}
          </div>

          <div className="border-t border-[var(--line-1)] px-5 py-2.5 text-center">
            <span className="text-[11px] text-[var(--text-3)]">
              초안 미리보기 — 발송 전 사람의 검토를 거칩니다
            </span>
          </div>
        </div>
      </section>

      {/* 구조 메타 — 프레임워크 · 예상 읽기시간 · CTA 목표 · 톤 플래그 (신규 필드가 있을 때만) */}
      {hasStructuredMeta && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-settings-gear" aria-hidden />
            구조 메타
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasFramework && draft.framework && (
              <span className="ide-doc-pill">
                프레임워크 {FRAMEWORK_LABELS[draft.framework]}
              </span>
            )}
            {hasReadTime && (
              <span className="ide-doc-pill num">
                예상 읽기 {draft.estimatedReadSeconds}초
              </span>
            )}
            {draft.cta && (
              <span className="ide-doc-pill ide-doc-pill--accent">
                CTA · {GOAL_LABELS[draft.cta.goal]} · {draft.cta.label}
              </span>
            )}
            {/* 톤 플래그 — 비어 있으면 "톤 통과", 있으면 경고 칩 */}
            {toneFlags.length === 0 ? (
              <span className="ide-doc-pill ide-doc-pill--ok ml-auto">
                <CheckIcon />톤 통과
              </span>
            ) : (
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                {toneFlags.map((flag, i) => (
                  <span key={`${flag}-${i}`} className="ide-doc-pill ide-doc-pill--warn">
                    {flag}
                  </span>
                ))}
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// 톤 통과 체크 — 인라인 SVG (이모지 금지)
function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
      <path
        d="M2.5 6.5 L5 9 L9.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
