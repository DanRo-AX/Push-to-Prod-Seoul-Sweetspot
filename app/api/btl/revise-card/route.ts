// POST /api/btl/revise-card — 방문객 군집 코멘트(드래그→discuss)를 '반영해' 산출물을 수정한다.
//
// 드래그로 받은 의견(채팅 코멘트)을 실제 수정으로 잇는 루프. 코멘트가 지적한 지점을 고쳐 다시 쓴다.
// 최종본 아님 — 'AI 수정본 · 검토 필요'. 사람만 가능한 것은 [사람 확인 필요] 유지(거짓 채움 금지).
//
// body(JSON): { content: string, comments: string[], reviewPoints?: string[], label?: string }
// 응답: { markdown } 또는 { error }

import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/runtime-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";

export async function POST(req: Request) {
  const apiKey = getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) return Response.json({ error: "Anthropic API 키가 설정되지 않았습니다." }, { status: 400 });

  let body: { content?: string; comments?: string[]; reviewPoints?: string[]; label?: string };
  try { body = (await req.json()) as typeof body; }
  catch { return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 }); }

  const content = String(body.content || "").trim();
  if (!content) return Response.json({ error: "수정할 산출물 내용이 없습니다." }, { status: 400 });
  const comments = (body.comments ?? []).filter((c) => c?.trim());
  if (comments.length === 0) return Response.json({ error: "반영할 코멘트가 없습니다(먼저 군집을 끌어다 의견을 받으세요)." }, { status: 400 });
  const label = body.label || "산출물";
  const rpBlock = body.reviewPoints?.length
    ? `\n\n## 검토 포인트(이걸 기준으로 좋아졌는지 확인)\n${body.reviewPoints.map((p) => `- ${p}`).join("\n")}`
    : "";

  const system = `너는 BTL(팝업) 실무 기획자다. 첨부된 '${label}'을 아래 '방문객 군집 코멘트'를 반영해 수정한다.
규칙:
- 코멘트가 지적한 지점을 '실제로' 고친다(두루뭉술 금지 — 해당 항목을 바꿔라).
- 원본의 좋은 부분·구조는 유지하고, 지적된 곳만 개선한다. 전체를 다시 쓰되 형식(마크다운)은 같게.
- 최종본이 아니라 'AI 수정본' — 머리말에 "> AI 수정본 · 검토 필요"를 넣는다.
- 사람만 가능한 것(실제 작가·대관·확정 단가)은 지어내지 말고 「[사람 확인 필요]」 유지.
- 마크다운 본문만 출력(설명·인사 없이).${rpBlock}`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system,
      messages: [{
        role: "user",
        content: `## 방문객 군집 코멘트(반영 대상)\n${comments.map((c) => `- ${c}`).join("\n")}\n\n## 현재 '${label}'\n${content}`,
      }],
    });
    const md = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    if (!md) return Response.json({ error: "수정본을 생성하지 못했습니다." }, { status: 502 });
    return Response.json({ markdown: md });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "수정 실패" }, { status: 500 });
  }
}
