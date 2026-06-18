// GET /api/scenario — 활성 시나리오 팩 요약(ScenarioInfo) 반환 (사이드바 표시용)

import { loadBtlScenarioPack, loadScenarioPack } from "@/lib/agent/scenario";
import type { ScenarioId, ScenarioInfo } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABELS: Record<ScenarioId, string> = {
  "A-zero-to-one": "제로투원",
  "B-rebrand": "리브랜딩",
  "C-btl": "BTL",
};

export async function GET() {
  // C-btl 은 마케팅 mock(mock-ga.json 등)이 없는 전용 팩이라 별도 로더를 쓴다.
  if (process.env.OCTOPUS_SCENARIO === "C-btl") {
    const btl = await loadBtlScenarioPack();
    const info: ScenarioInfo = {
      id: "C-btl",
      brandName: btl.mockRfp.client_brand.brand_name,
      label: LABELS["C-btl"],
    };
    return Response.json(info);
  }

  const pack = await loadScenarioPack();
  const info: ScenarioInfo = {
    id: pack.id,
    brandName: pack.mockGa.brandName,
    label: LABELS[pack.id] ?? pack.id,
  };
  return Response.json(info);
}
