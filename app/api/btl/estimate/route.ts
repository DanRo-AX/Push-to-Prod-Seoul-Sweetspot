// GET /api/btl/estimate — 사내 RAG 사전견적기 호출(시장 견적 추정).
//
// 견적 슬롯 카드의 '시장 견적 추정' 벤치마크용. 실무자 본인 견적을 자동 작성하지 않고
// (P1/P2) — 현실 시장 금액 범위를 옆에 두어 근거/다관점만 준다. 엔드포인트 불통이면 null.

import { fetchRagEstimate } from "@/lib/agent/btl-rag-estimate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const estimate = await fetchRagEstimate();
  if (!estimate) {
    return Response.json({ error: "견적기에 연결하지 못했습니다." }, { status: 502 });
  }
  return Response.json({ estimate });
}
