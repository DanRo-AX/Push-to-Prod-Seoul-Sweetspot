// 콜드메일 발송 안전장치 (코드 레벨 가드)
//
// 이 함수가 애플리케이션 전체에서 "유일한" 메일 발송 경로다.
// 다른 어떤 모듈도 직접 메일을 보내서는 안 된다 — 발송이 필요하면 반드시 이 함수를 거친다.
//
// 동작 규칙:
// - OCTOPUS_EMAIL_WHITELIST (쉼표 구분 이메일 목록) 에 수신자가 포함된 경우에만 "실발송" 경로.
// - 화이트리스트가 비어 있으면 무조건 mock 발송.
// - 화이트리스트에 없는 수신자도 mock 발송 — 데모 중 실수로 외부에 메일이 나가는 일을 코드 레벨에서 차단한다.

import type { ColdEmail } from "@/lib/types";

function getWhitelist(): string[] {
  return (process.env.OCTOPUS_EMAIL_WHITELIST ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export async function sendColdEmail(
  email: ColdEmail,
): Promise<{ sent: boolean; mock: boolean }> {
  const whitelist = getWhitelist();
  const isWhitelisted =
    whitelist.length > 0 && whitelist.includes(email.to.trim().toLowerCase());

  if (isWhitelisted) {
    // 실발송 경로 — 화이트리스트에 등록된 수신자만 도달 가능.
    // TODO: Gmail API 연동 (현재는 데모용 콘솔 로그로 대체)
    console.log(
      `[octopus][REAL SEND] to=${email.to} company=${email.company} subject="${email.subject}"`,
    );
    return { sent: true, mock: false };
  }

  // mock 발송 — 실제로는 아무 메일도 나가지 않는다.
  console.log(
    `[octopus][MOCK SEND] to=${email.to} company=${email.company} subject="${email.subject}"`,
  );
  return { sent: true, mock: true };
}
