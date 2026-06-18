// POST /api/replay — 골든 런을 원본 타이밍으로 SSE 재생 (데모 보험)
// body: { name?: string; speed?: number }
// /api/agent 와 동일한 와이어 포맷("data: <AgentEvent JSON>\n\n")이므로 UI는 구분 없이 소비한다.

import { loadGoldenRun } from "@/lib/replay/recorder";
import type { RecordedEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 단일 간격 상한 — 녹화본에 긴 공백이 있어도 무대에선 1.5초 이상 멈추지 않는다
const MAX_GAP_MS = 1500;

export async function POST(request: Request) {
  let name: string | undefined;
  let speed = 1;

  try {
    const body = (await request.json()) as { name?: string; speed?: number } | null;
    if (body && typeof body.name === "string" && body.name.trim().length > 0) {
      name = body.name.trim();
    }
    if (
      body &&
      typeof body.speed === "number" &&
      Number.isFinite(body.speed) &&
      body.speed > 0
    ) {
      speed = body.speed;
    }
  } catch {
    // body 가 비어있거나 JSON 이 아니면 기본값(최신 런, 1배속)으로 재생
  }

  let recorded: RecordedEvent[];
  try {
    recorded = await loadGoldenRun(name);
  } catch {
    return Response.json(
      { error: "골든 런 파일을 찾을 수 없습니다", name: name ?? null },
      { status: 404 },
    );
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const stop = () => {
        stopped = true;
        clearTimer();
      };

      // 클라이언트 disconnect → 남은 타이머 정리
      request.signal.addEventListener("abort", stop, { once: true });

      let index = 0;

      const schedule = (gapMs: number) => {
        const delay = Math.min(Math.max(gapMs, 0) / speed, MAX_GAP_MS);
        timer = setTimeout(sendNext, delay);
      };

      const sendNext = () => {
        timer = null;
        if (stopped || request.signal.aborted) return;

        const current = recorded[index];
        index += 1;

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(current.event)}\n\n`),
          );
        } catch {
          // 컨트롤러가 이미 닫혔으면 (disconnect 등) 조용히 종료
          stop();
          return;
        }

        if (index >= recorded.length) {
          stopped = true;
          try {
            controller.close();
          } catch {
            // 이미 닫힘
          }
          return;
        }

        schedule(recorded[index].atMs - current.atMs);
      };

      if (recorded.length === 0) {
        try {
          controller.close();
        } catch {
          // 이미 닫힘
        }
        return;
      }

      // 첫 이벤트도 녹화된 atMs 만큼 기다렸다가 송출 (상한 동일 적용)
      schedule(recorded[0].atMs);
    },

    cancel() {
      // reader 측 취소 (클라이언트 disconnect) 시에도 타이머 정리
      stopped = true;
      clearTimer();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
