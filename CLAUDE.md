# CLAUDE.md — octopus 작업 컨벤션

이 리포에서 작업하는 AI 에이전트(및 사람)를 위한 규칙. 프로젝트 개요는 README.md 참고.

## 1. 공유 타입: `lib/types.ts` 가 단일 계약

- 엔진(서버) ↔ UI(클라이언트) ↔ 시나리오 팩은 **모두 `lib/types.ts` 를 기준으로 통신**한다.
- 사용할 때는 항상 `import type { ... } from "@/lib/types"` 로 import 한다. 동일한 타입을
  다른 파일에 재정의하지 않는다.
- 이 파일을 수정해야 한다면 **엔진(`lib/agent/`, `app/api/`)과 UI(`components/`, `app/page.tsx`)를
  같은 변경에서 함께 수정**해야 한다. 한쪽만 고치면 SSE 프로토콜이 깨진다.

## 2. 모델 호출 규칙

- 모델은 **`claude-opus-4-8`** 고정, thinking 은 **`{ type: "adaptive" }`** (adaptive thinking).
- **`temperature` / `top_p` / `top_k` 사용 금지** — 이 모델에서는 400 에러를 반환한다.
  `budget_tokens` 방식 extended thinking 도 금지(동일하게 400).
- SDK 는 `@anthropic-ai/sdk` 만 사용한다. fetch 로 직접 API 를 때리지 않는다.
- API 키는 env 또는 `data/runtime-settings.json`(인앱 설정) — `lib/runtime-settings.ts` 의
  `getSetting` 경유로만 읽는다.

## 3. 콜드메일 발송 경로

- 이메일 발송은 **반드시 `lib/agent/email.ts` 의 화이트리스트 경로만** 사용한다.
  다른 곳에서 발송 로직을 새로 만들거나 우회 경로를 추가하지 않는다.
- `OCTOPUS_EMAIL_WHITELIST` 에 없는 수신자는 무조건 mock 발송. 환경변수가 비어 있으면
  **항상 mock** 이다. 이 안전장치를 약화시키는 변경은 금지.
- 발송 전에는 항상 승인 게이트(`approval_required` → `/api/approve`)를 거친다.

## 4. UI 텍스트 · 아트 디렉션

- 사용자에게 보이는 모든 UI 텍스트는 **한국어**. 코드 주석도 한국어 가능.
- 무대 발표용 앱이므로 **라이트 웜 에디토리얼 테마**(페이퍼 바탕 `#f4efe6` + 잉크 블랙 +
  버밀리언 단일 액센트)를 유지한다 (`app/globals.css` 토큰 기준). 셸은 **상단 가로 내비**
  (좌측 사이드바 폐기). 디스플레이/큰 제목엔 **세리프(명조 — `--font-serif`)**.
  **네온·글로우·발광·보라/네온 다크 룩·좌측 사이드바 금지.** 그림자는 종이 그림자만.

## 5. 시나리오 데이터

- 브랜드/목 데이터는 코드에 하드코딩하지 않고 **`scenarios/<id>/` 팩 교체 방식**으로 다룬다.
  (`brand-brief.md`, `prompt-fragments.md`, `mock-ga.json`, `mock-crm.json`, `mock-contacts.json`,
  `mock-keywords.json`, `mock-journey.json`, `mock-post-performance.json`, `mock-mentions.json`,
  `mock-lead-journey.json`, `mock-keyword-journey.json`, `mock-attribution.json`,
  `mock-follower-growth.json`)
- 활성 시나리오는 `OCTOPUS_SCENARIO` 환경변수(`A-zero-to-one` | `B-rebrand`)로 선택한다.
  새 시나리오를 추가할 때는 `lib/types.ts` 의 `ScenarioId` 와 팩 디렉토리를 함께 추가한다.

## 6. 기타

- 경로 별칭: `@/*` = 리포 루트 (`tsconfig.json`).
- 스타일링: Tailwind CSS v4 (`app/globals.css` 의 `@import "tailwindcss"` 방식, 별도 config 없음).
- `data/golden-runs/*.jsonl` 은 git 에 커밋하지 않는다(`sample.jsonl` 제외) — `.gitignore` 참고.
