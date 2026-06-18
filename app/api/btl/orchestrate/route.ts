// POST /api/btl/orchestrate — 채팅 오케스트레이터. 사용자 메시지를 보드 동작(op)으로 옮긴다.
//
// 철학: 업무툴 + 자동화 한 몸. 채팅이 손으로 하는 동작을 대신 호출한다. 파일 업로드/추출은
// 사람 제스처라 AI 가 못 함 → 보드에 이미 있는 것만 오케스트레이션, 없으면 reply 로 요청.
// body(JSON): { message, cards: [{slot, kind, title, hasFile}] }
// 응답(JSON): { reply, ops: BoardOp[] }

import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/runtime-settings";
import { OASIS } from "@/lib/oasis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";

export async function POST(req: Request) {
  const apiKey = getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) return Response.json({ error: "Anthropic API 키가 설정되지 않았습니다." }, { status: 400 });

  let body: { message?: string; cards?: { slot?: string; kind?: string; title?: string; hasFile?: boolean }[] };
  try { body = (await req.json()) as typeof body; }
  catch { return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 }); }

  const message = (body.message ?? "").trim();
  if (!message) return Response.json({ error: "message 가 필요합니다." }, { status: 400 });
  const cards = body.cards ?? [];

  const boardSummary = cards.length
    ? cards.map((c) => `- ${c.title}(slot=${c.slot}, kind=${c.kind}${c.hasFile ? ", 파일있음" : ""})`).join("\n")
    : "(보드 비어 있음)";
  const segs = OASIS.archetypes.map((a) => `${a.type}=${a.label}`).join(", ");

  const tool: Anthropic.Tool = {
    name: "emit_plan",
    description: "사용자 요청을 reply 와 보드 동작(ops) 으로 변환한다.",
    input_schema: {
      type: "object",
      properties: {
        reply: { type: "string", description: "채팅에 보일 한국어 답 1~2문장(무엇을 했는지/요청)." },
        ops: {
          type: "array",
          description: "실행할 보드 동작들(순서대로). 없으면 빈 배열.",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["add_card", "draft_card", "draft_all", "revise_card", "persona_feedback", "none"] },
              slot: { type: "string", description: "add_card/draft_card/revise_card 용 — rfp/proposal/quote/operation/content" },
              types: { type: "array", items: { type: "string" }, description: "persona_feedback 용 군집(P1~P5). 생략 시 전체." },
              content: { type: "string", description: "persona_feedback 용 — 사용자가 메시지에 콘텐츠를 직접 줬으면 그 텍스트." },
            },
            required: ["op"],
          },
        },
      },
      required: ["reply", "ops"],
    },
  };

  const system = `너는 octopus 오케스트레이터다. 사용자의 자연어 요청을 '보드 동작(op)'으로 옮긴다.
이 제품은 업무툴 + 자동화가 한 몸 — 채팅은 손으로 하는 동작을 대신 호출한다.

동작 방식: octopus는 RFP 기반으로 산출물 '초안(before)'을 써줄 수 있다. 단 초안일 뿐 — 이후 방문객
군집이 깎고(검토 포인트), 사람이 확정한다. 초안엔 사람만 가능한 것(실제 작가·대관·확정 단가)이
[사람 확인 필요]로 비워진다. '최종본/제출본을 만들었다'고는 말하지 마라(초안이다).

가능한 op:
- add_card{slot}: 보드에 빈 카드만 추가. slot ∈ rfp·proposal·quote·operation·content.
- draft_card{slot}: RFP 기반 AI 초안으로 그 카드를 채운다(before). "기획안 짜줘/써줘" → draft_card{proposal}.
  보드에 RFP(btl_rfp)가 있을 때만. 카드가 없으면 깔고 채운다(클라가 처리).
- draft_all: 활성 워크플로의 '빈 초안가능 카드'를 전부 채운다(기획안→견적·운영 순). "다 작성해/다 채워줘".
- revise_card{slot?}: 방금 받은 방문객 군집 코멘트(드래그→의견)를 '반영해' 그 카드를 수정한다.
  "이대로 수정해줘/반영해줘/고쳐줘/방금 의견대로 바꿔줘". slot 생략 시 클라가 방금 논의한 카드로 잡는다.
- persona_feedback{types?, content?}: 산출물(또는 메시지 콘텐츠)을 방문객 군집으로 sharp 검토. 특정 군집
  지목 시(예: 캐주얼 방문자=P3) types 에.
- none: 동작 없이 대화만.

규칙:
- "기획안 짜줘/써줘/만들어줘" → draft_card{proposal}. "견적/운영도" → 각 draft_card. "다 작성해/채워줘" → draft_all.
- "인스타/SNS 콘텐츠(게시글) 초안 짜줘" → ops 에 add_card{content} 그리고 draft_card{content}.
  ★ 콘텐츠 카드는 RFP 없이도 초안 가능(브랜드 브리프 근거) — RFP 없다고 거절하지 마라.
- "이대로 수정해/반영해/고쳐줘"(방금 군집 의견을 받은 뒤) → revise_card. 어느 카드인지 불명확하면 slot 비우고 클라에 맡긴다.
- RFP가 보드에 없으면 draft 불가 → op 없이 reply 로 "채팅 '첨부'로 RFP를 올리면 분석 후 초안을 써드려요" 안내.
- reply 는 '실제로 한 것'만, 정직하게(초안임을 명시). 안 한 걸 했다고 하지 마라.
- 군집명: ${segs}.
- 반드시 emit_plan 도구로 반환. reply 는 한국어 1~2문장.

## 현재 보드
${boardSummary}`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      system,
      tools: [tool],
      messages: [{ role: "user", content: `반드시 emit_plan 을 호출하라.\n\n요청: ${message}` }],
    });
    const block = res.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "emit_plan",
    );
    const out = (block?.input as { reply?: string; ops?: unknown[] }) ?? {};
    return Response.json({ reply: out.reply ?? "처리했습니다.", ops: Array.isArray(out.ops) ? out.ops : [] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "오케스트레이션 실패" }, { status: 500 });
  }
}
