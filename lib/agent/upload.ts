// 합성 카드(로컬 버퍼)를 공개 URL 로 호스팅 — 서버 전용.
// Instagram 발행 시 image_url 은 Instagram 서버가 직접 가져갈 수 있는 "공개 http(s)" 여야 한다.
// 로컬 파일/data-URI 는 발행 불가이므로, 합성한 카드를 공개 호스트에 올려 그 URL 을 쓴다.
//
// 데모용: tmpfiles.org (API 키 불필요, 임시 링크 ~1시간). 운영에서는 자체 스토리지/CDN(S3 등)으로
// 교체 권장. 실패 시 throw(호출처가 폴백/표기를 판단).

/**
 * 버퍼를 tmpfiles.org 에 올리고 직접 다운로드(공개) URL 을 반환한다.
 * @throws Error("UPLOAD_FAILED ...") | Error("UPLOAD_NO_URL")
 */
export async function uploadPublic(buf: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buf)], { type: "image/png" }), filename);
  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`UPLOAD_FAILED (HTTP ${res.status})`);
  const j = (await res.json()) as { data?: { url?: string } };
  const viewer = j.data?.url;
  if (!viewer) throw new Error("UPLOAD_NO_URL");
  // 뷰어 URL(https://tmpfiles.org/ABC/x.png) → 직접 다운로드 URL(https://tmpfiles.org/dl/ABC/x.png)
  return viewer.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
}
