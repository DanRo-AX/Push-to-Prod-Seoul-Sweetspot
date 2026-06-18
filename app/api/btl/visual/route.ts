// POST /api/btl/visual — 콘텐츠 카드의 '비주얼 생성' 단계(콘텐츠 루프의 끝).
//
// 다듬은 콘텐츠(after)를 Higgsfield 로 실제 이미지/영상으로 만든다. 토큰 미연결/실패면 오프라인
// 안전한 목업 SVG 로 폴백(데모는 항상 무언가 보인다). 발행/예약은 하지 않는다(별도 승인 게이트).
//
// body(JSON): { prompt: string, aspect?: "1:1"|"4:5"|"9:16"|"16:9" }
// 응답: { url, mock: boolean, note? }

import { generateViaHiggsfield } from "@/lib/agent/higgsfield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mockVisual(prompt: string, aspect: string): string {
  const { w, h } =
    aspect === "9:16" ? { w: 720, h: 1280 }
      : aspect === "16:9" ? { w: 1280, h: 720 }
        : aspect === "4:5" ? { w: 1080, h: 1350 }
          : { w: 1000, h: 1000 };
  const short = prompt.length > 48 ? `${prompt.slice(0, 47)}…` : prompt;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2a2e"/><stop offset="1" stop-color="#0f0f12"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<text x="50%" y="46%" fill="#d9472a" font-family="sans-serif" font-size="${Math.round(w * 0.06)}" font-weight="700" text-anchor="middle">AI 비주얼 · 목업</text>` +
    `<text x="50%" y="54%" fill="#9a9a9a" font-family="sans-serif" font-size="${Math.round(w * 0.032)}" text-anchor="middle">${esc(short)}</text>` +
    `<text x="50%" y="92%" fill="#6a6a6a" font-family="sans-serif" font-size="${Math.round(w * 0.026)}" text-anchor="middle">Higgsfield 미연결 — 설정에서 키 입력 시 실제 생성</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function POST(req: Request) {
  let body: { prompt?: string; aspect?: string };
  try { body = (await req.json()) as typeof body; }
  catch { return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 }); }

  const prompt = String(body.prompt || "").trim();
  if (!prompt) return Response.json({ error: "비주얼 프롬프트가 필요합니다." }, { status: 400 });
  const aspect = body.aspect ?? "4:5";

  try {
    const url = await generateViaHiggsfield({ prompt, aspect });
    return Response.json({ url, mock: false });
  } catch (err) {
    return Response.json({
      url: mockVisual(prompt, aspect),
      mock: true,
      note: `Higgsfield 미연결/실패 — 목업으로 표시합니다 (${err instanceof Error ? err.message : "오류"}). 설정에서 계정을 연결하면 실제 생성됩니다.`,
    });
  }
}
