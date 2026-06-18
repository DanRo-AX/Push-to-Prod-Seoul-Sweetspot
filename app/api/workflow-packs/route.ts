// GET/POST /api/workflow-packs — 워크플로 팩 정의 영속화(data/workflow-packs.json).
//
// 정의 에디터의 편집/추가를 파일로 저장해 새로고침 후에도 유지한다. 파일 없으면 GET 은
// null(클라이언트가 시드 사용). 데모 편의 — 인증/검증은 최소(로컬 작업 파일).

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "workflow-packs.json");

export async function GET() {
  try {
    if (!existsSync(FILE)) return Response.json({ packs: null });
    const raw = readFileSync(FILE, "utf-8");
    return Response.json({ packs: JSON.parse(raw) });
  } catch {
    return Response.json({ packs: null });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { packs?: unknown };
    if (!Array.isArray(body.packs)) {
      return Response.json({ error: "packs 배열이 필요합니다." }, { status: 400 });
    }
    mkdirSync(path.dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(body.packs, null, 2) + "\n", "utf-8");
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "저장 실패" }, { status: 500 });
  }
}
