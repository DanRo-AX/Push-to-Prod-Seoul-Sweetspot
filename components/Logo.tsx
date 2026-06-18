// components/Logo.tsx — octopus 브랜드 마크 + 워드마크.
// 사용처: 랜딩 Nav/Footer, 콘솔 셸, 빈 상태(엠티스테이트).
// 크기는 부모 font-size로 제어: <Logo className="text-[17px]" />
// 마크 컨셉: 중심점 1개(사람의 판단 — 버밀리언) + 궤도 위 8개 점(여덟 개의 팔 — 잉크).
// 궤도 팔은 부모 color(currentColor)로 제어, 중심점만 액센트 토큰 고정. 마크 회전·애니메이션 금지.

/** 제품 버전 라벨 — 단일 출처. 랜딩 Footer 와 콘솔 셸은 반드시 이 상수를 import 해
 *  표기한다 (예: `OCTOPUS · ${OCTOPUS_VERSION}`). 버전 문자열을 각 파일에 하드코딩 금지. */
export const OCTOPUS_VERSION = "v2.0";
export function Logo({
  withWordmark = true,
  className = "",
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-[0.45em] ${className}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="h-[1.2em] w-[1.2em] shrink-0"
      >
        {/* 중심점 — 사람의 판단. 버밀리언 단일 액센트로 고정. */}
        <circle cx="12" cy="12" r="2.5" fill="var(--accent)" />
        {/* 궤도 8점 — 여덟 개의 팔. 잉크(currentColor), 12시부터 시계방향으로 페이드. */}
        <circle cx="12" cy="4" r="1.3" fill="currentColor" />
        <circle cx="17.66" cy="6.34" r="1.3" fill="currentColor" opacity="0.85" />
        <circle cx="20" cy="12" r="1.3" fill="currentColor" opacity="0.68" />
        <circle cx="17.66" cy="17.66" r="1.3" fill="currentColor" opacity="0.52" />
        <circle cx="12" cy="20" r="1.3" fill="currentColor" opacity="0.4" />
        <circle cx="6.34" cy="17.66" r="1.3" fill="currentColor" opacity="0.3" />
        <circle cx="4" cy="12" r="1.3" fill="currentColor" opacity="0.22" />
        <circle cx="6.34" cy="6.34" r="1.3" fill="currentColor" opacity="0.14" />
      </svg>
      {withWordmark && (
        <span className="font-semibold leading-none tracking-[-0.02em]">
          octopus
        </span>
      )}
    </span>
  );
}
