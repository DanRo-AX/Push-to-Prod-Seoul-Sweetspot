"use client";

// components/ide/PersonaCard.tsx — OASIS 오디언스 페르소나 렌더 컴포넌트.
//
// 우측 사이드패널(PersonaRail)이 보여 주는 "OASIS 오디언스 페르소나" 뷰의 표현 단위 둘:
//   · ArchetypeCard  — 한 아키타입(P1~P5)을 한 행으로: 타입칩 + 라벨 + 분포 막대 +
//                       n명/퍼센트 + 한 줄 설명. 클릭하면 그 유형의 표본을 드릴다운.
//   · SampleCard     — 개별 페르소나(표본): 이름·나이·직업·지역·월 방문 + 성향/페인
//                       포인트 칩 + (펼치면) 배경·의사결정. VS Code 리스트/카드 톤.
//
// 규칙(파운데이션 치트시트 그대로):
//   - 데이터/색/필터는 모두 @/lib/oasis 에서만 온다. 여기서는 마크업만 조립한다.
//   - 색은 archetypeColor(type) 를 인라인 `--arch` 변수로 .persona-* 에 주입한다
//     (globals.css 무수정 — 막대/칩/보더가 아키타입 색을 따른다).
//   - 이모지 금지. 아이콘은 codicon 글리프만. UI 텍스트는 한국어.

import { archetypeColor, percent, archetypeAvatar, personaAvatar, type OasisArchetype, type OasisPersona } from "@/lib/oasis";

// ── 아키타입 카드 ────────────────────────────────────────────────────
export interface ArchetypeCardProps {
  archetype: OasisArchetype;
  /** 드릴다운(표본 목록) 열림 여부. */
  expanded: boolean;
  /** 콘텐츠/리서치 도구가 도는 동안 관련 아키타입을 은은히 강조. */
  highlighted?: boolean;
  /** 오케스트레이터가 이 아키타입에게 "물어보는" 중 — 응답 중(글로우+펄스+칩). */
  responding?: boolean;
  /** 직전 응답이 막 끝남 — "완료"(체크) 칩을 잠깐 표시. */
  justDone?: boolean;
  onToggle: () => void;
}

/**
 * 아키타입 카드 — VS Code 사이드바 리스트 한 행.
 * [타입칩 P1~P5 + account 글리프] [라벨] [n명 · pp%] / 분포 막대 / 설명.
 * 클릭(또는 Enter/Space)으로 표본 드릴다운을 펼친다.
 *
 * 라이브 오케스트레이션: responding=응답 중(.persona-arch--responding + sync 스핀 칩),
 * justDone=막 완료(청록 check 칩). 둘 다 기존 active(드릴다운)/highlighted 와 독립.
 */
export function ArchetypeCard({
  archetype,
  expanded,
  highlighted,
  responding,
  justDone,
  onToggle,
}: ArchetypeCardProps) {
  const color = archetypeColor(archetype.type);
  const pct = percent(archetype.count);

  return (
    <div
      className={`persona-arch${highlighted ? " active" : ""}${responding ? " persona-arch--responding" : ""}`}
      style={{ ["--arch" as string]: color }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {/* 머리 행 — 타입칩 + 라벨 + 우측 수치(+ 응답/완료 칩) */}
      <div className="persona-arch-head">
        {/* eslint-disable-next-line @next/next/no-img-element -- 번들된 로컬 SVG 아바타(최적화 불필요) */}
        <img
          src={archetypeAvatar(archetype.type)}
          alt=""
          width={26}
          height={26}
          style={{
            borderRadius: "50%",
            objectFit: "cover",
            background: `${color}22`,
            flexShrink: 0,
          }}
        />
        <span className="persona-arch-chip" style={{ color }}>{archetype.type}</span>
        <span className="persona-arch-label">{archetype.label}</span>
        {responding ? (
          // 응답 중 — sync 스핀 칩(오케스트레이터의 질문에 답하는 중).
          <span className="persona-responding-chip" aria-label="응답 중">
            <i className="codicon codicon-loading codicon-modifier-spin" aria-hidden />
            응답 중
          </span>
        ) : justDone ? (
          // 막 완료 — 청록 check 칩(답을 돌려줬음).
          <span className="persona-responding-chip persona-responding-chip--done" aria-label="응답 완료">
            <i className="codicon codicon-check" aria-hidden />
            완료
          </span>
        ) : (
          <span className="persona-arch-stat">
            <b>{archetype.count}</b>명 · {pct}%
          </span>
        )}
        <i
          className={`codicon ${expanded ? "codicon-chevron-down" : "codicon-chevron-right"}`}
          style={{ fontSize: 14, color: "var(--ide-text-faint)", flexShrink: 0 }}
          aria-hidden
        />
      </div>

      {/* 분포 막대 — 트랙 위에 아키타입 색 채움(폭 = 퍼센트) */}
      <div className="persona-bar" aria-hidden>
        <span className="persona-bar-fill" style={{ ["--pct" as string]: `${pct}%` }} />
      </div>

      {/* 유형 한 줄 설명 */}
      <p className="persona-arch-desc">{archetype.desc}</p>
    </div>
  );
}

// ── 샘플(표본) 프로필 카드 ───────────────────────────────────────────
export interface SampleCardProps {
  persona: OasisPersona;
  /** 배경·의사결정까지 펼친 상태. */
  expanded: boolean;
  onToggle: () => void;
}

/**
 * 표본 프로필 카드 — 개별 페르소나 한 명.
 * 머리(이름·나이·성별 + 월 방문 칩) / 직업·지역 메타 / 성향 칩 / 페인포인트 칩 /
 * (펼치면) 의사결정·배경 한 줄. 클릭으로 펼침/접힘.
 */
export function SampleCard({ persona, expanded, onToggle }: SampleCardProps) {
  const color = archetypeColor(persona.type);

  return (
    <div
      className="persona-sample"
      style={{ ["--arch" as string]: color }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {/* 머리 — 노셔니스트 아바타 + 이름 + 나이·성별 + 우측 월 방문 칩 */}
      <div className="persona-sample-head">
        {/* eslint-disable-next-line @next/next/no-img-element -- 번들된 로컬 SVG 아바타(최적화 불필요) */}
        <img
          src={personaAvatar(persona)}
          alt=""
          width={28}
          height={28}
          style={{
            borderRadius: "50%",
            objectFit: "cover",
            background: `${color}1f`,
            flexShrink: 0,
          }}
        />
        <span className="persona-sample-name">{persona.name}</span>
        <span className="persona-sample-sub">
          {persona.age}세 · {persona.gender}
        </span>
        <span className="persona-sample-visits" title="월평균 팝업 방문">
          <i className="codicon codicon-calendar" aria-hidden />
          월 {persona.monthly_popup_visits}회
        </span>
      </div>

      {/* 직업 · 지역 메타 */}
      <div className="persona-sample-meta">
        <span>
          <i className="codicon codicon-briefcase" aria-hidden />
          {persona.occupation}
        </span>
        <span>
          <i className="codicon codicon-location" aria-hidden />
          {persona.location}
        </span>
      </div>

      {/* 성향 칩 */}
      {persona.personality_traits.length > 0 && (
        <div className="persona-chips">
          <span className="persona-chips-label">성향</span>
          {persona.personality_traits.map((t) => (
            <span className="persona-chip" key={t}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* 페인포인트 칩 */}
      {persona.key_pain_points.length > 0 && (
        <div className="persona-chips">
          <span className="persona-chips-label">페인포인트</span>
          {persona.key_pain_points.map((p) => (
            <span className="persona-chip persona-chip--pain" key={p}>
              <i className="codicon codicon-warning" aria-hidden />
              {p}
            </span>
          ))}
        </div>
      )}

      {/* 펼치면 — 의사결정 스타일 + 배경 한 줄 */}
      {expanded && (
        <>
          <p className="persona-sample-note">
            <i className="codicon codicon-lightbulb" aria-hidden />
            {persona.decision_style}
          </p>
          <p className="persona-sample-note">
            <i className="codicon codicon-note" aria-hidden />
            {persona.background}
          </p>
        </>
      )}
    </div>
  );
}
