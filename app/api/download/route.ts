// GET /api/download?url=<이미지 URL>&name=<파일명> — 생성 이미지 다운로드 프록시.
// 브라우저는 교차출처 URL 의 download 속성을 무시하므로, 서버가 받아 Content-Disposition:
// attachment 로 흘려보낸다. SSRF 방지로 호스트를 Higgsfield 출력(cloudfront/higgsfield)으로 제한.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.endsWith(".cloudfront.net") || h.endsWith(".higgsfield.ai") || h === "higgsfield.ai";
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const target = reqUrl.searchParams.get("url");
  const name = (reqUrl.searchParams.get("name") || "octopus-visual").replace(/[^\w.\-가-힣]/g, "_");

  if (!target) return new Response("url 파라미터가 필요합니다", { status: 400 });
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("잘못된 url", { status: 400 });
  }
  if (parsed.protocol !== "https:" || !allowedHost(parsed.hostname)) {
    return new Response("허용되지 않은 호스트입니다(다운로드는 Higgsfield 출력만 지원).", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString());
  } catch {
    return new Response("원본 이미지를 가져오지 못했습니다", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(`원본 응답 오류 (HTTP ${upstream.status})`, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const ext = contentType.includes("png")
    ? ".png"
    : contentType.includes("jpeg") || contentType.includes("jpg")
      ? ".jpg"
      : contentType.includes("webp")
        ? ".webp"
        : contentType.startsWith("video/")
          ? ".mp4"
          : "";
  const filename = /\.\w+$/.test(name) ? name : `${name}${ext}`;

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
