// GET /api/higgsfield/callback — Higgsfield OAuth 콜백.
// 쿠키의 state/verifier 검증 → code 를 토큰으로 교환(저장) → 콘솔로 복귀.

import { exchangeCode } from "@/lib/agent/higgsfield-oauth";
import { getSetting } from "@/lib/runtime-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLEAR_COOKIE = "hf_oauth=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const fail = (msg: string) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/console?higgsfield=error&msg=${encodeURIComponent(msg)}`,
        "Set-Cookie": CLEAR_COOKIE,
      },
    });

  const cookieHeader = req.headers.get("cookie") ?? "";
  const m = cookieHeader.match(/(?:^|;\s*)hf_oauth=([^;]+)/);

  if (url.searchParams.get("error")) {
    return fail(url.searchParams.get("error_description") || url.searchParams.get("error") || "인가 거부");
  }
  if (!code || !state) return fail("인가 코드가 없습니다");
  if (!m) return fail("OAuth 상태 쿠키가 없습니다(세션 만료) — 다시 연결하세요");

  let parsed: { state?: string; verifier?: string };
  try {
    parsed = JSON.parse(Buffer.from(m[1], "base64").toString("utf-8"));
  } catch {
    return fail("상태 쿠키 파싱 실패");
  }
  if (parsed.state !== state || !parsed.verifier) return fail("상태 불일치(CSRF 방지)");

  const clientId = getSetting("HIGGSFIELD_CLIENT_ID");
  if (!clientId) return fail("client_id 없음 — 다시 연결하세요");

  try {
    await exchangeCode({
      code,
      verifier: parsed.verifier,
      redirectUri: `${origin}/api/higgsfield/callback`,
      clientId,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "토큰 교환 실패");
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/console?higgsfield=connected`,
      "Set-Cookie": CLEAR_COOKIE,
    },
  });
}
