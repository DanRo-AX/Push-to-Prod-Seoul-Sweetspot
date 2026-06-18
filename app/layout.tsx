import type { Metadata } from "next";
import "./globals.css";

// 폰트(Geist / Geist Mono / Nanum Myeongjo)는 self-host 한다 — app/globals.css 의
// @font-face(public/fonts/*.woff2) + :root 의 --font-geist-sans/-mono/--font-serif.
// next/font/google 을 쓰지 않는 이유: 빌드 시 fonts.gstatic 네트워크 fetch 가 오프라인/
// 불안정 환경에서 빌드를 깨뜨린다(데모는 오프라인 동작이 원칙). self-host = 빌드 네트워크 무관.

export const metadata: Metadata = {
  title: "octopus — human4depth",
  description:
    "AI 마케팅 에이전트 octopus. 사람은 깊은 곳으로, 얕은 일은 여덟 개의 팔에게.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--bg-0)] text-[var(--text-1)]">
        {children}
      </body>
    </html>
  );
}
