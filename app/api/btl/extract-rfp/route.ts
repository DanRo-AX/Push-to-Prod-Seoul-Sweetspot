// POST /api/btl/extract-rfp — 업로드된 RFP 문서를 RfpDocument 로 추출한다.
// body: multipart/form-data, field "file"
// 응답: { rfp: RfpDocument } | { error: string }
//
// 처리:
//   · PDF        → base64 로 Claude 네이티브 document 블록(파싱 lib 없음)
//   · docx       → mammoth(동적 import)로 텍스트 추출
//   · txt/md/json/csv/그 외 텍스트 → UTF-8 디코드
// 키는 lib/runtime-settings 의 getSetting("ANTHROPIC_API_KEY") 경유(인앱 설정 즉시 반영).

import { extractRfpFromDocument } from "@/lib/agent/btl-extract-rfp";
import { getSetting } from "@/lib/runtime-settings";
import { rfpHash, readCachedRfp, writeCachedRfp } from "@/lib/agent/rfp-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "multipart/form-data 본문이 필요합니다." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file 필드가 필요합니다." }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "빈 파일입니다." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "파일이 너무 큽니다(최대 15MB)." }, { status: 400 });
  }

  const name = file.name || "rfp";
  const lower = name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  // 캐시 우선 — 동일 파일은 즉시 응답(키 없어도 캐시는 서빙). 추출은 ~70초로 느림.
  const hash = rfpHash(buf);
  const cached = readCachedRfp(hash);
  if (cached) return Response.json({ rfp: cached, cached: true });

  const apiKey = getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return Response.json(
      { error: "Anthropic API 키가 설정되지 않았습니다. 설정 화면에서 입력하세요." },
      { status: 400 },
    );
  }

  try {
    const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
    const isDocx =
      lower.endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    let rfp;
    if (isPdf) {
      rfp = await extractRfpFromDocument(
        { pdfBase64: buf.toString("base64"), filename: name },
        apiKey,
      );
    } else if (isDocx) {
      // mammoth 는 docx → 텍스트. 동적 import 로 PDF/텍스트 경로에는 로드되지 않게 한다.
      const mammoth = await import("mammoth").catch(() => null);
      if (!mammoth) {
        return Response.json(
          { error: "docx 추출 모듈(mammoth)이 없습니다. PDF 또는 텍스트(.md/.txt) 로 업로드하세요." },
          { status: 415 },
        );
      }
      const { value } = await mammoth.extractRawText({ buffer: buf });
      rfp = await extractRfpFromDocument({ text: value, filename: name }, apiKey);
    } else {
      // 텍스트류로 간주(txt/md/json/csv/기타) — UTF-8 디코드
      const text = buf.toString("utf-8");
      rfp = await extractRfpFromDocument({ text, filename: name }, apiKey);
    }

    writeCachedRfp(hash, rfp); // 다음부터 즉시
    return Response.json({ rfp });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "RFP 추출 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
