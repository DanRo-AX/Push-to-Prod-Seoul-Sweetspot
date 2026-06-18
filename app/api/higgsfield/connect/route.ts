// GET /api/higgsfield/connect — Higgsfield OAuth(MCP) 연결 시작.
// DCR 로 client_id 확보 → PKCE verifier/state 를 httpOnly 쿠키에 담고 authorize 로 리다이렉트.

import { randomBytes } from "node:crypto";
import {
  buildAuthorizeUrl,
  challengeFor,
  ensureClientId,
  makeVerifier,
} from "@/lib/agent/higgsfield-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/higgsfield/callback`;
  try {
    const clientId = await ensureClientId(redirectUri);
    const verifier = makeVerifier();
    const challenge = challengeFor(verifier);
    const state = randomBytes(16).toString("hex");
    const authorizeUrl = buildAuthorizeUrl({ clientId, redirectUri, challenge, state });
    const cookie = Buffer.from(JSON.stringify({ state, verifier })).toString("base64");
    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizeUrl,
        "Set-Cookie": `hf_oauth=${cookie}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
      },
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "연결 시작 실패");
    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/console?higgsfield=error&msg=${msg}` },
    });
  }
}
