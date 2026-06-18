// POST /api/btl/publish-instagram — 콘텐츠 카드에서 인스타 발행(콘텐츠 루프의 끝).
//
// ⚠️ 외부로 나가는 비가역 액션 — 호출부(콘텐츠 카드)가 승인 게이트를 먼저 거친다.
// 공개 http(s) 이미지(Higgsfield 생성물)만 실발행 가능. 목업(data-URI)·토큰 미설정이면 mock.
//
// body(JSON): { imageUrl: string, caption: string }
// 응답: InstagramPublishResult 형태 { caption, imageUrl, mock, permalink?, publishedAt, note? }

import { publishInstagramMedia } from "@/lib/agent/connectors";
import { getSetting } from "@/lib/runtime-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { imageUrl?: string; caption?: string };
  try { body = (await req.json()) as typeof body; }
  catch { return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 }); }

  const imageUrl = String(body.imageUrl || "");
  const caption = String(body.caption || "").trim();
  if (!caption) return Response.json({ error: "캡션이 필요합니다." }, { status: 400 });
  const now = new Date().toISOString();

  const token = getSetting("OCTOPUS_INSTAGRAM_ACCESS_TOKEN");
  const isPublic = /^https?:\/\//i.test(imageUrl);
  // 토큰 없음/목업 이미지 → mock(실발행 안 함). 데모 안전.
  if (!token || !isPublic) {
    return Response.json({
      caption, imageUrl, mock: true, publishedAt: now,
      note: !token ? "인스타 미연결 — mock 발행입니다(설정에서 토큰 연결)." : "목업 이미지는 발행 불가 — 먼저 실제 비주얼을 생성하세요.",
    });
  }

  try {
    const { mediaId, permalink } = await publishInstagramMedia({ caption, imageUrl, mediaType: "IMAGE" });
    return Response.json({ caption, imageUrl, mock: false, mediaId, permalink, publishedAt: now });
  } catch (err) {
    return Response.json({
      caption, imageUrl, mock: true, publishedAt: now,
      note: `발행 실패로 mock 처리 (${err instanceof Error ? err.message : "오류"}).`,
    });
  }
}
