// lib/agent/btl-personas.ts — back-compat 재노출 shim.
//
// 페르소나 단일 레지스트리는 lib/agent/personas.ts 로 통합됐다(검토팀 직무 + OASIS 방문객).
// 기존 import 경로(btl-personas)를 깨지 않게 role 페르소나·헬퍼를 그대로 재노출한다.
// 신규 코드는 @/lib/agent/personas 를 직접 쓴다.

import {
  ROLE_PERSONAS,
  personasForSlot as personasForSlotImpl,
  personaById,
  PERSONA_DND,
  type Persona,
  type RoleKey,
} from "@/lib/agent/personas";
import type { WorkflowSlotId } from "@/lib/ide/workflow";

export type BtlPersona = Persona;
export type BtlPersonaRole = RoleKey;

/** 검토팀(역할) 로스터 — 기존 이름 유지. */
export const BTL_PERSONAS: Persona[] = ROLE_PERSONAS;

export function personasForSlot(slotId: WorkflowSlotId): Persona[] {
  return personasForSlotImpl(slotId);
}
export function btlPersona(id: string): Persona | undefined {
  return personaById(id);
}

/** 드래그 dataTransfer 타입(기존 이름 유지 = PERSONA_DND). */
export const BTL_PERSONA_DND = PERSONA_DND;
