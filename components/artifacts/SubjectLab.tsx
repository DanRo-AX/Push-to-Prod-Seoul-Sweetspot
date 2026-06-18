"use client";

// 제목 A/B 랩 — optimize_subject_lines 아티팩트 렌더러.
// VS Code 문서 idiom(.ide-doc-*): 주제/추천 A/B callout + 스코어링 테이블
// (제목 · angle · 글자수 · 모바일잘림 · 스팸위험 · 상대 오픈 게이지). 수치는 도구 계산값 인용.
import type { SubjectLabReport, SubjectScoreRow, SubjectVariant } from "@/lib/types";

const ANGLE_LABELS: Record<SubjectVariant["angle"], string> = {
  curiosity: "호기심",
  urgency: "긴급성",
  personalization: "개인화",
  social_proof: "사회적 증거",
  direct_benefit: "직접 혜택",
};

const SPAM_STYLE: Record<
  SubjectVariant["spamRisk"],
  { label: string; pill: string; bar: string }
> = {
  none: { label: "없음", pill: "ide-doc-pill--ok", bar: "var(--ok)" },
  low: { label: "낮음", pill: "ide-doc-pill--warn", bar: "var(--warn)" },
  medium: { label: "보통", pill: "ide-doc-pill--warn", bar: "var(--warn)" },
  high: { label: "높음", pill: "ide-doc-pill--danger", bar: "var(--danger)" },
};

const GOAL_LABEL: Record<SubjectLabReport["goal"], string> = {
  open: "오픈율",
  click: "클릭률",
};

// 상대 오픈 점수 게이지 — 막대 색은 점수 구간(딥그린/오커/브릭)
function openColor(score: number): string {
  return score >= 70 ? "var(--ok)" : score >= 45 ? "var(--warn)" : "var(--danger)";
}

function ScoreCell({
  row,
  goal,
  isRecommended,
}: {
  row: SubjectScoreRow;
  goal: SubjectLabReport["goal"];
  isRecommended: boolean;
}) {
  const spam = SPAM_STYLE[row.spamRisk];
  const clamped = Math.min(100, Math.max(0, row.projectedOpenScore));
  const color = openColor(clamped);
  return (
    <tr>
      {/* 제목 + 메타 칩 */}
      <td>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold leading-snug text-[var(--text-1)]">
            {row.text}
          </span>
          {isRecommended && (
            <span className="ide-doc-pill ide-doc-pill--accent shrink-0">A/B</span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="ide-doc-pill ide-doc-pill--accent">
            {ANGLE_LABELS[row.angle]}
          </span>
          <span className="ide-doc-pill num">{row.charCount}자</span>
          {row.truncatedOnMobile && (
            <span className="ide-doc-pill ide-doc-pill--warn">
              <i className="codicon codicon-device-mobile" aria-hidden />
              모바일 잘림
            </span>
          )}
          <span className={`ide-doc-pill ${spam.pill}`}>스팸 {spam.label}</span>
          {row.spamFlags.length > 0 && (
            <span
              className="font-[family-name:var(--ide-mono,var(--font-geist-mono))] text-[10px]"
              style={{ color: spam.bar }}
            >
              {row.spamFlags.join(" · ")}
            </span>
          )}
        </div>
      </td>
      {/* 상대 오픈 점수 + 게이지 */}
      <td className="ide-doc-td-num" style={{ width: 120 }}>
        <div className="num text-[18px] font-bold leading-none" style={{ color }}>
          {clamped}
        </div>
        <div className="mt-1 ml-auto h-1.5 w-full max-w-[88px] overflow-hidden rounded-full bg-[var(--bg-inset)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(2, clamped)}%`, background: color }}
          />
        </div>
        <div className="mt-1 font-[family-name:var(--ide-mono,var(--font-geist-mono))] text-[9px] tracking-[0.04em] text-[var(--text-3)]">
          상대 {GOAL_LABEL[goal]}
        </div>
      </td>
    </tr>
  );
}

export function SubjectLab({ lab }: { lab: SubjectLabReport }) {
  const rows = lab.rows ?? [];
  const recommended = new Set(lab.recommended ?? []);

  return (
    <div className="ide-doc-in">
      {/* 문서 헤더 + 목표 메타 */}
      <div className="ide-doc-head">
        <i className="codicon codicon-beaker" aria-hidden />
        <span className="ide-doc-head-title">제목 A/B 랩</span>
        <span className="ide-doc-head-meta">최적화 목표 · {GOAL_LABEL[lab.goal]}</span>
      </div>

      {/* 주제 callout */}
      {lab.topic && (
        <div className="ide-doc-callout flex gap-2">
          <i className="codicon codicon-symbol-keyword shrink-0" aria-hidden style={{ marginTop: 2 }} />
          <span>
            <span className="mr-2 font-[family-name:var(--ide-mono,var(--font-geist-mono))] text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-3)]">
              주제
            </span>
            {lab.topic}
          </span>
        </div>
      )}

      {/* 추천 A/B callout */}
      {recommended.size > 0 && (
        <section className="ide-doc-section">
          <div className="ide-doc-section-head">
            <i className="codicon codicon-pass" aria-hidden />
            A/B 로 테스트할 제목
          </div>
          <div className="ide-doc-callout">
            <ul className="flex flex-col gap-1.5">
              {[...recommended].map((t, i) => (
                <li
                  key={`${t}-${i}`}
                  className="flex gap-2 text-[13px] font-semibold leading-snug text-[var(--text-1)]"
                >
                  <span className="num shrink-0 text-[var(--accent-bright)]">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 스코어링 테이블 — projectedOpenScore 내림차순 */}
      <section className="ide-doc-section">
        <div className="ide-doc-section-head">
          <i className="codicon codicon-graph" aria-hidden />
          제목 스코어링
          <span className="ide-doc-section-meta">상대 점수 내림차순 · {rows.length}개</span>
        </div>
        {rows.length === 0 ? (
          <div className="ide-doc-callout">아직 생성된 제목 후보가 없습니다.</div>
        ) : (
          <table className="ide-doc-table">
            <thead>
              <tr>
                <th>제목 · 메타</th>
                <th className="ide-doc-td-num">상대 {GOAL_LABEL[lab.goal]}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <ScoreCell
                  key={`${row.text}-${i}`}
                  row={row}
                  goal={lab.goal}
                  isRecommended={recommended.has(row.text)}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 정직성 라벨 */}
      {lab.note && (
        <p className="ide-doc-section mt-3 flex items-center gap-1.5 text-[11px] font-medium leading-relaxed text-[var(--warn)]">
          <i className="codicon codicon-info" aria-hidden style={{ fontSize: 13 }} />
          {lab.note}
        </p>
      )}
    </div>
  );
}
