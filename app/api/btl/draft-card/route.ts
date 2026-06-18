// POST /api/btl/draft-card — 카드 타입에 맞는 '초안(before)'을 RFP 기반으로 생성(제네릭).
//
// 카드 전용 엔드포인트를 따로 두지 않는다 — CardSpec.draftGuide(데이터)가 '어떻게 초안 잡을지'를
// 선언하고, 이 엔드포인트는 그걸 읽어 어떤 카드든 초안을 쓴다. 초안은 군집이 깎을 before.
// 정직성: 사람만 가능한 것(실제 작가 라인업·대관·확정 단가)은 [사람 확인 필요]로 비운다(거짓 채움 금지).
//
// body(JSON): { slot: string, rfpText: string, priors?: {label: string, text: string}[] }
// 응답: { markdown: string } 또는 { error }

import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/runtime-settings";
import { cardSpecForSlot } from "@/lib/ide/card-spec";

// 콘텐츠 카드는 RFP 대신 시나리오 브랜드 브리프를 근거로 — 직접 읽는다(전체 팩 로더는 A/B mock 파일을 요구).
async function readBrandBrief(): Promise<string> {
  const id = process.env.OCTOPUS_SCENARIO || "C-btl";
  try {
    return await readFile(path.join(process.cwd(), "scenarios", id, "brand-brief.md"), "utf-8");
  } catch {
    return "";
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";

// 골든 초안 캐시 — 데모 RFP(달무드 등)의 슬롯 초안을 미리 생성해 두면 즉시 로드(LLM 무대기).
// 키: rfpId(안정) + slot. scenarios/C-btl/golden-draft-{slot}.json = { rfpId, markdown }.
async function readGoldenDraft(slot: string, rfpId: string): Promise<string | null> {
  if (!rfpId) return null;
  try {
    const p = path.join(process.cwd(), "scenarios", "C-btl", `golden-draft-${slot}.json`);
    const data = JSON.parse(await readFile(p, "utf-8")) as { rfpId?: string; markdown?: string };
    return data.rfpId === rfpId && data.markdown ? data.markdown : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: { slot?: string; rfpText?: string; rfpId?: string; priors?: { label: string; text: string }[] };
  try { body = (await req.json()) as typeof body; }
  catch { return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 }); }

  const slot = String(body.slot || "");
  const spec = cardSpecForSlot(slot);
  if (!spec) return Response.json({ error: "알 수 없는 카드 슬롯." }, { status: 400 });
  if (!spec.draftGuide) return Response.json({ error: "이 카드는 AI 초안을 지원하지 않습니다." }, { status: 400 });

  // 골든 캐시 히트 — 미리 생성한 초안이면 LLM 없이 즉시 반환.
  const cached = await readGoldenDraft(slot, String(body.rfpId || ""));
  if (cached) return Response.json({ markdown: cached, cached: true });

  // 캐시 미스 — 실제 LLM 생성(키 필요).
  const apiKey = getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) return Response.json({ error: "Anthropic API 키가 설정되지 않았습니다." }, { status: 400 });
  // 근거 컨텍스트 — RFP 기반 카드는 rfpText, 콘텐츠 카드는 RFP가 없으면 시나리오 브랜드 브리프로.
  let rfpText = String(body.rfpText || "").slice(0, 30000);
  if (!rfpText.trim() && slot === "content") {
    rfpText = (await readBrandBrief()).slice(0, 30000);
  }
  if (!rfpText.trim()) return Response.json({ error: "근거 내용이 필요합니다(RFP를 분석하거나 브랜드 브리프를 두세요)." }, { status: 400 });

  const priors = (body.priors ?? []).filter((p) => p?.text?.trim());
  const priorsBlock = priors.length
    ? `\n\n## 이미 작성된 상위 산출물(정렬에 참고)\n${priors.map((p) => `### ${p.label}\n${p.text.slice(0, 8000)}`).join("\n\n")}`
    : "";
  const rpBlock = spec.reviewPoints?.length
    ? `\n\n## 이 초안이 미리 의식할 검토 포인트(방문객 군집이 이걸로 깎는다)\n${spec.reviewPoints.map((p) => `- ${p}`).join("\n")}`
    : "";

  const system = `너는 BTL(팝업·오프라인) 에이전시의 실무 기획자다. 첨부 RFP를 근거로 '${spec.header.title}' 초안을
마크다운으로 쓴다. 이건 최종본이 아니라 '초안(before)' — 이후 방문객 군집이 깎고 사람이 확정한다.

규칙(중요):
- RFP의 실제 정보(목적·타깃·서사 파트·기간·장소·평가배점·win_themes)를 근거로 구체적으로.
- 검토 포인트를 미리 의식해 그 약점이 안 생기게 쓴다(단, 억지로 다 채우지 말 것).
- 정직성: 사람만 정할 수 있는 것(실제 협업 작가 라인업·구체 대관 확보·확정 단가·확정 예산)은 지어내지 말고
  「[사람 확인 필요]」로 비워둔다. 거짓 사실·가짜 숫자 금지.
- 머리말에 "> AI 초안 · 검토/수정 필요"를 한 줄 넣는다.
- 마크다운 본문만 출력(설명·인사말 없이).

## 작성 가이드
${spec.draftGuide}${rpBlock}`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system,
      messages: [{
        role: "user",
        content: `다음 RFP를 근거로 '${spec.header.title}' 초안을 마크다운으로 작성하라.${priorsBlock}\n\n## RFP\n${rfpText}`,
      }],
    });
    const md = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    if (!md) return Response.json({ error: "초안을 생성하지 못했습니다." }, { status: 502 });
    return Response.json({ markdown: md });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "초안 생성 실패" }, { status: 500 });
  }
}
