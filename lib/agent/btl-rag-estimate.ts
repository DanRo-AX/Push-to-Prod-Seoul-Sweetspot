// lib/agent/btl-rag-estimate.ts — 사내 RAG 기반 사전 견적기(pre-estimate) 연동.
// 견적서 line_items 의 단가가 mock 이라 비현실적으로 낮던 문제를, 실제 RAG 견적기의
// 현실 금액으로 보정한다. 엔드포인트가 불통/타임아웃이면 null → 호출측이 mock 단가로
// 폴백(오프라인 데모/골든런 재현성 유지).
//
// 응답 예: { construction:{total_min,total_max,avg_per_pyeong}, operation:{...},
//           rent:{...}, others:{...}, total_estimate:{min,max,label} }

const DEFAULT_ENDPOINT = "https://pre-estimate-270739039690.asia-northeast3.run.app/";

export interface RagEstimate {
  min: number;
  max: number;
  mid: number;
  label: string;
  /** 카테고리별 중앙값(원) */
  categories: { construction: number; operation: number; rent: number; others: number };
  source: string;
}

interface RagRaw {
  construction?: { total_min?: number; total_max?: number };
  operation?: { total_min?: number; total_max?: number };
  rent?: { total_min?: number; total_max?: number };
  others?: { total_min?: number; total_max?: number };
  total_estimate?: { min?: number; max?: number; label?: string };
}

function mid(min?: number, max?: number): number {
  return Math.round(((min ?? 0) + (max ?? 0)) / 2);
}

/**
 * RAG 견적기 호출. 실패/타임아웃이면 null(호출측 mock 폴백).
 * 엔드포인트는 OCTOPUS_RAG_ESTIMATE_URL 설정으로 덮어쓸 수 있다.
 */
export async function fetchRagEstimate(): Promise<RagEstimate | null> {
  const url = process.env.OCTOPUS_RAG_ESTIMATE_URL || DEFAULT_ENDPOINT;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const raw = (await res.json()) as RagRaw;
    const te = raw.total_estimate;
    const min = te?.min ?? 0;
    const max = te?.max ?? 0;
    if (min <= 0 && max <= 0) return null;
    return {
      min,
      max,
      mid: mid(min, max),
      label: te?.label ?? `${min.toLocaleString()}~${max.toLocaleString()}원`,
      categories: {
        construction: mid(raw.construction?.total_min, raw.construction?.total_max),
        operation: mid(raw.operation?.total_min, raw.operation?.total_max),
        rent: mid(raw.rent?.total_min, raw.rent?.total_max),
        others: mid(raw.others?.total_min, raw.others?.total_max),
      },
      source: "RAG 사전견적기(pre-estimate)",
    };
  } catch {
    return null; // 네트워크/타임아웃 — mock 폴백
  }
}
