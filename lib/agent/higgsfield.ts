// Higgsfield 콘텐츠 생성 — 서버 전용. Higgsfield 는 API 키가 없고 OAuth(MCP)만 지원하므로,
// 저장된 OAuth access_token 을 Anthropic "MCP 커넥터"로 넘겨 에이전트가 Higgsfield MCP 도구를
// 호출해 이미지를 생성하게 한다(별도 1회성 메시지). 토큰 만료 시 refresh 후 1회 재시도.
// 결과 메시지의 텍스트/MCP 도구결과 블록 전반에서 이미지/영상 URL 을 방어적으로 추출한다.
//
// 미연결(토큰 없음)/실패 시 throw → 호출처(generate_visual)가 목업으로 폴백한다.

import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/runtime-settings";
import { HIGGSFIELD_MCP_URL, refreshAccessToken } from "./higgsfield-oauth";

const MODEL = "claude-opus-4-8";

/** 중첩 구조(텍스트·MCP 도구결과 블록)에서 첫 이미지/영상 URL 추출. */
function extractUrl(v: unknown, depth = 0, seen = new Set<unknown>()): string | null {
  if (v == null || depth > 8 || seen.has(v)) return null;
  if (typeof v === "string") {
    const m = v.match(/https?:\/\/[^\s"')]+/g);
    if (!m) return null;
    const img = m.find((u) => /\.(png|jpe?g|webp|gif|mp4|mov|webm)(\?|$)/i.test(u));
    return img ?? m.find((u) => /(image|video|output|cdn|media|higgsfield)/i.test(u)) ?? null;
  }
  if (typeof v !== "object") return null;
  seen.add(v);
  for (const val of Object.values(v as Record<string, unknown>)) {
    const u = extractUrl(val, depth + 1, seen);
    if (u) return u;
  }
  return null;
}

export interface HiggsfieldGenOptions {
  prompt: string;
  aspect: string;
}

/** Higgsfield MCP 로 이미지 1장 생성 → 출력 URL. 실패 시 throw. */
export async function generateViaHiggsfield(opts: HiggsfieldGenOptions): Promise<string> {
  const anthropicKey = getSetting("ANTHROPIC_API_KEY");
  if (!anthropicKey) throw new Error("Anthropic API 키가 없습니다");
  const token = getSetting("HIGGSFIELD_ACCESS_TOKEN");
  if (!token) throw new Error("Higgsfield 미연결(액세스 토큰 없음)");

  const client = new Anthropic({ apiKey: anthropicKey });
  const ask = (tok: string) =>
    client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["mcp-client-2025-04-04"],
      mcp_servers: [
        {
          type: "url",
          name: "higgsfield",
          url: HIGGSFIELD_MCP_URL,
          authorization_token: tok,
        },
      ],
      messages: [
        {
          role: "user",
          content:
            `Higgsfield 로 이미지를 생성해줘.\n프롬프트: "${opts.prompt}"\n비율: ${opts.aspect}\n` +
            `생성이 완료되면 다른 말 없이 최종 이미지 URL 만 한 줄로 답해줘.`,
        },
      ],
    });

  let msg;
  try {
    msg = await ask(token);
  } catch (err) {
    // 인증 만료 추정 → refresh 후 1회 재시도
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw err;
    msg = await ask(refreshed);
  }

  const url = extractUrl(msg.content);
  if (!url) throw new Error("Higgsfield MCP 결과에서 이미지 URL 을 찾지 못했습니다");
  return url;
}

/** Higgsfield MCP(generate_video)로 짧은 영상 1편 생성 → mp4 URL. 실패 시 throw. */
export async function generateVideoViaHiggsfield(opts: HiggsfieldGenOptions): Promise<string> {
  const anthropicKey = getSetting("ANTHROPIC_API_KEY");
  if (!anthropicKey) throw new Error("Anthropic API 키가 없습니다");
  const token = getSetting("HIGGSFIELD_ACCESS_TOKEN");
  if (!token) throw new Error("Higgsfield 미연결(액세스 토큰 없음)");

  const client = new Anthropic({ apiKey: anthropicKey });
  const ask = (tok: string) =>
    client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["mcp-client-2025-04-04"],
      mcp_servers: [
        {
          type: "url",
          name: "higgsfield",
          url: HIGGSFIELD_MCP_URL,
          authorization_token: tok,
        },
      ],
      messages: [
        {
          role: "user",
          content:
            `Higgsfield 의 영상 생성 도구(generate_video)로 짧은 영상을 만들어줘.\n프롬프트: "${opts.prompt}"\n비율: ${opts.aspect}\n` +
            `완료되면 다른 말 없이 최종 영상(mp4) URL 만 한 줄로 답해줘.`,
        },
      ],
    });

  let msg;
  try {
    msg = await ask(token);
  } catch (err) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw err;
    msg = await ask(refreshed);
  }

  const url = extractUrl(msg.content);
  if (!url) throw new Error("Higgsfield MCP 결과에서 영상 URL 을 찾지 못했습니다");
  return url;
}
