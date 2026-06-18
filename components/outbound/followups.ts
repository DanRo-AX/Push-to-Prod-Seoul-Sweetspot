// 오늘의 팔로업 큐 — 클라이언트 계산 유틸.
// lib/agent/tools.ts 의 schedule_follow_ups 도구와 동일한 규칙을 사용한다:
//   new            → 즉시 due ("첫 콜드메일 대상")
//   contacted ≥ 3일 → due ("1차 팔로업"),        미만이면 upcoming (D-{3-경과})
//   replied   ≥ 4일 → due ("후속 제안 (협업 구체화)"), 미만이면 upcoming
//   meeting   ≥ 2일 → due ("미팅 리마인드"),      미만이면 upcoming
//   won            → 제외
// 규칙을 바꿀 때는 tools.ts 쪽과 반드시 함께 바꾼다.

import type { CrmLead } from "@/lib/types";

export interface FollowUpItem {
  name: string;
  company: string;
  email: string;
  stage: CrmLead["stage"];
  score: number;
  daysSinceLastTouch: number;
  action: string;
  dueInDays?: number; // upcoming 전용 — 며칠 후 due 인지
}

export interface FollowUpQueue {
  due: FollowUpItem[];
  upcoming: FollowUpItem[];
}

export function computeFollowUps(
  leads: CrmLead[],
  asOfDate: Date = new Date(),
): FollowUpQueue {
  const due: FollowUpItem[] = [];
  const upcoming: FollowUpItem[] = [];

  for (const lead of leads) {
    if (lead.stage === "won") continue; // 성사 리드는 제외

    const daysSince = Math.floor(
      (asOfDate.getTime() - new Date(lead.lastTouch).getTime()) / 86400000,
    );
    const base = {
      name: lead.name,
      company: lead.company,
      email: lead.email,
      stage: lead.stage,
      score: lead.score,
      daysSinceLastTouch: daysSince,
    };

    if (lead.stage === "new") {
      due.push({ ...base, action: "첫 콜드메일 대상" });
    } else if (lead.stage === "contacted") {
      if (daysSince >= 3) due.push({ ...base, action: "1차 팔로업" });
      else upcoming.push({ ...base, action: "1차 팔로업", dueInDays: 3 - daysSince });
    } else if (lead.stage === "replied") {
      if (daysSince >= 4) due.push({ ...base, action: "후속 제안 (협업 구체화)" });
      else
        upcoming.push({
          ...base,
          action: "후속 제안 (협업 구체화)",
          dueInDays: 4 - daysSince,
        });
    } else if (lead.stage === "meeting") {
      if (daysSince >= 2) due.push({ ...base, action: "미팅 리마인드" });
      else upcoming.push({ ...base, action: "미팅 리마인드", dueInDays: 2 - daysSince });
    }
  }

  // 표시 정렬(규칙 무관): due 는 오래 방치된 순, upcoming 은 임박한 순
  due.sort((a, b) => b.daysSinceLastTouch - a.daysSinceLastTouch);
  upcoming.sort((a, b) => (a.dueInDays ?? 0) - (b.dueInDays ?? 0));

  return { due, upcoming };
}

// 칸반·큐 공용 stage 한국어 라벨
export const STAGE_LABELS: Record<CrmLead["stage"], string> = {
  new: "신규",
  contacted: "컨택",
  replied: "회신",
  meeting: "미팅",
  won: "성사",
};
