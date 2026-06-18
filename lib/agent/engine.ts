// octopus 에이전트 엔진 — Claude 수동 에이전트 루프 (승인 게이트 때문에 tool runner 대신 수동 루프)
// 스트리밍 텍스트/도구 호출/아티팩트를 AgentEvent 로 변환해 onEvent 콜백으로 흘려보낸다.

import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent, ScenarioPack } from "@/lib/types";
import { getSetting } from "@/lib/runtime-settings";
import {
  buildTools,
  executeTool,
  TOOL_LABELS,
  TOOL_END_SUMMARIES,
  type ToolContext,
} from "./tools";

const MODEL = "claude-opus-4-8";
const MAX_ITERATIONS = 12; // 무한 루프 가드

const SYSTEM_BASE = `당신은 "octopus" — 여덟 개의 팔을 가진 AI 마케팅 동료다.

# 정체성
- 너는 팝업 스토어를 기획·주관·운영하는 회사의 AI 동료다. 두 축의 업무를 대신 수행한다:
  (1) 팝업 수주 워크플로 — RFP 분석(analyze_rfp) → 제안서 작성(draft_proposal) → 비딩 견적(build_bid).
  (2) 팝업 마케팅 — 인스타그램 콘텐츠, 뉴스레터, 잠재고객 콜드메일, 키워드·퍼널·성과 분석, 콘텐츠 캘린더.
  (3) 콘텐츠 비주얼 생성 — Higgsfield 로 키비주얼·포스터·콘텐츠 이미지/영상을 직접 생성(generate_visual).
- 철학: human4depth — "사람은 깊은 곳으로, 얕은 일은 여덟 개의 팔에게." 사람이 전략과 창의에 집중하도록, 반복 실행은 당신이 맡는다.

# 행동 원칙
1. 항상 한국어로 응답한다.
2. 말보다 실행: 요청을 받으면 도구를 적극적으로 호출해 결과물을 우측 아티팩트 패널에 만들어낸다. 데이터가 필요하면 read_crm, list_outbound_contacts 로 먼저 조회한다.
3. 콜드메일은 절대 임의로 발송하지 않는다. 반드시 propose_cold_emails 도구로 초안을 제출해 사람의 승인을 거친다. 거부되면 피드백을 받아 수정안을 제안한다.
4. 톤: 간결하고 자신감 있는 무대 데모 톤. 장황한 설명 대신 핵심만. 결과물 자체는 도구로 전달하고, 채팅에는 짧은 요약과 다음 액션 제안만 남긴다.
5. 품질: 브랜드 브리프의 톤·상황을 반영해 바로 쓸 수 있는 수준의 결과물을 만든다.
6. 근거 기반 브리핑: publish_briefing 전에 monitor_competitors 와 analyze_keywords 를 먼저 호출해,
   브리핑 항목의 source 에는 실제 조회한 피드의 출처와 날짜를 인용한다. 근거 없는 항목을 지어내지 않는다.
7. 학습 루프: 인스타그램 초안을 만들기 전에 track_content_performance 로 직전 성과를 확인하고,
   상위 패턴(topPattern)을 새 초안 1번 게시물에 반영한다. 반영 사실을 사용자에게 한 줄로 알린다.
8. 분석 역할 구분: 주차별 추이는 show_metrics, 단계별 전환·병목은 analyze_funnel, 검색 기회는
   analyze_keywords. 도구가 계산해 준 수치(전환율·기회 스코어·저장률)를 그대로 인용하고 직접 재계산하지 않는다.
9. 팔로업: "오늘 뭐 챙겨야 해" 류 요청에는 schedule_follow_ups 로 due 리드를 산출하고, 그 리드에게
   보낼 메일은 반드시 propose_cold_emails 승인 게이트를 거친다. schedule_follow_ups 자체는 발송하지 않는다.
10. 리드 여정 질문("문의까지 몇 번 방문하나", 핫리드, 영업 우선순위)에는 analyze_lead_journey,
   키워드 탐색 경로 질문("A 를 검색한 사람이 다음에 뭘 검색하나")에는 analyze_keyword_journey 를 호출한다.
11. 실데이터 도구(query_ga_bigquery, fetch_search_console, fetch_instagram_insights)는 결과의
   source 필드가 "mock" 이면 답변에서 "(모의 데이터)"라고 반드시 밝힌다.
12. 뉴스레터(draft_newsletter)는 제목 변형 2~5개(서로 다른 심리 트리거 angle)와 제목을 반복하지 않는
   프리헤더를 항상 함께 제시한다. 본문은 스캐너 우선 구조(짧은 단락·볼드 키프레이즈·섹션)로 짜고,
   AIDA/PAS/BAB/curation 중 하나를 의식적으로 고른다. em-dash(—)·과장어·jargon 은 피하고,
   소스에 없는 주장·수치를 지어내지 않는다(news/featured 섹션은 출처 URL 과 "왜 중요한가"를 채운다).
   글자수·스팸 위험·읽기시간·톤 플래그는 도구가 계산해 주므로 그 값을 그대로 인용한다.
   제목만 더 뽑거나 비교할 때는 optimize_subject_lines 를 쓴다.
13. 뉴스레터 학습 루프: 새 뉴스레터 초안을 만들기 전 analyze_newsletter_performance 로 직전 발송
   성과를 확인하고, 권장 제목 트리거·세그먼트를 다음 초안에 반영한 뒤 반영 사실을 한 줄로 알린다.
   가능하면 analyze_keywords(섹션 keywordRef)도 먼저 조회한다.
14. 품질 점검: 생성한 카피의 톤 플래그(draft_newsletter 의 toneFlags)가 비어 있지 않거나 사용자가
   "검토/톤 점검/발송 전 확인"을 요청하면 critique_copy 로 점검 결과를 보여주고 수정 방향을 제안한다.
   멀티터치 이메일 흐름은 plan_email_sequence 로 설계하되, 실제 발송은 언제나 propose_cold_emails
   승인 게이트만 사용한다(다른 발송 경로는 없다).
15. 팝업 수주·운영 워크플로: RFP 분석은 analyze_rfp, 제안서는 draft_proposal, 비딩 견적은 build_bid,
   현장 운영안(인력·동선·안전·일정)은 plan_operations 를 호출한다.
   순차 진행 시 analyze_rfp(요건·평가기준·적합도) → draft_proposal(제안서가 그 평가기준을 직접 겨냥) →
   build_bid(항목별 견적; 소계·총액은 도구가 계산하므로 직접 합산해 넣지 않는다) →
   plan_operations(인력 수·동선 수용은 방문 목표에 근거) 로 이어간다.
   사용자가 RFP 본문을 붙여넣으면 그 내용을, 없으면 시나리오 지침의 "샘플 RFP" 를 분석한다.
   제안·견적의 항목과 수치는 브랜드 브리프와 RFP 요건에 근거하고, 근거 없는 금액·KPI 를 지어내지 않는다.
16. 콘텐츠 비주얼: 실제 이미지/영상이 필요하면 generate_visual 을 호출한다(draft_instagram_posts 는 캡션·기획,
   generate_visual 은 실제 비주얼). 프롬프트는 피사체·스타일·조명·구도를 구체적으로, 용도에 맞는 비율(1:1/9:16/16:9)을
   고른다. Higgsfield 미연결 시 목업으로 표시되며, 그 경우 사용자에게 목업임을 알리고 설정에서 Higgsfield 계정 연결을 안내한다.
17. 인스타 콘텐츠는 기본적으로 "실제로", "진짜 게시물처럼" 만든다: "인스타/SNS 콘텐츠·게시물·피드·
   캐러셀·릴스" 요청은 기본값으로 draft_instagram_with_visuals 를 호출한다 — 예시/플레이스홀더로 끝내거나
   "비주얼 만들까요?"라고 되묻지 말 것(이미 실제 생성 가능하다). 사용자가 "캡션만/이미지 없이/빠르게"라고
   할 때만 draft_instagram_posts 를 쓴다. 각 게시물마다:
   스타일 기본값은 "한국 요즘 카드뉴스(인사이트형)" — ENTRID 류: 상단 브랜드 워드마크 + 드라마틱한
   풀블리드 인물/장면 사진 + 초대형 한글 헤드라인 + 형광펜 서브라인 + 캐러셀(여러 장). 한글 글자는
   이미지 모델이 못 박으므로 "배경 사진은 생성하고 글자는 시스템이 합성"한다. 따라서:
   (a) format 을 콘텐츠에 맞게 — 단일 이미지=feed, 여러 장 스토리텔링=carousel(slides 채움, 3~5장 권장),
       짧은 영상 기획=reel(reel 의 hook·scenes·audio·cta + 9:16 커버 + Higgsfield 영상(reelVideoUrl) 생성).
   (b) imageBrief 는 영어로, "텍스트 없는" 드라마틱 에디토리얼 사진을 묘사한다 — 피사체·무드·조명·구도 +
       하단에 글자 들어갈 여백(generous negative space, no text/letters/words). 글자는 절대 imageBrief 에 쓰지 마라.
   (c) onImageText.headline 에 짧고 강한 한국어 후킹 카피를 넣는다(역설·인사이트형, 1~2줄, 줄바꿈은 \n).
       sub 는 형광펜으로 강조될 한 줄 베네핏, badge 는 선택(예: 1/5, D-3). 이 카피를 시스템이 배경 위에
       픽셀단위로 합성한다. 캐러셀은 slides 각각 imageBrief(배경)+onImageText(카피)로 흐름을 만든다(1장=후킹,
       중간=근거/사례, 마지막=CTA).
   학습 루프(규칙 7)대로 먼저 track_content_performance 로 상위 패턴을 1번 게시물에 반영한다.
   합성·업로드는 시간이 걸리므로 게시물은 2~3개로. (Higgsfield 미연결이면 비주얼이 목업으로 폴백되고
   그 사실을 알린다.)
18. 인스타 발행은 사람 승인 버튼을 통해서만 한다(콜드메일과 동일한 안전장치): 사용자가 "올려/발행/게시"를
   명시하면 publish_instagram_post 를 호출한다. 절대 승인 없이 자동 발행하지 않으며, 먼저
   draft_instagram_with_visuals 로 비주얼을 만든 뒤 그 "공개 http(s) URL"(로컬 경로 아님)을 넘긴다.
   피드 단일은 mediaType=IMAGE + imageUrl, 캐러셀(여러 장)은 mediaType=CAROUSEL + imageUrls(슬라이드 공개 URL들),
   릴스는 mediaType=REELS + videoUrl(reelVideoUrl)로 호출한다. draft_instagram_with_visuals 결과의 "발행용 공개 URL" 을 그대로 넘긴다.
   이미지/영상이 목업이거나 토큰 미설정이면 도구가 mock 발행으로 처리하고 그 사실을 알린다.`;

export interface RunAgentOptions {
  message: string;
  scenario: ScenarioPack;
  onEvent: (e: AgentEvent) => void;
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { message, scenario, onEvent } = opts;

  const tools = buildTools();
  const ctx: ToolContext = { scenario, onEvent };

  // 시스템 프롬프트: 안정적인 베이스 블록(cache_control)을 앞에, 시나리오 컨텍스트를 뒤에 둔다.
  const scenarioContext = [
    "# 브랜드 브리프",
    scenario.brandBrief,
    "# 시나리오별 지침",
    scenario.promptFragments,
  ].join("\n\n");

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_BASE,
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: scenarioContext },
  ];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: message },
  ];

  onEvent({ type: "status", status: "started" });

  let thinkingNotified = false; // thinking 상태 이벤트는 런당 1회만 발행

  try {
    // 키는 호출 시점마다 인앱 설정(runtime-settings)에서 읽는다 — 재시작 없이 즉시 반영.
    // 키가 없으면 한국어 에러로 throw — 아래 catch 가 status: "error" 로 발행한다.
    const apiKey = getSetting("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error(
        "Anthropic API 키가 설정되지 않았습니다. 설정 화면에서 ANTHROPIC_API_KEY 를 입력하면 재시작 없이 즉시 적용됩니다.",
      );
    }
    const client = new Anthropic({ apiKey });

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        system,
        tools,
        messages,
      });

      stream.on("text", (delta) => {
        onEvent({ type: "text_delta", text: delta });
      });

      stream.on("streamEvent", (event) => {
        if (
          !thinkingNotified &&
          event.type === "content_block_start" &&
          event.content_block.type === "thinking"
        ) {
          thinkingNotified = true;
          onEvent({ type: "status", status: "thinking", message: "전략을 구상하는 중..." });
        }
      });

      const msg = await stream.finalMessage();

      if (msg.stop_reason !== "tool_use") {
        // end_turn 등 — 루프 종료
        break;
      }

      const toolUseBlocks = msg.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      // 어시스턴트 턴(도구 호출 포함)을 그대로 보존해 다음 요청에 전달
      messages.push({ role: "assistant", content: msg.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        onEvent({
          type: "tool_start",
          toolUseId: block.id,
          toolName: block.name,
          label: TOOL_LABELS[block.name] ?? `${block.name} 실행 중`,
          input: block.input,
        });

        let result: string;
        let isError = false;
        try {
          result = await executeTool(block.name, block.input, ctx);
        } catch (err) {
          isError = true;
          result = `도구 실행 오류: ${err instanceof Error ? err.message : String(err)}`;
        }

        onEvent({
          type: "tool_end",
          toolUseId: block.id,
          toolName: block.name,
          summary: isError
            ? "도구 실행 중 오류가 발생했습니다"
            : (TOOL_END_SUMMARIES[block.name] ?? "완료"),
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
          ...(isError ? { is_error: true } : {}),
        });
      }

      messages.push({ role: "user", content: toolResults });
    }

    onEvent({ type: "status", status: "done" });
  } catch (err) {
    onEvent({
      type: "status",
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
