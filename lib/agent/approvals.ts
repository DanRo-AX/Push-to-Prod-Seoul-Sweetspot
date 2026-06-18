// 승인 대기 레지스트리 (human-in-the-loop 게이트)
//
// 주의: 모듈 레벨 Map 은 로컬 `next dev` 단일 프로세스 전제다.
// /api/agent (대기) 와 /api/approve (회신) 가 같은 Node 프로세스를 공유해야 동작한다.
// 서버리스/멀티 인스턴스 배포 시에는 Redis 등 외부 저장소로 교체해야 한다.

import { randomUUID } from "node:crypto";
import type {
  ApprovalRequest,
  ColdEmail,
  InstagramPublishDraft,
} from "@/lib/types";

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000; // 5분 — 무응답 시 거부로 처리 (안전 기본값)

interface PendingApproval {
  resolve: (approved: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingApproval>();

/**
 * 승인 요청을 등록한다 (공통 코어).
 * 반환된 promise 는 resolveApproval() 호출 시 또는 5분 타임아웃 시(false) resolve 된다.
 */
function register(request: ApprovalRequest): {
  request: ApprovalRequest;
  promise: Promise<boolean>;
} {
  const promise = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(request.id);
      resolve(false); // 타임아웃 = 거부
    }, APPROVAL_TIMEOUT_MS);
    pending.set(request.id, { resolve, timer });
  });
  return { request, promise };
}

/** 콜드메일 발송 승인 요청 생성. */
export function createApproval(emails: ColdEmail[]) {
  return register({ id: randomUUID(), kind: "cold_emails", emails });
}

/** 인스타그램 발행 승인 요청 생성. */
export function createInstagramApproval(post: InstagramPublishDraft) {
  return register({ id: randomUUID(), kind: "instagram_publish", post });
}

/**
 * 대기 중인 승인을 회신한다.
 * @returns 해당 id 의 대기 건이 존재해 처리됐으면 true, 없으면(만료/중복 회신) false
 */
export function resolveApproval(id: string, approved: boolean): boolean {
  const entry = pending.get(id);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(id);
  entry.resolve(approved);
  return true;
}
