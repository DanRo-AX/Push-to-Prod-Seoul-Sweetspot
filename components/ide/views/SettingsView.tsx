"use client";

// components/ide/views/SettingsView.tsx — 인앱 API 키 설정 (VS Code 설정 페이지 idiom).
//
// 흰 /settings 페이지는 라우트 단독용으로 그대로 두고, IDE 탭 안에서는 이 뷰가 VS Code
// "설정(Settings)" 페이지 어휘로 다시 그린다:
//   · 상단 .ide-viewbar(제목 + 보안 안내 칩).
//   · 연동별 .ide-section — 설정 상태 .ide-kv(설정됨 ••• / 미설정) + 마스킹 .ide-input +
//     저장 .ide-btn. 비밀값은 저장 즉시 비운다(서버가 원문을 반환하지 않음).
//
// 데이터: GET /api/settings(상태만) + POST /api/settings(저장 즉시 적용). 기능/소스 보존 —
// 페이지와 동일 필드/엔드포인트/규칙. 키 원문은 화면에 남기지 않는다.

import { useEffect, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { SettingsStatus } from "@/lib/types";
import {
  ViewChrome,
  ViewSection,
  ViewSkeleton,
  Pill,
} from "@/components/ide/views/ViewChrome";

type InputKey =
  | "anthropicApiKey"
  | "bigqueryProjectId"
  | "googleServiceAccountKey"
  | "googleServiceAccountKeySC"
  | "instagramAccessToken";

const POST_FIELD: Record<InputKey, string> = {
  anthropicApiKey: "anthropicApiKey",
  bigqueryProjectId: "bigqueryProjectId",
  googleServiceAccountKey: "googleServiceAccountKey",
  googleServiceAccountKeySC: "googleServiceAccountKey",
  instagramAccessToken: "instagramAccessToken",
};

const EMPTY_INPUTS: Record<InputKey, string> = {
  anthropicApiKey: "",
  bigqueryProjectId: "",
  googleServiceAccountKey: "",
  googleServiceAccountKeySC: "",
  instagramAccessToken: "",
};

// 설정 여부 칩(.ide-kv 값 슬롯) — 키 원문 대신 마스킹 점만.
function ConfiguredKv({ on }: { on: boolean }) {
  return (
    <div className="ide-kv">
      <span className="ide-kv-key">상태</span>
      <span className="ide-kv-val" style={{ fontFamily: "var(--ide-ui)" }}>
        {on ? (
          <Pill tone="ok" icon="pass-filled">
            설정됨 ••••
          </Pill>
        ) : (
          <Pill icon="circle-outline">미설정</Pill>
        )}
      </span>
    </div>
  );
}

// 한 연동 — 섹션 헤더(라벨 + 필수 칩 + 상태) + 키-값 + 입력 + 저장.
function ConnSection({
  icon,
  title,
  mono,
  required,
  on,
  desc,
  saving,
  onSave,
  children,
}: {
  icon: string;
  title: string;
  mono: string;
  required?: boolean;
  on: boolean;
  desc: string;
  saving: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <ViewSection
      icon={icon}
      title={title}
      meta={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {required && <Pill tone="accent">필수</Pill>}
          <span className="ide-mono">{mono}</span>
        </span>
      }
    >
      <p
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--ide-text-dim)",
          marginBottom: 8,
        }}
      >
        {desc}
      </p>
      <ConfiguredKv on={on} />
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className={`ide-btn ${required ? "" : "ide-btn--secondary"}`}
          disabled={saving}
          onClick={onSave}
          style={saving ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
        >
          <i className="codicon codicon-save" aria-hidden />
          {saving ? "저장 중" : "저장"}
        </button>
      </div>
    </ViewSection>
  );
}

// 라벨 + 마스킹 입력 한 줄.
function Field({
  label,
  hint,
  ...inputProps
}: {
  label: string;
  hint?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: 4,
          fontSize: 12,
          color: "var(--ide-text-dim)",
        }}
      >
        {label}
      </label>
      <input className="ide-input" autoComplete="off" {...inputProps} />
      {hint && (
        <p style={{ marginTop: 4, fontSize: 11, color: "var(--ide-text-faint)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default function SettingsView() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<InputKey, string>>(EMPTY_INPUTS);
  const [savingCard, setSavingCard] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; ok: boolean } | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error(`서버 응답 오류 (${r.status})`);
        return r.json() as Promise<SettingsStatus>;
      })
      .then(setStatus)
      .catch((e) =>
        setLoadError(
          e instanceof Error ? e.message : "설정 상태를 불러오지 못했습니다.",
        ),
      );
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const setField =
    (key: InputKey) => (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputs((prev) => ({ ...prev, [key]: value }));
    };

  async function save(cardId: string, keys: InputKey[]) {
    const body: Record<string, string> = {};
    for (const k of keys) {
      const v = inputs[k].trim();
      if (v) body[POST_FIELD[k]] = v;
    }
    if (Object.keys(body).length === 0) {
      setToast({ id: Date.now(), text: "저장할 값을 입력해 주세요.", ok: false });
      return;
    }
    setSavingCard(cardId);
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`서버 응답 오류 (${r.status})`);
      const next = (await r.json()) as SettingsStatus;
      setStatus(next);
      setInputs((prev) => {
        const cleared = { ...prev };
        for (const k of keys) cleared[k] = "";
        return cleared;
      });
      setToast({
        id: Date.now(),
        text: "저장되었습니다 — 재시작 없이 즉시 적용됩니다.",
        ok: true,
      });
    } catch (e) {
      setToast({
        id: Date.now(),
        text: e instanceof Error ? e.message : "저장에 실패했습니다.",
        ok: false,
      });
    } finally {
      setSavingCard(null);
    }
  }

  return (
    <ViewChrome
      icon="settings-gear"
      title="설정"
      sub="settings"
      actions={
        <Pill icon="shield">data/runtime-settings.json</Pill>
      }
    >
      {status === null && !loadError ? (
        <ViewSkeleton />
      ) : loadError ? (
        <div className="p-4">
          <Pill tone="danger" icon="error">
            {loadError}
          </Pill>
        </div>
      ) : status !== null ? (
        <>
          {/* 보안 안내 — 키 저장 위치 + 원문 비반환. */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              margin: "12px 14px 0",
              padding: "9px 11px",
              border: "1px solid var(--ide-border-strong)",
              borderRadius: 7,
              background: "var(--ide-elevated)",
            }}
          >
            <i
              className="codicon codicon-shield"
              aria-hidden
              style={{ marginTop: 1, color: "var(--ide-ok)", fontSize: 14 }}
            />
            <p style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--ide-text-dim)" }}>
              키는 이 기기의{" "}
              <code
                className="ide-mono"
                style={{
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: "var(--ide-bg-alt)",
                  color: "var(--ide-text)",
                }}
              >
                data/runtime-settings.json
              </code>{" "}
              에만 저장됩니다. 서버는 키 원문을 반환하지 않으며, 설정 여부만
              표시됩니다. 키 없는 연동은 시나리오 mock 으로 동작합니다.
            </p>
          </div>

          <ConnSection
            icon="key"
            title="Anthropic API 키"
            mono="ANTHROPIC_API_KEY"
            required
            on={status.anthropic}
            desc="에이전트 라이브 실행에 필요합니다. 키가 없어도 골든런 리플레이는 동작합니다."
            saving={savingCard === "anthropic"}
            onSave={() => save("anthropic", ["anthropicApiKey"])}
          >
            <Field
              label="API 키"
              type="password"
              value={inputs.anthropicApiKey}
              onChange={setField("anthropicApiKey")}
              placeholder="sk-ant-..."
            />
          </ConnSection>

          <ConnSection
            icon="database"
            title="GA4 BigQuery"
            mono="OCTOPUS_BIGQUERY_PROJECT_ID"
            on={status.bigqueryProject !== null && status.searchConsole}
            desc="query_ga_bigquery 가 GA4 내보내기 테이블을 실호출합니다. 프로젝트 ID 와 서비스계정 JSON 이 모두 있어야 실 연동되며, 없으면 mock 으로 폴백합니다."
            saving={savingCard === "bigquery"}
            onSave={() =>
              save("bigquery", ["bigqueryProjectId", "googleServiceAccountKey"])
            }
          >
            <Field
              label="프로젝트 ID"
              type="text"
              value={inputs.bigqueryProjectId}
              onChange={setField("bigqueryProjectId")}
              placeholder={status.bigqueryProject ?? "my-ga4-project"}
              hint={
                status.bigqueryProject ? `현재 — ${status.bigqueryProject}` : undefined
              }
            />
            <Field
              label="Google 서비스계정 JSON"
              type="password"
              value={inputs.googleServiceAccountKey}
              onChange={setField("googleServiceAccountKey")}
              placeholder='{"type":"service_account", ...} 원문 붙여넣기'
              hint="서비스계정 JSON 은 Search Console 연동과 공유됩니다."
            />
          </ConnSection>

          <ConnSection
            icon="search"
            title="Search Console"
            mono="OCTOPUS_GOOGLE_SERVICE_ACCOUNT_KEY"
            on={status.searchConsole}
            desc="fetch_search_console 이 검색 키워드 실데이터를 조회합니다. BigQuery 와 같은 Google 서비스계정 JSON 을 사용합니다 — 서비스계정 이메일을 Search Console 속성 사용자로 추가하세요."
            saving={savingCard === "searchConsole"}
            onSave={() => save("searchConsole", ["googleServiceAccountKeySC"])}
          >
            <Field
              label="Google 서비스계정 JSON"
              type="password"
              value={inputs.googleServiceAccountKeySC}
              onChange={setField("googleServiceAccountKeySC")}
              placeholder='{"type":"service_account", ...} 원문 붙여넣기'
            />
          </ConnSection>

          <ConnSection
            icon="device-camera"
            title="Instagram 토큰"
            mono="OCTOPUS_INSTAGRAM_ACCESS_TOKEN"
            on={status.instagram}
            desc="fetch_instagram_insights 가 그래프 API 인사이트를 실호출합니다. 장기 액세스 토큰을 입력하세요."
            saving={savingCard === "instagram"}
            onSave={() => save("instagram", ["instagramAccessToken"])}
          >
            <Field
              label="액세스 토큰"
              type="password"
              value={inputs.instagramAccessToken}
              onChange={setField("instagramAccessToken")}
              placeholder="IGQ..."
            />
          </ConnSection>

          <ViewSection
            icon="sparkle"
            title="Higgsfield (콘텐츠 생성)"
            meta={<span className="ide-mono">OAuth · MCP</span>}
          >
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--ide-text-dim)",
                marginBottom: 8,
              }}
            >
              generate_visual 이 Higgsfield 로 이미지/영상을 생성합니다. Higgsfield 는 API 키가
              없어 계정 로그인(OAuth)으로 연결합니다. 연결 전에는 목업 비주얼로 표시됩니다.
            </p>
            <ConfiguredKv on={status.higgsfield} />
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <a
                className={`ide-btn ${status.higgsfield ? "ide-btn--secondary" : ""}`}
                href="/api/higgsfield/connect"
              >
                <i className="codicon codicon-link" aria-hidden />
                {status.higgsfield ? "다시 연결" : "Higgsfield 연결"}
              </a>
            </div>
          </ViewSection>
        </>
      ) : null}

      {/* 저장 결과 토스트 — 자동 닫힘. */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="ide-view-in"
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            padding: "7px 14px",
            borderRadius: 9999,
            fontSize: 12.5,
            fontWeight: 600,
            background: "var(--ide-bg-alt)",
            border: `1px solid ${toast.ok ? "var(--ide-ok)" : "var(--ide-danger)"}`,
            color: toast.ok ? "var(--ide-ok)" : "var(--ide-danger)",
          }}
        >
          {toast.text}
        </div>
      )}
    </ViewChrome>
  );
}
