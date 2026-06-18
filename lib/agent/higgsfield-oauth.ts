// Higgsfield MCP OAuth — 서버 전용. Higgsfield 는 API 키가 없고 OAuth(계정 로그인)만 지원한다.
// 표준 OAuth 2.0 Authorization Code + PKCE + Dynamic Client Registration 흐름:
//   1) DCR  POST /oauth2/register            → client_id (캐시)
//   2) authorize  /oauth2/authorize          → 사용자 브라우저 로그인 → code
//   3) token  POST /oauth2/token (PKCE)      → access_token (+ refresh_token, offline_access)
//   4) refresh  POST /oauth2/token           → access_token 갱신
// 토큰은 runtime-settings(data/runtime-settings.json)에만 저장하고, 생성 시점에 MCP 커넥터로 전달한다.
// (메타데이터 확인: /.well-known/oauth-authorization-server — register/authorize/token, PKCE S256.)

import { createHash, randomBytes } from "node:crypto";
import { getSetting, setSettings } from "@/lib/runtime-settings";

export const HIGGSFIELD_MCP_URL = "https://mcp.higgsfield.ai/mcp";
const REGISTER_URL = "https://mcp.higgsfield.ai/oauth2/register";
const AUTHORIZE_URL = "https://mcp.higgsfield.ai/oauth2/authorize";
const TOKEN_URL = "https://mcp.higgsfield.ai/oauth2/token";
const SCOPE = "openid email offline_access";

const b64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** PKCE verifier(고엔트로피 랜덤) 생성. */
export function makeVerifier(): string {
  return b64url(randomBytes(32));
}
/** PKCE S256 challenge. */
export function challengeFor(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

/** DCR: client_id 캐시(runtime-settings) 우선, 없으면 등록 후 저장. */
export async function ensureClientId(redirectUri: string): Promise<string> {
  const cached = getSetting("HIGGSFIELD_CLIENT_ID");
  if (cached) return cached;
  const res = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "octopus",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    }),
  });
  if (!res.ok) throw new Error(`Higgsfield 클라이언트 등록 실패 (HTTP ${res.status})`);
  const data = (await res.json()) as { client_id?: string };
  if (!data.client_id) throw new Error("Higgsfield 등록 응답에 client_id 가 없습니다");
  setSettings({ HIGGSFIELD_CLIENT_ID: data.client_id });
  return data.client_id;
}

/** authorize URL 조립(브라우저 리다이렉트용). */
export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
}): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", opts.clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("scope", SCOPE);
  u.searchParams.set("code_challenge", opts.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", opts.state);
  return u.toString();
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

/** code → 토큰 교환(PKCE). access/refresh 를 저장. */
export async function exchangeCode(opts: {
  code: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
}): Promise<void> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    code_verifier: opts.verifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Higgsfield 토큰 교환 실패 (HTTP ${res.status}): ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) throw new Error("Higgsfield 토큰 응답에 access_token 이 없습니다");
  setSettings({
    HIGGSFIELD_ACCESS_TOKEN: data.access_token,
    ...(data.refresh_token ? { HIGGSFIELD_REFRESH_TOKEN: data.refresh_token } : {}),
  });
}

/** refresh_token 으로 access_token 갱신. 성공 시 저장하고 새 토큰 반환, 실패 시 null. */
export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getSetting("HIGGSFIELD_REFRESH_TOKEN");
  const clientId = getSetting("HIGGSFIELD_CLIENT_ID");
  if (!refresh || !clientId) return null;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: clientId,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) return null;
  setSettings({
    HIGGSFIELD_ACCESS_TOKEN: data.access_token,
    ...(data.refresh_token ? { HIGGSFIELD_REFRESH_TOKEN: data.refresh_token } : {}),
  });
  return data.access_token;
}
