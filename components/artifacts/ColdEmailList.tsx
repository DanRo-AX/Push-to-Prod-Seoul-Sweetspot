"use client";

// 콜드메일 아웃바운드 — 개인화 본문 + 팔로업 예약. VS Code 문서 idiom(.ide-doc-*).
// 메일별 섹션: 회사/수신자 헤더 + 키-값(받는사람·팔로업·제목) + 본문 인셋(개인화 하이라이트).
import type { ReactNode } from "react";
import type { ColdEmail } from "@/lib/types";

// 본문 안의 수신 회사명을 하이라이트해서 "개인화된 메일"임이 드러나게 한다
function highlightPersonalization(body: string, company: string): ReactNode[] {
  if (!company) return [body];
  const parts = body.split(company);
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (i > 0) {
      nodes.push(
        <mark
          key={`m-${i}`}
          className="rounded bg-[var(--ok-dim)] px-1 font-semibold text-[var(--ok)]"
        >
          {company}
        </mark>
      );
    }
    nodes.push(part);
  });
  return nodes;
}

export function ColdEmailList({ emails }: { emails: ColdEmail[] }) {
  return (
    <div className="ide-doc-in">
      {/* 문서 헤더 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-mail" aria-hidden />
        <span className="ide-doc-head-title">콜드메일 초안</span>
        <span className="ide-doc-head-meta">{emails.length}건</span>
      </div>

      {/* 범례 — 초록 표시 = 개인화 부분 */}
      <p className="mb-1 text-[12px] text-[var(--text-3)]">
        <mark className="rounded bg-[var(--ok-dim)] px-1 font-semibold text-[var(--ok)]">
          초록 표시
        </mark>{" "}
        = 수신사별 개인화 부분
      </p>

      {/* 메일별 섹션 */}
      {emails.map((email, i) => (
        <section key={i} className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-organization" aria-hidden />
            <span className="min-w-0 truncate normal-case tracking-normal text-[var(--text-1)]">
              {email.company}
            </span>
            <span className="ide-doc-section-meta">
              <span className="ide-doc-pill ide-doc-pill--warn">
                <i className="codicon codicon-history" aria-hidden />
                팔로업 D+{email.followUpInDays}
              </span>
            </span>
          </div>

          {/* 메일 헤더 키-값 */}
          <div className="ide-doc-kv">
            <span className="ide-doc-kv-key">받는사람</span>
            <span className="ide-doc-kv-val">{email.to}</span>
          </div>
          <div className="ide-doc-kv">
            <span className="ide-doc-kv-key">제목</span>
            <span className="ide-doc-kv-val ide-doc-kv-val--text font-semibold text-[var(--text-1)]">
              {email.subject}
            </span>
          </div>

          {/* 본문 — 개인화(회사명) 하이라이트, 인셋 면 */}
          <div className="ide-doc-callout mt-2.5">
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-2)]">
              {highlightPersonalization(email.bodyText, email.company)}
            </p>
          </div>
        </section>
      ))}

      {/* 안전장치 안내 — 조용한 풋노트 */}
      <p className="ide-doc-section mt-3 flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
        <i className="codicon codicon-shield" aria-hidden style={{ fontSize: 13 }} />
        모든 발송은 화이트리스트 검증 + 사람의 승인 후에만 실행됩니다
      </p>
    </div>
  );
}
