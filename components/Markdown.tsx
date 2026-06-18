"use client";

// components/Markdown.tsx — 의존성 없는 경량 마크다운 렌더러.
//
// 에이전트 답변 텍스트에 섞여 오는 서식을 깨짐 없이 렌더한다:
//   **굵게** / __굵게__, *기울임* / _기울임_, `인라인코드`, [링크](url),
//   #·##·###·#### 제목, 1.·1) 순서목록, -·*·• 글머리목록, 삼중백틱 코드펜스,
//   그리고 ⚠️🟢 같은 이모지(그대로 통과). 외부 라이브러리 금지(데모 안정성).
//
// 견고성 원칙:
//  · 스트리밍 도중 닫히지 않은 ** / ` 는 강조로 승격하지 않고 그대로 글자로
//    흘린다 — 마커가 잠깐 보일 뿐, 레이아웃이 튀지 않는다(닫는 짝 도착 시 승격).
//  · 모든 본문에 overflow-wrap/word-break 를 걸어 좁은 챗 폭에서 가로 넘침 0
//    (격자/그리드 깨짐 방지). 들여쓰기는 padding 으로만(margin 넘침 금지).
//  · 코드펜스는 renderCode(있으면)로 위임 — IDE 챗은 복사 버튼 달린 블록을 넘긴다.
//    없으면 단순 <pre> 폴백.

import { useMemo, type ReactNode } from "react";

// ── 블록 모델 ────────────────────────────────────────────────────────
type Block =
  | { t: "code"; lang: string; code: string }
  | { t: "h"; level: number; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; start: number; items: string[] }
  | { t: "p"; text: string } // text 는 소프트 개행(\n) 포함 가능
  | { t: "hr" };

// 줄 분류용 정규식(여러 곳에서 공유).
const RE_H = /^(#{1,4})\s+(.*)$/;
const RE_UL = /^\s*[-*•·]\s+/;
const RE_OL_HEAD = /^\s*(\d+)[.)]\s+/;
const RE_OL = /^\s*\d+[.)]\s+/;
const RE_HR = /^\s*([-*_])\1{2,}\s*$/;
const RE_BLANK = /^\s*$/;

/** 삼중백틱 코드펜스를 기준으로 입력을 text/code 청크로 가른다(미닫힘도 코드로). */
function splitFences(input: string): Array<{ kind: "text" | "code"; lang?: string; text: string }> {
  const out: Array<{ kind: "text" | "code"; lang?: string; text: string }> = [];
  const fence = /(^|\n)```([^\n`]*)\n?([\s\S]*?)(?:\n```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(input)) !== null) {
    const lead = m[1];
    const start = m.index + lead.length;
    if (start > last) out.push({ kind: "text", text: input.slice(last, start) });
    out.push({ kind: "code", lang: m[2].trim(), text: m[3].replace(/\n$/, "") });
    last = fence.lastIndex;
  }
  if (last < input.length) out.push({ kind: "text", text: input.slice(last) });
  return out;
}

/** 텍스트 청크(코드펜스 제외)를 블록 단위로 묶는다. */
function parseTextBlocks(chunk: string, push: (b: Block) => void): void {
  const lines = chunk.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (RE_BLANK.test(line)) {
      i++;
      continue;
    }

    const hm = RE_H.exec(line);
    if (hm) {
      push({ t: "h", level: hm[1].length, text: hm[2] });
      i++;
      continue;
    }

    if (RE_HR.test(line)) {
      push({ t: "hr" });
      i++;
      continue;
    }

    if (RE_UL.test(line)) {
      const items: string[] = [];
      while (i < lines.length && RE_UL.test(lines[i])) {
        items.push(lines[i].replace(RE_UL, ""));
        i++;
      }
      push({ t: "ul", items });
      continue;
    }

    const om = RE_OL_HEAD.exec(line);
    if (om) {
      const start = parseInt(om[1], 10) || 1;
      const items: string[] = [];
      while (i < lines.length && RE_OL.test(lines[i])) {
        items.push(lines[i].replace(RE_OL, ""));
        i++;
      }
      push({ t: "ol", start, items });
      continue;
    }

    // 단락 — 다음 특수 줄/빈 줄 전까지 모은다(소프트 개행 보존).
    const para: string[] = [];
    while (
      i < lines.length &&
      !RE_BLANK.test(lines[i]) &&
      !RE_H.test(lines[i]) &&
      !RE_UL.test(lines[i]) &&
      !RE_OL.test(lines[i]) &&
      !RE_HR.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    push({ t: "p", text: para.join("\n") });
  }
}

function parseBlocks(input: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of splitFences(input)) {
    if (chunk.kind === "code") {
      blocks.push({ t: "code", lang: chunk.lang ?? "", code: chunk.text });
    } else {
      parseTextBlocks(chunk.text, (b) => blocks.push(b));
    }
  }
  return blocks;
}

// ── 인라인 토크나이저 ────────────────────────────────────────────────
// 왼→오 한 글자씩 스캔하며 가장 앞선 토큰을 잘라낸다. 닫는 짝이 없는 마커는
// 그냥 buf 로 흘려(글자로 출력) 스트리밍 중에도 안정적이다.
function inline(text: string, kb: string): ReactNode[] {
  const out: ReactNode[] = [];
  let buf = "";
  let n = 0;
  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpExecArray | null;

    // `인라인 코드`
    if ((m = /^`([^`\n]+)`/.exec(rest))) {
      flush();
      out.push(
        <code key={`${kb}c${n++}`} className="chat-inline-code">
          {m[1]}
        </code>,
      );
      i += m[0].length;
      continue;
    }

    // **굵게** / __굵게__
    if ((m = /^\*\*([^\n]+?)\*\*/.exec(rest)) || (m = /^__([^\n]+?)__/.exec(rest))) {
      flush();
      out.push(<strong key={`${kb}b${n++}`}>{inline(m[1], `${kb}b${n}`)}</strong>);
      i += m[0].length;
      continue;
    }

    // [텍스트](url) — http(s)·루트상대(/...)·앵커(#...)만 허용.
    if ((m = /^\[([^\]\n]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*|#[^)\s]*)\)/.exec(rest))) {
      flush();
      out.push(
        <a
          key={`${kb}l${n++}`}
          className="chat-md-link"
          href={m[2]}
          target="_blank"
          rel="noreferrer noopener"
        >
          {m[1]}
        </a>,
      );
      i += m[0].length;
      continue;
    }

    // *기울임* / _기울임_ (단일 구분자, 안쪽에 구분자/개행 없음)
    if ((m = /^\*([^*\s][^*\n]*?)\*/.exec(rest)) || (m = /^_([^_\s][^_\n]*?)_/.exec(rest))) {
      flush();
      out.push(<em key={`${kb}i${n++}`}>{inline(m[1], `${kb}i${n}`)}</em>);
      i += m[0].length;
      continue;
    }

    buf += text[i];
    i++;
  }
  flush();
  return out;
}

/** 단락 내부 — 소프트 개행(\n)을 <br/> 로, 각 줄은 인라인 렌더. */
function paragraphNodes(text: string, kb: string): ReactNode[] {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  lines.forEach((ln, j) => {
    if (j > 0) out.push(<br key={`${kb}br${j}`} />);
    out.push(...inline(ln, `${kb}-${j}`));
  });
  return out;
}

export interface MarkdownProps {
  text: string;
  /** 코드펜스 렌더 위임(있으면). 없으면 단순 <pre> 폴백. */
  renderCode?: (lang: string, code: string) => ReactNode;
  /** 추가 클래스(루트 래퍼). */
  className?: string;
}

/**
 * 경량 마크다운 렌더 — 블록(제목/목록/단락/코드/구분선) + 인라인(굵게/기울임/코드/링크).
 * 색/타이포는 사용처 스코프(예: .ide .chat-body)의 토큰을 따른다.
 */
export function Markdown({ text, renderCode, className }: MarkdownProps) {
  const blocks = useMemo(() => parseBlocks(text), [text]);

  return (
    <div className={`chat-md${className ? ` ${className}` : ""}`}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "code":
            return renderCode ? (
              <div key={i}>{renderCode(b.lang, b.code)}</div>
            ) : (
              <pre key={i} className="chat-md-pre">
                <code>{b.code}</code>
              </pre>
            );
          case "h":
            return (
              <div key={i} className={`chat-md-h chat-md-h${b.level}`}>
                {inline(b.text, `h${i}`)}
              </div>
            );
          case "ul":
            return (
              <ul key={i} className="chat-md-ul">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `u${i}-${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="chat-md-ol" start={b.start}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `o${i}-${j}`)}</li>
                ))}
              </ol>
            );
          case "hr":
            return <hr key={i} className="chat-md-hr" />;
          case "p":
            return (
              <p key={i} className="chat-md-p">
                {paragraphNodes(b.text, `p${i}`)}
              </p>
            );
        }
      })}
    </div>
  );
}
