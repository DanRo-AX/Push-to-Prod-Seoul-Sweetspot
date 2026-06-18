// components/ide/views/chart-theme-dark.ts — IDE 다크 뷰 전용 recharts 테마.
//
// 대시보드 흰 페이지(chart-theme.ts)는 라이트 톤이라 .ide-view 다크 면 위에서 축/그리드가
// 안 보인다. 여기서는 동일 역할의 상수를 VS Code "Dark Modern" 톤으로 미러링한다.
// recharts 는 SVG 속성에 var() 를 안정적으로 받지 못해 토큰 값을 리터럴로 둔다.
//   축/그리드는 밝게(가독), 면색은 절제된 ide 액센트/청록/앰버. 라이트 테마와 동일 구조.

// 툴팁 — 다크 들린 표면 + 헤어라인 + 강한 그림자(VS Code 호버 카드 톤).
export const D_TOOLTIP_STYLE = {
  background: "#252526",
  border: "1px solid #3c3c3c",
  borderRadius: 8,
  color: "#cccccc",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
} as const;

export const D_TOOLTIP_LABEL_STYLE = { color: "#ffffff" } as const;

// 축 눈금 — 흐린 메타색이지만 다크 면에서 또렷하게(--ide-text-dim).
export const D_AXIS_TICK = { fill: "#9d9d9d", fontSize: 11 } as const;

// 그리드/축선 — 또렷한 경계(--ide-border-strong) 보다 한 단계 가라앉게.
export const D_GRID_STROKE = "#3a3a3a";

export const D_LEGEND_STYLE = { fontSize: 12, color: "#9d9d9d" } as const;

// BarChart hover 커서 — 밝은 알파(다크 면 위 자연스러운 강조).
export const D_CURSOR_FILL = "rgba(255,255,255,0.05)" as const;

// 계열 색 — VS Code 토큰 계열(절제). 차트의 주 계열은 블루 액센트.
export const D_COLOR = {
  accent: "#4ea0ff", // --ide-accent-bright 계열(다크 면에서 또렷한 블루)
  ok: "#4ec9b0", // --ide-ok (청록)
  warn: "#cca700", // --ide-warn (앰버)
  ink: "#9d9d9d", // --ide-text-dim (중립)
} as const;
