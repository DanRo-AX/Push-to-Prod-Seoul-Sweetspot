// 런타임 설정 저장소 — 서버 전용 모듈 (fs 사용, 클라이언트 번들에 포함 금지)
// 인앱 설정에서 입력한 API 키를 data/runtime-settings.json 에 저장하고,
// getSetting() 으로 "런타임 파일 우선 → process.env 폴백" 순서로 조회한다.
// 재시작 없이 즉시 반영된다 (도구가 호출 시점마다 getSetting 을 다시 읽음).
//
// 보안 규칙:
// - data/runtime-settings.json 은 .gitignore 대상 — 절대 커밋하지 않는다.
// - 키 원문은 이 모듈 밖으로 상태 조회 용도로 내보내지 않는다 (getStatus 는 설정 여부만).
// - 키를 로그·아티팩트·골든런에 남기지 않는다.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SettingsStatus } from "@/lib/types";

// 저장 가능한 키 목록 — env 변수명과 동일한 이름을 쓴다.
export type RuntimeSettingKey =
  | "ANTHROPIC_API_KEY"
  | "OCTOPUS_BIGQUERY_PROJECT_ID"
  | "OCTOPUS_GOOGLE_SERVICE_ACCOUNT_KEY" // 서비스계정 JSON 원문 (BigQuery + Search Console 공용)
  | "OCTOPUS_INSTAGRAM_ACCESS_TOKEN"
  // Higgsfield 콘텐츠 생성 — OAuth(MCP) 연동. API 키가 아니라 계정 로그인 토큰.
  | "HIGGSFIELD_CLIENT_ID" // DCR 로 발급된 client_id (캐시)
  | "HIGGSFIELD_ACCESS_TOKEN"
  | "HIGGSFIELD_REFRESH_TOKEN";

const SETTINGS_PATH = path.join(process.cwd(), "data", "runtime-settings.json");

function readSettingsFile(): Partial<Record<RuntimeSettingKey, string>> {
  try {
    const raw = readFileSync(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Partial<Record<RuntimeSettingKey, string>>;
    }
    return {};
  } catch {
    // 파일이 없거나 깨졌으면 빈 객체 — env 폴백으로 동작
    return {};
  }
}

/**
 * 설정값 조회: data/runtime-settings.json 우선, 없으면 process.env.
 * 빈 문자열은 "미설정"으로 취급한다.
 */
export function getSetting(key: RuntimeSettingKey): string | undefined {
  const fromFile = readSettingsFile()[key];
  if (typeof fromFile === "string" && fromFile.trim() !== "") {
    return fromFile;
  }
  const fromEnv = process.env[key];
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv;
  }
  return undefined;
}

/**
 * 부분 갱신 저장: 전달된 키만 덮어쓴다. 빈 문자열을 주면 해당 키를 삭제(미설정으로 되돌림).
 */
export function setSettings(
  partial: Partial<Record<RuntimeSettingKey, string>>,
): void {
  const current = readSettingsFile();
  for (const [key, value] of Object.entries(partial)) {
    if (typeof value === "string" && value.trim() !== "") {
      current[key as RuntimeSettingKey] = value.trim();
    } else if (value !== undefined) {
      delete current[key as RuntimeSettingKey];
    }
  }
  mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  // 키 원문이 담기는 파일 — 소유자 전용 권한으로 기록
  writeFileSync(SETTINGS_PATH, JSON.stringify(current, null, 2) + "\n", {
    encoding: "utf-8",
    mode: 0o600,
  });
}

/**
 * 설정 상태 조회 — 키 원문은 절대 반환하지 않는다 (설정 여부 boolean 만).
 * bigqueryProject 는 비밀이 아닌 프로젝트 ID 라서 원문 표시 가능.
 */
export function getStatus(): SettingsStatus {
  return {
    anthropic: getSetting("ANTHROPIC_API_KEY") !== undefined,
    bigqueryProject: getSetting("OCTOPUS_BIGQUERY_PROJECT_ID") ?? null,
    searchConsole: getSetting("OCTOPUS_GOOGLE_SERVICE_ACCOUNT_KEY") !== undefined,
    instagram: getSetting("OCTOPUS_INSTAGRAM_ACCESS_TOKEN") !== undefined,
    higgsfield: getSetting("HIGGSFIELD_ACCESS_TOKEN") !== undefined,
  };
}
