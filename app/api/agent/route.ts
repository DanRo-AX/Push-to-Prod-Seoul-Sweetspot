// POST /api/agent — 에이전트 실행 + SSE 스트리밍
// body: { message: string; scenarioId?: ScenarioId }
// 각 AgentEvent 를 "data: <json>\n\n" 형식으로 스트리밍하고, 골든 런 레코더에 함께 기록한다.

import { loadScenarioPack, loadBtlScenarioPack } from "@/lib/agent/scenario";
import { runAgent } from "@/lib/agent/engine";
import { runBtlAgent, btl_extract_pattern_card, type BtlRunContext } from "@/lib/agent/btl-engine";
import { createRunRecorder, appendPatternCardToRun } from "@/lib/replay/recorder";
import type { AgentEvent, RfpDocument, ScenarioId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { message?: unknown; scenarioId?: ScenarioId; rfp?: RfpDocument };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청 본문입니다" }, { status: 400 });
  }

  const message = body.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    return Response.json({ error: "message 필드가 필요합니다" }, { status: 400 });
  }

  // 업로드 RFP override (드래그앤드롭 추출본) — 있으면 BTL 흐름의 시작 RFP 로 쓴다.
  const rfpOverride =
    body.rfp && typeof body.rfp === "object" && typeof body.rfp.rfp_id === "string"
      ? body.rfp
      : undefined;

  // C-BTL 시나리오는 별도 팩(BtlScenarioPack)을 로드해 runBtlAgent로 분기한다.
  const isBtl = body.scenarioId === "C-btl" ||
    (!body.scenarioId && process.env.OCTOPUS_SCENARIO === "C-btl");

  let scenario: Awaited<ReturnType<typeof loadScenarioPack>> | null = null;
  let btlPack: Awaited<ReturnType<typeof loadBtlScenarioPack>> | null = null;

  try {
    if (isBtl) {
      btlPack = await loadBtlScenarioPack();
    } else {
      scenario = await loadScenarioPack(body.scenarioId);
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "시나리오 로드 실패" },
      { status: 500 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // 골든 런 레코더 — 레코딩 실패가 응답에 영향을 주지 않도록 전부 try/catch
      const recorder = (() => {
        try {
          return createRunRecorder();
        } catch {
          return null;
        }
      })();

      // C-BTL scenario_complete 이벤트에서 캡처한 컨텍스트.
      // 골든런 저장 후 btl_extract_pattern_card 호출에 사용된다.
      let capturedBtlCtx: BtlRunContext | null = null;

      let closed = false;

      const emit = (event: AgentEvent) => {
        // scenario_complete 이벤트에서 BTL 컨텍스트 캡처
        if (event.type === "scenario_complete") {
          capturedBtlCtx = {
            rfp: event.rfp,
            proposal: event.proposal,
            quote: event.quote,
            applied_card_ids: event.applied_card_ids,
          };
        }
        try {
          recorder?.record(event);
        } catch {
          // 레코딩 실패는 무시
        }
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // 클라이언트 연결 종료 등 — 이후 enqueue 중단
          closed = true;
        }
      };

      // C-BTL → runBtlAgent, 나머지 → runAgent
      const runPromise = btlPack
        ? runBtlAgent({ message, pack: btlPack, onEvent: emit, rfpOverride })
        : runAgent({ message, scenario: scenario!, onEvent: emit });

      void runPromise
        .catch((err) => {
          // runAgent 내부에서 error 이벤트를 발행하지만, 만일을 대비한 최종 가드
          emit({
            type: "status",
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        })
        .finally(async () => {
          try {
            const savedPath = await recorder?.save();
            // scenario_complete 가 캡처되었고 골든런이 저장된 경우,
            // 패턴카드를 추출해 JSONL 끝에 추가한다.
            if (savedPath && capturedBtlCtx) {
              try {
                const card = btl_extract_pattern_card(capturedBtlCtx);
                await appendPatternCardToRun(savedPath, card);
                // 패턴카드 mint 완료 이벤트 — 스트림이 아직 열려 있을 때만
                if (!closed) {
                  emit({ type: "pattern_card_minted", card });
                }
              } catch {
                // 패턴카드 추가 실패는 골든런에 영향을 주지 않는다
              }
            }
          } catch {
            // 저장 실패는 무시
          }
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              // 이미 닫혔으면 무시
            }
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
