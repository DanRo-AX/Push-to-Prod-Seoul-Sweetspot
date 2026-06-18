// lib/agent/rfp-cache.ts — RFP 추출 캐시(콘텐츠 해시 기준).
//
// RFP 추출은 opus + adaptive thinking + PDF 통독이라 ~70초로 느리다. 동일 파일(바이트 해시
// 일치)은 캐시로 즉시 응답한다.
//   · 골든(커밋): scenarios/C-btl/golden-rfp.json = { hash, rfp } — KMI 데모 첫 실행도 즉시.
//   · 런타임(미커밋): data/rfp-cache/<hash>.json — 다른 파일도 한 번 추출 후 캐시.
// 서빙 시 received_at 만 현재 시각으로 다시 찍는다(나머지 구조는 캐시 그대로).

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { RfpDocument } from "@/lib/types";

const GOLDEN = path.join(process.cwd(), "scenarios", "C-btl", "golden-rfp.json");
const RUNTIME_DIR = path.join(process.cwd(), "data", "rfp-cache");

export function rfpHash(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function restamp(rfp: RfpDocument): RfpDocument {
  return { ...rfp, received_at: new Date().toISOString() };
}

/** 해시 일치 캐시 조회 — 골든 우선, 없으면 런타임. 미스면 null. */
export function readCachedRfp(hash: string): RfpDocument | null {
  try {
    if (existsSync(GOLDEN)) {
      const g = JSON.parse(readFileSync(GOLDEN, "utf-8")) as { hash?: string; rfp?: RfpDocument };
      if (g.hash === hash && g.rfp) return restamp(g.rfp);
    }
  } catch {
    /* 골든 깨짐 — 무시 */
  }
  try {
    const f = path.join(RUNTIME_DIR, `${hash}.json`);
    if (existsSync(f)) return restamp(JSON.parse(readFileSync(f, "utf-8")) as RfpDocument);
  } catch {
    /* 런타임 캐시 깨짐 — 무시 */
  }
  return null;
}

/** 추출 결과를 런타임 캐시에 기록(베스트 에포트). */
export function writeCachedRfp(hash: string, rfp: RfpDocument): void {
  try {
    mkdirSync(RUNTIME_DIR, { recursive: true });
    writeFileSync(path.join(RUNTIME_DIR, `${hash}.json`), JSON.stringify(rfp, null, 2) + "\n", "utf-8");
  } catch {
    /* 쓰기 실패해도 추출은 성공 — 무시 */
  }
}
