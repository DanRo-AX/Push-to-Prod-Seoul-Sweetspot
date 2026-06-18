// POST /api/approve — 콜드메일 발송 승인/거부 회신
// body: { approvalId: string; approved: boolean }
// /api/agent 와 같은 Node 프로세스에서 동작해야 한다 (approvals 레지스트리가 모듈 레벨 Map).

import { resolveApproval } from "@/lib/agent/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { approvalId?: unknown; approved?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const { approvalId, approved } = body;
  if (typeof approvalId !== "string" || typeof approved !== "boolean") {
    return Response.json({ ok: false }, { status: 400 });
  }

  const ok = resolveApproval(approvalId, approved);
  return Response.json({ ok });
}
