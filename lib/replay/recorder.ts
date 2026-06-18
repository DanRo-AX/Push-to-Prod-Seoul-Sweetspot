// 골든 런 레코더 + 로더 (서버 전용 — fs 사용, 클라이언트에서 import 금지)
// 라이브 데모 실패 시 동일 UI로 재생하기 위한 "데모 보험" 모듈.
// - createRunRecorder: 라이브 런의 AgentEvent 를 상대 타임스탬프와 함께 기록 → JSONL 저장
// - loadGoldenRun: 저장된 골든 런(JSONL)을 읽어 atMs 오름차순으로 반환

import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentEvent, PatternCard, RecordedEvent } from "@/lib/types";

const GOLDEN_RUNS_DIR = ["data", "golden-runs"] as const;

function goldenRunsDir(): string {
  return path.join(process.cwd(), ...GOLDEN_RUNS_DIR);
}

export interface RunRecorder {
  record(event: AgentEvent): void;
  /** 골든런 자격이 있는 런만 저장한다. 저장 안 하면 null 반환. */
  save(): Promise<string | null>;
}

// 골든런 자격: 정상 완주(done)했고, 보여줄 결과물(artifact)이 하나 이상 있는 런.
// 에러로 끝난 런(예: API 키 미설정)을 저장하면 리플레이가 sample 대신
// 그 에러를 재생하게 되므로(최신 run-* 우선) 반드시 걸러낸다.
function isGoldenWorthy(recorded: RecordedEvent[]): boolean {
  let done = false;
  let hasArtifact = false;
  for (const { event } of recorded) {
    if (event.type === "status" && event.status === "error") return false;
    if (event.type === "status" && event.status === "done") done = true;
    if (event.type === "artifact") hasArtifact = true;
  }
  return done && hasArtifact;
}

export function createRunRecorder(): RunRecorder {
  const recorded: RecordedEvent[] = [];
  let startedAt: number | null = null; // 첫 record 시각 (epoch ms)

  return {
    record(event: AgentEvent): void {
      const now = Date.now();
      if (startedAt === null) startedAt = now;
      recorded.push({ atMs: now - startedAt, event });
    },

    async save(): Promise<string | null> {
      if (!isGoldenWorthy(recorded)) return null;

      const dir = goldenRunsDir();
      await fs.mkdir(dir, { recursive: true });

      // 예: run-2026-06-11T09-30-00.000Z.jsonl (콜론은 파일명에 못 쓰므로 - 로 치환)
      const stamp = new Date().toISOString().replace(/:/g, "-");
      const filePath = path.join(dir, `run-${stamp}.jsonl`);

      const lines = recorded.map((re) => JSON.stringify(re)).join("\n");
      await fs.writeFile(filePath, lines.length > 0 ? `${lines}\n` : "", "utf-8");
      return filePath;
    },
  };
}

/**
 * 패턴카드를 골든런 JSONL 파일 끝에 추가한다.
 * 형식: { type: "pattern_card_minted", card: PatternCard, atMs: <epoch ms> }
 * Sub-AC 3: scenario_complete → btl_extract_pattern_card → 이 함수 호출 순서로 연결된다.
 */
export async function appendPatternCardToRun(
  filePath: string,
  card: PatternCard,
): Promise<void> {
  const entry = {
    type: "pattern_card_minted" as const,
    card,
    atMs: Date.now(),
  };
  await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf-8");
}

/**
 * 골든 런 JSONL 을 읽어 RecordedEvent[] 로 반환한다.
 * - name 지정 시: data/golden-runs/<name>(.jsonl) 파일
 * - 미지정 시: run-*.jsonl 중 가장 최신 파일 (ISO 타임스탬프라 사전순 = 시간순)
 * - run-*.jsonl 이 하나도 없으면 sample.jsonl 폴백
 */
export async function loadGoldenRun(name?: string): Promise<RecordedEvent[]> {
  const dir = goldenRunsDir();
  let fileName: string;

  if (name && name.trim().length > 0) {
    const trimmed = name.trim();
    // 경로 탈출 방지: 파일명만 허용
    fileName = path.basename(trimmed.endsWith(".jsonl") ? trimmed : `${trimmed}.jsonl`);
  } else {
    let latestRun: string | null = null;
    try {
      const entries = await fs.readdir(dir);
      const runs = entries
        .filter((f) => f.startsWith("run-") && f.endsWith(".jsonl"))
        .sort();
      if (runs.length > 0) latestRun = runs[runs.length - 1];
    } catch {
      // 디렉토리가 없으면 그대로 sample 폴백
    }
    fileName = latestRun ?? "sample.jsonl";
  }

  const raw = await fs.readFile(path.join(dir, fileName), "utf-8");

  const events: RecordedEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const parsed = JSON.parse(trimmed) as RecordedEvent;
      if (typeof parsed?.atMs === "number" && parsed?.event != null) {
        events.push(parsed);
      }
    } catch {
      // 손상된 라인은 건너뛴다 — 데모 보험은 한 줄 때문에 죽지 않는다
    }
  }

  events.sort((a, b) => a.atMs - b.atMs);
  return events;
}
