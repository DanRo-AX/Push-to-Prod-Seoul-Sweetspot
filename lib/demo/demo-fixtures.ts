"use client";

// lib/demo/demo-fixtures.ts — `?demo=1` 시연 모드 번들 fixture.
//
// 네이티브 파일창·느린 LLM 호출을 우회하기 위한 결정적 데이터:
//   · 작업 폴더 트리/보드(RFP + 기획안 카드) — 폴더 열기 우회.
//   · 군집 discuss 코멘트(P1/P3/P4) — 카드 드롭 우회(golden-discuss.json).
//   · 기획안 before→after 리뷰(0%→78%) — 군집 피드백 우회(golden-proposal-review.json).
// 모두 실제 LLM 출력을 한 번 캡처해 고정한 것(scenarios/C-btl/golden-*).

import type { Artifact, RfpDocument, AgentEvent } from "@/lib/types";
import type { FsNode } from "@/lib/fs-access";
import goldenRfp from "@/scenarios/C-btl/golden-rfp.json";
import goldenDiscuss from "@/scenarios/C-btl/golden-discuss.json";
import goldenReview from "@/scenarios/C-btl/golden-proposal-review.json";

export const DEMO_FOLDER_NAME = "달무드-팝업";
export const DEMO_PROPOSAL_FILE = "데모-기획안.md";

export const DEMO_PROPOSAL_MD = `# 달무드 「문라이트」 팝업 기획안 (제안용)

> 프로젝트: 달무드 첫 단독 팝업 「문라이트」 시향 전시
> 기간: 2026.06.24(수)~06.28(일) / 장소: 성수동 연무장길 단독 공간(약 40평)

## 1. 핵심 메시지
**"하루의 끝, 달이 뜨는 시간을 당신의 방으로."**
핸드포어드 캔들 달무드의 첫 오프라인 거점. '향'을 보고 손으로 붓는 경험으로 번역한다.

## 2. 컨셉 — 하룻밤의 동선
3개 라인을 하룻밤의 시간대로 공간화한다(초승→보름→그믐). 전체 톤은 정숙·감상 위주의 갤러리.
각 구간의 '한 컷'을 어디서 어떻게 담아 공유하게 할지는 별도 설계 없이 관람객 자율에 맡긴다.

## 3. 문라이트 시향 세션 (핵심 프로그램)
- 회당 6명, 25분, 3라인 순서 시향 + 미니 캔들 포어링 체험.
- 100% 사전 예약제 — 홈페이지 회원가입 후 예약. 워크인은 받지 않는다.
- 예약자 전원에게 「새벽 정원」 티라이트 증정.

## 4. 온라인 확산
- 공간·제품 키비주얼 + 60초 무드 영상. 인플루언서 초청, 후기 위탁.
- 관람객이 직접 만드는 콘텐츠(인증·릴스) 유인은 아직 없다.

## 5. 현장 한정
- 팝업 에디션 라벨(배치 번호·날짜 수기 기입). 현장 한정 판매·재방문 후크는 두지 않는다.

## 7. 성공 지표
- 시향 세션 예약 건수·참석률, 인플루언서 도달, 영상 조회수.
`;

/** demo 보드 — RFP 카드 + 기획안 카드. */
export const DEMO_ARTIFACTS: Artifact[] = [
  { kind: "btl_rfp", rfp: (goldenRfp as { rfp: RfpDocument }).rfp },
  { kind: "btl_doc_file", slotId: "proposal", name: DEMO_PROPOSAL_FILE, ext: "md" },
];

/** demo 폴더 트리(브라우즈 표시용 — 핸들은 표시 안 쓰므로 빈 캐스팅). */
const fakeHandle = {} as FileSystemFileHandle | FileSystemDirectoryHandle;
export const DEMO_TREE: FsNode[] = [
  { name: ".octopus", path: ".octopus", kind: "dir", ext: "", handle: fakeHandle, children: [
    { name: "board.json", path: ".octopus/board.json", kind: "file", ext: "json", handle: fakeHandle },
  ] },
  { name: "달무드-RFP.md", path: "달무드-RFP.md", kind: "file", ext: "md", handle: fakeHandle },
  { name: DEMO_PROPOSAL_FILE, path: DEMO_PROPOSAL_FILE, kind: "file", ext: "md", handle: fakeHandle },
];

/** 기획안 카드에 바인딩할 텍스트 핸들(getFile 만 제공 — 루프가 본문을 읽음). */
export function demoProposalHandle(): FileSystemFileHandle {
  return {
    getFile: async () => new File([DEMO_PROPOSAL_MD], DEMO_PROPOSAL_FILE, { type: "text/markdown" }),
  } as unknown as FileSystemFileHandle;
}

/** 군집 드롭 시 채팅에 흘릴 코멘트 이벤트(targetFile 부착). */
export function demoDiscussEvents(): AgentEvent[] {
  const cs = goldenDiscuss as { personaId: string; name: string; title: string; accent: string; text: string }[];
  return cs.map((c) => ({
    type: "persona_comment",
    personaId: c.personaId,
    name: c.name,
    title: c.title,
    accent: c.accent,
    text: c.text,
    targetFile: DEMO_PROPOSAL_FILE,
  }));
}

/** 기획안 before→after 리뷰(고정). card-sections 의 ContentReview 형태. */
export const DEMO_REVIEW = goldenReview as unknown;
