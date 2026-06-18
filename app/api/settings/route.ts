// /api/settings — 인앱 API 키 설정.
// GET:  설정 상태(SettingsStatus)만 반환 — 키 원문은 절대 반환하지 않는다.
// POST: 키 저장(data/runtime-settings.json) 후 갱신된 상태 반환 — 재시작 없이 즉시 반영.

import { getStatus, setSettings } from "@/lib/runtime-settings";
import type { RuntimeSettingKey } from "@/lib/runtime-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST 바디 필드 → 런타임 설정 키 매핑
const FIELD_TO_KEY: Record<string, RuntimeSettingKey> = {
  anthropicApiKey: "ANTHROPIC_API_KEY",
  bigqueryProjectId: "OCTOPUS_BIGQUERY_PROJECT_ID",
  googleServiceAccountKey: "OCTOPUS_GOOGLE_SERVICE_ACCOUNT_KEY",
  instagramAccessToken: "OCTOPUS_INSTAGRAM_ACCESS_TOKEN",
  // Higgsfield 는 API 키가 아니라 OAuth 연결(/api/higgsfield/connect)로 처리한다.
};

export async function GET() {
  return Response.json(getStatus());
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "요청 본문이 올바른 JSON 이 아닙니다." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(
      { error: "요청 본문은 JSON 객체여야 합니다." },
      { status: 400 },
    );
  }

  const partial: Partial<Record<RuntimeSettingKey, string>> = {};
  for (const [field, key] of Object.entries(FIELD_TO_KEY)) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value === "string") {
      partial[key] = value; // 빈 문자열이면 setSettings 가 해당 키를 삭제(미설정으로 되돌림)
    }
  }

  setSettings(partial);
  return Response.json(getStatus());
}
