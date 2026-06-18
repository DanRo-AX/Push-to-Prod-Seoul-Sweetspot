// GET /api/workspace — 시나리오 팩 베이스라인 WorkspaceData 반환.
// 각 페이지(/dashboard, /content, /outbound 등)가 초기 로드 시 호출하고,
// 라이브 아티팩트(useAgentStreamContext)가 있으면 같은 kind 를 그걸로 덮어쓴다.
// 키워드/퍼널/콘텐츠성과는 lib/agent/tools.ts 의 순수 빌더를 재사용해 계산한다.

import { loadBtlScenarioPack, loadScenarioPack } from "@/lib/agent/scenario";
import {
  buildContentPerformanceReport,
  buildFunnelReport,
  buildKeywordReport,
} from "@/lib/agent/tools";
import type { WorkspaceData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // C-btl 은 마케팅 대시보드 데이터(GA/퍼널/키워드 등)가 없는 전용 팩이다.
  // 마케팅 뷰(Dashboard/Content/Outbound)는 BTL 흐름과 무관하므로, 여기서는
  // 시나리오 헤더만 채운 베이스라인을 반환해 500 을 방지한다. BTL 산출물(RFP/제안서/
  // 견적서)은 /api/agent SSE → 중앙 아티팩트 패널에서 별도로 렌더된다.
  if (process.env.OCTOPUS_SCENARIO === "C-btl") {
    const btl = await loadBtlScenarioPack();
    return Response.json({
      scenario: {
        id: "C-btl",
        brandName: btl.mockRfp.client_brand.brand_name,
        label: "BTL",
      },
    });
  }

  const pack = await loadScenarioPack();
  const data: WorkspaceData = {
    // /api/scenario 와 동일한 ScenarioInfo 매핑
    scenario: {
      id: pack.id,
      brandName: pack.mockGa.brandName,
      label: pack.id === "A-zero-to-one" ? "제로투원" : "리브랜딩",
    },
    metrics: pack.mockGa,
    funnel: buildFunnelReport(pack),
    keywords: buildKeywordReport(pack),
    contentPerformance: buildContentPerformanceReport(pack),
    crm: pack.mockCrm,
    contacts: pack.mockContacts,
  };
  return Response.json(data);
}
