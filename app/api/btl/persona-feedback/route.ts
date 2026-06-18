// POST /api/btl/persona-feedback — 방문객 군집(OASIS)이 콘텐츠를 '데이터 근거'로 깎는다(수렴 모드).
//
// 확정에 가까운 콘텐츠를 다듬는 단계에 맞춘 'sharp' 리뷰. 헛소리 방지를 위해:
//   · 관련 군집 게이팅 — 이 콘텐츠에 이해관계 있는 군집만 말한다(무관 군집 mute).
//   · 적대적 — 약하면 솔직히 engage=false. 예스맨 금지.
//   · 요소 단위 — {target, issue, fix} 로 '어디가' 문제인지 짚는다.
//   · 판정 — drop / pivot / sharpen. sharpen 이면 after 재작성 + 반응율 before→after.
// 결과: 구조화 JSON(아래 ContentReview). UI 가 비포/애프터·판정·반응율로 렌더.
//
// body(JSON): { content: string, types?: OasisType[], target?: string }

import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/runtime-settings";
import { OASIS, archetypeByType, samplesByType, type OasisType } from "@/lib/oasis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";
const ALL: OasisType[] = ["P1", "P2", "P3", "P4", "P5"];

export async function POST(req: Request) {
  const apiKey = getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) return Response.json({ error: "Anthropic API 키가 설정되지 않았습니다." }, { status: 400 });

  let body: { content?: string; types?: OasisType[]; target?: string };
  try { body = (await req.json()) as typeof body; }
  catch { return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 }); }

  const content = (body.content ?? "").trim();
  if (!content) return Response.json({ error: "검토할 콘텐츠(content)가 필요합니다." }, { status: 400 });
  const types = (body.types?.length ? body.types : ALL).filter((t) => archetypeByType(t));
  if (types.length === 0) return Response.json({ error: "유효한 군집이 없습니다." }, { status: 400 });

  const grounding = types.map((t) => {
    const a = archetypeByType(t)!;
    const samples = samplesByType(t).slice(0, 2).map((s) =>
      `    · ${s.name}(${s.age}, 월 ${s.monthly_popup_visits}회) 욕구/페인: ${s.key_pain_points.join("; ")} / 결정: ${s.decision_style}`,
    ).join("\n");
    return `- ${t} ${a.label} (${OASIS.total}명 중 ${a.count}명): ${a.desc}\n${samples}`;
  }).join("\n");

  const tool: Anthropic.Tool = {
    name: "emit_review",
    description: "콘텐츠를 군집 데이터 근거로 깎은 구조화 리뷰를 반환한다.",
    input_schema: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["drop", "pivot", "sharpen"], description: "drop=어느 군집도 안 움직임(재기획) / pivot=핵심은 살되 타겟·각도 전환 / sharpen=방향 맞음, 구체화로 살림" },
        verdict_reason: { type: "string", description: "판정 근거 1~2문장(군집 데이터 인용)" },
        pivot_to: { type: "string", description: "verdict=pivot 일 때만 — 어느 군집/각도로 틀지" },
        segments: {
          type: "array", description: "각 군집의 관련성·반응. 관련 없으면 relevant=false 로 mute.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "군집 코드 P1~P5" },
              relevant: { type: "boolean", description: "이 콘텐츠에 이해관계 있는 군집인가" },
              engage_before: { type: "boolean", description: "원본에 반응할지" },
              engage_after: { type: "boolean", description: "재작성(after) 기준 반응할지. sharpen 아니면 engage_before 와 동일." },
              note: { type: "string", description: "관련 군집만 — 한 줄 근거(왜 반응/무반응)" },
            },
            required: ["type", "relevant", "engage_before", "engage_after"],
          },
        },
        findings: {
          type: "array", description: "요소 단위 지적 — 어디가 왜 약하고 어떻게 고칠지.",
          items: {
            type: "object",
            properties: {
              target: { type: "string", description: "콘텐츠의 어느 요소(예: 해시태그, 포토존 문구, 한정 메시지, 헤드라인)" },
              issue: { type: "string", description: "왜 약한가 — 군집 데이터 근거로" },
              fix: { type: "string", description: "이 요소를 어떻게 바꿀지(구체)" },
              segment: { type: "string", description: "주로 어느 군집을 위한 것(P*)" },
            },
            required: ["target", "issue", "fix"],
          },
        },
        after: { type: "string", description: "verdict=sharpen 일 때만 — findings 를 반영해 다시 쓴 콘텐츠 전문(원본과 같은 형식)." },
      },
      required: ["verdict", "verdict_reason", "segments", "findings"],
    },
  };

  const system = `당신은 팝가의 방문객 데이터 애널리스트다. 이미 어느 정도 다듬어진 콘텐츠를
'데이터 근거로 날카롭게 깎는' 단계다(브레인스토밍 아님).
규칙:
- 관련 군집 게이팅: 이 콘텐츠에 이해관계 있는 군집만 relevant=true 로 말하라. 무관하면 relevant=false, note 비움(헛소리 금지).
- 적대적: 데이터가 무관심을 가리키면 솔직히 engage_before=false. 절대 예스맨 금지.
- 요소 단위: findings 는 '어느 요소가' 문제인지 target 으로 콕 짚어라. 군집 데이터를 명시 인용.
- 판정: 어느 관련 군집도 안 움직이고 방향 자체가 틀리면 drop. 핵심은 살되 타깃/각도가 어긋나면 pivot(+pivot_to). 방향 맞고 구체화로 살릴 수 있으면 sharpen.
- sharpen 이면 findings 를 실제로 반영해 after(콘텐츠 전문)를 다시 쓰고, after 기준으로 engage_after 를 '정직하게' 재평가하라(안 고쳐진 군집은 false 유지). drop/pivot 이면 after 비움.
- 반드시 emit_review 도구로 반환.

## 방문객 군집(근거 데이터)
${grounding}`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      // 산출물(기획안 등) after 재작성은 길다 — adaptive thinking + 전문 재작성에 충분한 여유.
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system,
      tools: [tool],
      messages: [{
        role: "user",
        content: `다음 콘텐츠를 군집 데이터 근거로 깎아라. 반드시 emit_review 도구 한 번으로 아래를 '모두' 채워라(요약 한 줄로 갈음 금지):
1) segments — 관련 군집마다 type/relevant/engage_before/engage_after/note 를 빠짐없이. 무관 군집은 relevant=false.
2) findings — 최소 3개. 각 {target, issue, fix} 로 '어느 요소가' 약한지 콕 짚고 군집 데이터 인용.
3) verdict=sharpen 이면 after — findings 를 실제 반영해 콘텐츠를 처음부터 끝까지 다시 쓴 '전문'. 일부만/요약 금지. drop·pivot 이면 after 비움.
verdict_reason 에 길게 쓰지 말고, 구조화 필드(segments·findings·after)에 내용을 담아라.${body.target ? `\n실무자가 노리는 타깃: ${body.target}` : ""}\n\n[콘텐츠]\n${content}`,
      }],
    });
    const block = res.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "emit_review",
    );
    if (!block) return Response.json({ error: "리뷰를 생성하지 못했습니다." }, { status: 502 });
    return Response.json({ review: block.input });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "피드백 생성 실패" }, { status: 500 });
  }
}
