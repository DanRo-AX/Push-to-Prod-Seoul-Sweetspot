// 생성 이미지 로컬 저장 — 서버 전용. 앱이 로컬에서 도므로 서버가 이미지를 받아 디스크에 쓴다.
// 기본 저장 위치: ~/Downloads/octopus-visuals (없으면 <project>/generated 로 폴백).
// SSRF 방지로 Higgsfield 출력 호스트(cloudfront/higgsfield)만 허용. 실패는 null(호출처가 무시).

import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function allowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.endsWith(".cloudfront.net") || h.endsWith(".higgsfield.ai") || h === "higgsfield.ai";
}

/** 저장 디렉터리 — ~/Downloads/octopus-visuals 우선, 실패 시 <cwd>/generated. */
export async function visualsDir(): Promise<string> {
  const preferred = path.join(os.homedir(), "Downloads", "octopus-visuals");
  try {
    await mkdir(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = path.join(process.cwd(), "generated");
    await mkdir(fallback, { recursive: true });
    return fallback;
  }
}

const extFromType = (ct: string): string =>
  ct.includes("png") ? ".png"
  : ct.includes("jpeg") || ct.includes("jpg") ? ".jpg"
  : ct.includes("webp") ? ".webp"
  : ct.startsWith("video/") ? ".mp4"
  : "";

/** 버퍼(코드로 합성한 카드 등) → 로컬 파일로 저장. 절대 경로 반환(실패 시 null). */
export async function saveBufferLocally(
  buf: Buffer,
  baseName: string,
  ext = ".png",
): Promise<string | null> {
  try {
    const dir = await visualsDir();
    const safe = (baseName.replace(/[^\w.\-가-힣]/g, "_").slice(0, 50) || "card");
    const fp = path.join(dir, `${safe}-${Date.now().toString(36)}${ext}`);
    await writeFile(fp, buf);
    return fp;
  } catch {
    return null;
  }
}

/** 이미지 URL → 로컬 파일로 저장. 절대 경로 반환(실패 시 null). */
export async function saveImageLocally(url: string, baseName?: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !allowedHost(u.hostname)) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    const dir = await visualsDir();
    const seg = (u.pathname.split("/").pop() || "visual").replace(/[^\w.\-]/g, "_");
    const ext = /\.\w+$/.test(seg) ? "" : extFromType(res.headers.get("content-type") || "");
    const prefix = baseName ? `${baseName.replace(/[^\w.\-가-힣]/g, "_")}-` : "";
    const fp = path.join(dir, `${prefix}${seg}${ext}`);
    await writeFile(fp, buf);
    return fp;
  } catch {
    return null;
  }
}
