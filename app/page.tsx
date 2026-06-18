"use client";

// 로그인 페이지 (/) — 마케팅 랜딩을 대체하는 화이트 미니멀 로그인.
// 은은한 오로라 바탕(.login-wrap::before) 위에 떠 있는 중앙 글래스 카드(.login-card).
//   · 브랜드 로고 + 짧은 소개
//   · 이메일 / 비밀번호 입력(.login-input) — 데모용, 검증/백엔드 없음
//   · [로그인] (.login-btn) · [데모로 둘러보기] — 둘 다 useRouter 로 /console 이동
// 인증 백엔드 없음 · 하드 가드 없음(어떤 입력이든 콘솔로 진입). "데모" 명시.
// 다크/네온 금지 — ChatGPT 순백 미니멀. prefers-reduced-* 폴백은 globals.css 소관.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo, OCTOPUS_VERSION } from "@/components/Logo";

const MONO = "font-[family-name:var(--font-geist-mono)]";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 데모 로그인 — 입력값과 무관하게 콘솔로 진입(검증/백엔드/가드 없음).
  const enterConsole = () => router.push("/console");
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    enterConsole();
  };

  return (
    <main className="login-wrap text-[var(--text-1)]">
      <div className="login-card anim-rise">
        {/* 브랜드 */}
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark />
          <div>
            <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--text-1)]">
              octopus 콘솔에 로그인
            </h1>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">
              마케팅 업무를 지시하면 에이전트가 단계별로 실행합니다.
            </p>
          </div>
        </div>

        {/* 데모 안내 — 인증 없음 명시 */}
        <div className="mt-5 flex items-center gap-2 rounded-[10px] border border-[var(--line-1)] bg-[var(--bg-1)] px-3 py-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
          <p className="text-[12px] leading-snug text-[var(--text-2)]">
            데모입니다 — 아무 값이나 입력하거나 그냥 둘러보기로 진입할 수 있습니다.
          </p>
        </div>

        {/* 로그인 폼 — 데모용(검증/백엔드 없음) */}
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={`${MONO} text-[10px] font-semibold tracking-[0.16em] text-[var(--text-3)]`}>
              이메일
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="login-input"
              aria-label="이메일"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={`${MONO} text-[10px] font-semibold tracking-[0.16em] text-[var(--text-3)]`}>
              비밀번호
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="login-input"
              aria-label="비밀번호"
            />
          </label>

          <button type="submit" className="login-btn btn-press mt-1">
            로그인
          </button>
        </form>

        {/* 데모로 둘러보기 — 입력 없이 바로 콘솔로 */}
        <div className="mt-3 flex items-center gap-3">
          <span aria-hidden className="h-px flex-1 bg-[var(--line-1)]" />
          <span className={`${MONO} text-[10px] tracking-[0.16em] text-[var(--text-3)]`}>
            또는
          </span>
          <span aria-hidden className="h-px flex-1 bg-[var(--line-1)]" />
        </div>
        <button
          type="button"
          onClick={enterConsole}
          className="btn-press mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--line-1)] py-[11px] text-[14px] font-medium text-[var(--text-1)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          데모로 둘러보기
          <span aria-hidden>→</span>
        </button>

        {/* 푸터 — 버전 */}
        <p className={`mt-6 text-center text-[10px] ${MONO} tracking-[0.16em] text-[var(--text-3)]`}>
          OCTOPUS · {OCTOPUS_VERSION}
        </p>
      </div>
    </main>
  );
}

// 카드 상단 로고 — Link 없이 마크만(이미 로그인 화면이므로 이동 불필요).
function BrandMark() {
  return (
    <span className="text-[var(--text-1)]">
      <Logo withWordmark className="text-[22px]" />
    </span>
  );
}
