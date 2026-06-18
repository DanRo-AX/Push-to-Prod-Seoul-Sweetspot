// 대시보드 recharts 공용 테마 상수 — ChatGPT 순백 미니멀 라이트.
// recharts 는 SVG/스타일 속성에 var() 를 안정적으로 지원하지 않아 globals.css 토큰 값을
// 리터럴로 미러링한다. 아래 값은 :root 토큰과 1:1 로 동기화되어야 한다.
//   bg-1 #ffffff (카드/툴팁 표면) · line-1 rgba(0,0,0,0.10) · line-2 rgba(0,0,0,0.06)
//   text-1 #0d0d0d · text-2 #5d5d5d · text-3 #8e8e8e
//   accent(버밀리언) #d9472a · ok(딥그린) #2f8f57 · warn(오커) #b8791f · ink #0d0d0d
// 단일 액센트 원칙상 차트의 두 번째 계열은 보라/시안 대신 오커·딥그린·잉크로 구분한다.

// 툴팁 — 흰 카드(들린 표면) + 잉크 텍스트 + 헤어라인 + 옅은 회색 그림자
export const TOOLTIP_STYLE = {
  background: "#ffffff", // --bg-0
  border: "1px solid rgba(0,0,0,0.10)", // --line-1
  borderRadius: 10,
  color: "#0d0d0d", // --text-1
  fontSize: 13,
  boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)", // --shadow-card
} as const;

export const TOOLTIP_LABEL_STYLE = { color: "#0d0d0d" } as const; // --text-1

export const AXIS_TICK = { fill: "#8e8e8e", fontSize: 12 } as const; // --text-3

export const GRID_STROKE = "rgba(0,0,0,0.06)"; // --line-2

export const LEGEND_STYLE = { fontSize: 13, color: "#5d5d5d" } as const; // --text-2

// BarChart hover 커서 — 잉크 알파 미세 음영(흰 종이 위에서 자연스럽게 가라앉음)
export const CURSOR_FILL = "rgba(0,0,0,0.05)" as const;

export const COLOR = {
  accent: "#d9472a", // --accent (버밀리언)
  accentBright: "#b8381f", // --accent-hover (더 진한 버밀리언)
  ok: "#2f8f57", // --ok (딥그린)
  warn: "#b8791f", // --warn (오커)
  ink: "#5d5d5d", // --text-2 (중립 잉크 — 시안 대체)
} as const;
