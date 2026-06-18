// POST /api/btl/discuss — 내가 쓰던 문서를 슬롯 담당 페르소나들이 읽고 논의(코멘트).
// body: multipart/form-data { file, slotId }
// 응답: AgentEvent SSE (status / persona_comment[] / status done) — 채팅 피드에 이름표로 표시.
//
// 핵심: "문서 생성"이 아니라 "지금 내 문서 + 관련 페르소나 논의". 타입은 슬롯이 선언.

import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/runtime-settings";
import { personasForSlot } from "@/lib/agent/btl-personas";
import { personaById } from "@/lib/agent/personas";
import type { WorkflowSlotId } from "@/lib/ide/workflow";
import type { AgentEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";
const MAX_BYTES = 15 * 1024 * 1024;

const VALID_SLOTS: WorkflowSlotId[] = ["rfp", "proposal", "quote", "operation", "contract"];

export async function POST(req: Request) {
  const apiKey = getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "Anthropic API 키가 설정되지 않았습니다." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "multipart/form-data 본문이 필요합니다." }, { status: 400 });
  }

  const file = form.get("file");
  const slotId = String(form.get("slotId") || "") as WorkflowSlotId;
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "file 필드가 필요합니다." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "파일이 너무 큽니다(최대 15MB)." }, { status: 400 });
  }
  // 페르소나 지정 방식 두 가지:
  //   · personaIds(JSON 배열) 또는 personaId(단일) — 카드에 끌어다 놓은 페르소나들(방문객 군집 포함).
  //     이때는 슬롯 scope 무관하게 그 페르소나들로 논의(방문객은 어떤 결과물에도 반응).
  //   · 아무것도 없으면 — 슬롯 담당 검토팀(역할) 전원. 이 경우만 VALID_SLOTS 강제.
  const idsRaw = String(form.get("personaIds") || form.get("personaId") || "");
  let ids: string[] = [];
  if (idsRaw) {
    try {
      const parsed = JSON.parse(idsRaw);
      ids = Array.isArray(parsed) ? parsed.map(String) : [String(idsRaw)];
    } catch {
      ids = [idsRaw];
    }
  }

  let personas;
  if (ids.length > 0) {
    personas = ids.map((id) => personaById(id)).filter((p): p is NonNullable<typeof p> => p != null);
  } else {
    if (!VALID_SLOTS.includes(slotId)) {
      return Response.json({ error: "유효한 slotId 가 필요합니다." }, { status: 400 });
    }
    personas = personasForSlot(slotId);
  }
  if (personas.length === 0) {
    return Response.json({ error: "논의할 페르소나가 없습니다." }, { status: 400 });
  }

  // 카드의 검토 포인트 — 페르소나가 이 의제를 인지하고 자기 렌즈로 짚는다.
  let reviewPoints: string[] = [];
  const rpRaw = String(form.get("reviewPoints") || "");
  if (rpRaw) { try { const p = JSON.parse(rpRaw); if (Array.isArray(p)) reviewPoints = p.map(String); } catch { /* 무시 */ } }

  const name = file.name || "문서";
  const lower = name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  // 문서 본문 준비 — PDF 는 Claude 네이티브 document 블록, 그 외는 텍스트.
  const docContent: Anthropic.ContentBlockParam[] = [];
  const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
  const isDocx =
    lower.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  try {
    if (isPdf) {
      docContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
      });
    } else if (isDocx) {
      const mammoth = await import("mammoth").catch(() => null);
      const text = mammoth ? (await mammoth.extractRawText({ buffer: buf })).value : buf.toString("utf-8");
      docContent.push({ type: "text", text: text.slice(0, 60000) });
    } else {
      docContent.push({ type: "text", text: buf.toString("utf-8").slice(0, 60000) });
    }
  } catch {
    return Response.json({ error: "문서를 읽지 못했습니다." }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* 연결 종료 */
        }
      };

      emit({ type: "status", status: "started" });
      emit({
        type: "status",
        status: "thinking",
        message: `${personas.map((p) => p.name).join("·")} 가 「${name}」 검토 중`,
      });

      const roster = personas
        .map((p) => `- ${p.id} | ${p.name}(${p.title}): ${p.lens}`)
        .join("\n");

      const tool: Anthropic.Tool = {
        name: "emit_discussion",
        description: "각 페르소나의 코멘트를 반환한다.",
        input_schema: {
          type: "object",
          properties: {
            comments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  persona_id: { type: "string" },
                  comment: { type: "string", description: "2~4문장, 구체적·실행가능, 한국어" },
                },
                required: ["persona_id", "comment"],
              },
            },
          },
          required: ["comments"],
        },
      };

      const hasAudience = personas.some((p) => p.kind === "audience");
      const rpBlock = reviewPoints.length
        ? `\n\n## 이 산출물의 검토 포인트(반드시 인지하고 검토)\n${reviewPoints.map((p) => `- ${p}`).join("\n")}\n각 페르소나는 자기 렌즈에서 '의미 있는' 포인트를 골라 그 지점을 구체적으로 짚어라(자기 렌즈와 무관한 포인트는 건너뛴다). 산출물의 실제 내용을 인용해 어디가 약한지, 무엇을 어떻게 바꿀지 제시하라.`
        : "";
      const system = `당신은 BTL 팝업 에이전시의 검토 회의를 진행한다. 아래 페르소나들이 각자
자기 렌즈로 첨부 문서(특정 산출물 카드)를 읽고 코멘트한다. 문서를 다시 쓰지 말고, 실무자가
바로 반영할 수 있는 구체적 피드백만 남긴다(각 2~4문장, 한국어). 일반론 금지 — 이 결과물의
특정 지점을 짚어라.${
        hasAudience
          ? " 방문객 군집(audience)은 '실제 방문객 한 명'처럼 1인칭으로 반응한다(가겠다/안 가겠다, 무엇이 걸리는지) — 군집 데이터 근거로만, 칭찬용 멘트 금지."
          : ""
      } 반드시 emit_discussion 도구로 페르소나별 코멘트를 반환.

## 참여 페르소나
${roster}${rpBlock}`;

      try {
        const client = new Anthropic({ apiKey });
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 4000,
          thinking: { type: "adaptive" },
          system,
          tools: [tool],
          messages: [
            {
              role: "user",
              content: [
                ...docContent,
                { type: "text", text: "이 문서를 페르소나별로 검토해 emit_discussion 으로 반환하라." },
              ],
            },
          ],
        });
        const toolUse = res.content.find(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "emit_discussion",
        );
        const comments =
          (toolUse?.input as { comments?: { persona_id: string; comment: string }[] } | undefined)
            ?.comments ?? [];

        // 로스터 순서대로 이름표 달아 발행.
        for (const p of personas) {
          const c = comments.find((x) => x.persona_id === p.id);
          if (!c?.comment) continue;
          emit({
            type: "persona_comment",
            personaId: p.id,
            name: p.name,
            title: p.title,
            accent: p.accent,
            text: c.comment,
            targetFile: name,
          });
        }
        emit({ type: "status", status: "done", message: `${name} 검토 완료` });
      } catch (err) {
        emit({
          type: "status",
          status: "error",
          message: err instanceof Error ? err.message : "논의 중 오류가 발생했습니다.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
