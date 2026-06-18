// 한국 카드뉴스(ENTRID 풍) 비주얼 렌더러 — 서버 전용.
// Higgsfield 가 만든 배경 사진 위에 한글 텍스트(워드마크/헤드라인/하이라이트 서브)를
// 픽셀 단위로 정확히 합성한다. 이미지 모델은 큰 한글을 정확히 못 박으므로 텍스트는 코드로 얹는다.
// 래스터는 새 npm 의존성 없이 로컬 Chrome 헤드리스(--screenshot)로 HTML→PNG.
//
// 보안: 배경 URL 은 공개 http(s)만 허용(로컬/사설 차단). 폰트는 Pretendard Black 을 1회 받아 캐시.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);
const CHROME_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PRETENDARD_URL =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/woff2/Pretendard-Black.woff2";

export type CardFormat = "feed" | "reel"; // feed=1080x1350(4:5), reel=1080x1920(9:16)

export interface CardSpec {
  bgImageUrl: string; // 배경 사진 (공개 http(s))
  wordmark?: string; // 상단 브랜드 워드마크 (예: ENTRID)
  headline: string; // 큰 헤드라인 (\n 으로 줄바꿈)
  sub?: string; // 형광펜 하이라이트 서브라인
  badge?: string; // 코너 뱃지 (예: 1/5)
  format?: CardFormat;
  showChevron?: boolean; // 캐러셀 > 인디케이터
}

// 폰트는 1회만 받아 data-URI 로 캐시 (Chrome 렌더 시 네트워크 타이밍 의존 제거).
let fontCache: string | null = null;
async function pretendardDataUri(): Promise<string | null> {
  if (fontCache !== null) return fontCache || null;
  try {
    const res = await fetch(PRETENDARD_URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      fontCache = "";
      return null;
    }
    fontCache = `data:font/woff2;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    return fontCache;
  } catch {
    fontCache = "";
    return null;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isPublicHttp(u: string): boolean {
  try {
    const p = new URL(u);
    if (p.protocol !== "http:" && p.protocol !== "https:") return false;
    const h = p.hostname.toLowerCase();
    return !(
      h === "localhost" ||
      h.endsWith(".localhost") ||
      /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    );
  } catch {
    return false;
  }
}

async function bgDataUri(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`BG_FETCH_FAILED (HTTP ${res.status})`);
  const ct = res.headers.get("content-type") || "image/png";
  return `data:${ct};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

function buildHtml(
  spec: CardSpec,
  bg: string,
  font: string | null,
  w: number,
  h: number,
): string {
  const headlineHtml = esc(spec.headline)
    .split("\n")
    .map((l) => l || "&nbsp;")
    .join("<br>");
  const fontFace = font
    ? `@font-face{font-family:'PRD';font-weight:900;src:url('${font}') format('woff2');}`
    : "";
  const fam = font ? `'PRD',` : "";
  const r = (x: number) => Math.round(x);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFace}
*{margin:0;box-sizing:border-box}
.card{width:${w}px;height:${h}px;position:relative;overflow:hidden;background:#222;font-family:${fam}'Apple SD Gothic Neo',sans-serif}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.86) 0%,rgba(0,0,0,.55) 30%,rgba(0,0,0,0) 54%)}
.wm{position:absolute;top:${r(h * 0.034)}px;left:0;right:0;text-align:center;color:#fff;font-family:Georgia,serif;font-weight:700;letter-spacing:.3em;font-size:${r(w * 0.028)}px;text-indent:.3em}
.badge{position:absolute;top:${r(h * 0.03)}px;right:${r(w * 0.037)}px;height:${r(w * 0.05)}px;padding:0 ${r(w * 0.012)}px;border:3px solid rgba(255,255,255,.9);border-radius:999px;color:#fff;font-weight:900;font-size:${r(w * 0.02)}px;display:flex;align-items:center;justify-content:center}
.h{position:absolute;left:${r(w * 0.052)}px;right:${r(w * 0.052)}px;bottom:${r(h * 0.135)}px;color:#fff;font-weight:900;font-size:${r(w * 0.108)}px;line-height:1.05;letter-spacing:-.03em;text-shadow:0 3px 22px rgba(0,0,0,.45)}
.sub{position:absolute;left:${r(w * 0.052)}px;bottom:${r(h * 0.077)}px;font-weight:900;font-size:${r(w * 0.031)}px;color:#141414;background:#f3e3a8;padding:7px 13px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.chev{position:absolute;right:${r(w * 0.03)}px;top:50%;transform:translateY(-50%);width:${r(w * 0.043)}px;height:${r(w * 0.043)}px;border-radius:50%;background:rgba(255,255,255,.92);color:#111;font-weight:900;font-size:${r(w * 0.024)}px;display:flex;align-items:center;justify-content:center}
</style></head><body><div class="card">
<img class="bg" src="${bg}">
<div class="grad"></div>
${spec.wordmark ? `<div class="wm">${esc(spec.wordmark)}</div>` : ""}
${spec.badge ? `<div class="badge">${esc(spec.badge)}</div>` : ""}
<div class="h">${headlineHtml}</div>
${spec.sub ? `<div class="sub">${esc(spec.sub)}</div>` : ""}
${spec.showChevron ? `<div class="chev">&#8250;</div>` : ""}
</div></body></html>`;
}

/**
 * ENTRID 풍 카드 1장 합성 → PNG 버퍼. 실패 시 throw(호출처가 원본 폴백).
 */
export async function renderCard(spec: CardSpec): Promise<Buffer> {
  if (!isPublicHttp(spec.bgImageUrl)) throw new Error("BG_URL_NOT_PUBLIC");
  const [w, h] = spec.format === "reel" ? [1080, 1920] : [1080, 1350];
  const [bg, font] = await Promise.all([
    bgDataUri(spec.bgImageUrl),
    pretendardDataUri(),
  ]);
  const html = buildHtml(spec, bg, font, w, h);
  const dir = await mkdtemp(join(tmpdir(), "octo-card-"));
  try {
    const htmlPath = join(dir, "card.html");
    const pngPath = join(dir, "card.png");
    await writeFile(htmlPath, html, "utf8");
    await execFileAsync(
      CHROME_PATH,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        `--window-size=${w},${h}`,
        `--screenshot=${pngPath}`,
        `file://${htmlPath}`,
      ],
      { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 },
    );
    return await readFile(pngPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
