"use client";

// components/ide/CommandPalette.tsx — VS Code quickInput(⌘P / ⌘⇧P) 정밀 복제.
//
// 두 가지 모드를 하나의 위젯으로 다룬다(VS Code 와 동일):
//   · 빠른 열기(⌘P)   — prefix "" : 열 수 있는 "파일"(산출물/뷰) 목록을 필터해서 연다.
//   · 명령 실행(⌘⇧P) — prefix ">" : 실행 가능한 "명령"(리플레이/뷰 열기/패널 토글 등)을 필터.
// 입력 첫 글자가 ">" 면 명령 모드, 아니면 빠른 열기 모드로 자동 전환된다(VS Code 동작).
//
// UX(정통):
//   · 상단 중앙에 떠 있는 패널(.ide-cmdpalette). 백드롭은 어둡게 깔지 않는다(VS Code).
//   · 입력(.ide-cmdpalette-input) + 결과 리스트(.ide-cmdpalette-list) + 행(.ide-cmd-row).
//   · ↑/↓ 로 이동(순환), Enter 실행, Esc 닫기, 마우스 hover/click 도 지원.
//   · 부분 문자열(서브시퀀스) 매칭 — VS Code 의 가벼운 fuzzy 느낌. 라벨/메타 동시 검색.
//   · 행 좌측 codicon(실제 VS Code 아이콘), 우측 메타(카테고리/단축키).
//
// 색/치수는 전부 globals.css 의 .ide-cmdpalette* / .ide-cmd-row 토큰을 따른다(하드코딩 금지).
// 키바인딩 등록(⌘P/⌘⇧P)은 셸이 담당하고, 이 컴포넌트는 open/mode/items 만 받아 렌더한다.

import { useEffect, useMemo, useRef, useState } from "react";

/** 팔레트 항목 — 파일(빠른 열기)·명령(실행) 공용 모델. */
export interface CommandItem {
  /** 안정 키. */
  id: string;
  /** 사용자에게 보이는 라벨(파일명 또는 명령 제목). */
  label: string;
  /** 좌측 codicon 글리프 이름(예: "markdown", "json", "play", "dashboard"). */
  icon: string;
  /** 우측 메타(카테고리·언어·단축키 등). */
  meta?: string;
  /** 검색 보조 키워드(라벨 외 추가 매칭 대상). */
  keywords?: string;
  /** 실행 동작. */
  run: () => void;
}

export type PaletteMode = "files" | "commands";

export interface CommandPaletteProps {
  /** 열림 여부 — 셸이 키바인딩으로 토글. */
  open: boolean;
  /** 초기 모드 — ⌘P=files, ⌘⇧P=commands. 입력 ">" 로 런타임 전환 가능. */
  initialMode: PaletteMode;
  /** 빠른 열기 대상(산출물/뷰 "파일"). */
  files: CommandItem[];
  /** 명령 실행 대상. */
  commands: CommandItem[];
  /** 닫기 요청(Esc·백드롭·실행 후). */
  onClose: () => void;
}

// ── 서브시퀀스 매칭(가벼운 fuzzy) ───────────────────────────────────
// query 의 각 문자가 순서대로 text 안에 나타나면 매치. 대소문자 무시.
function subseqMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({
  open,
  initialMode,
  files,
  commands,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  // 사용자가 선택한 행. 결과 범위를 벗어날 수 있으므로 읽을 때 클램프한다(별도 effect 불필요).
  const [rawActive, setRawActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 열림/모드 전환을 렌더 중 추적 — open=true 로 바뀌는 순간 입력/활성 행을 초기화한다.
  // (effect 안에서 setState 하지 않는 "prop 변화에 따른 state 조정" 권장 패턴.)
  const [prevOpenKey, setPrevOpenKey] = useState<string | null>(null);
  const openKey = open ? `${initialMode}` : null;
  if (open && openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setQuery(initialMode === "commands" ? ">" : "");
    setRawActive(0);
  } else if (!open && prevOpenKey !== null) {
    setPrevOpenKey(null);
  }

  // 열린 직후 입력에 포커스 + caret 을 끝으로(외부 시스템=DOM 동기화 → effect 적합).
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  // 입력 ">" 프리픽스면 명령 모드 — VS Code 와 동일.
  const isCommandMode = query.startsWith(">");
  const term = (isCommandMode ? query.slice(1) : query).trim();

  // 모드별 소스 + 필터(라벨 + 메타 + 키워드 동시 매칭).
  const results = useMemo(() => {
    const source = isCommandMode ? commands : files;
    if (!term) return source;
    return source.filter((it) =>
      subseqMatch(
        term,
        `${it.label} ${it.meta ?? ""} ${it.keywords ?? ""}`,
      ),
    );
  }, [isCommandMode, commands, files, term]);

  // 활성 인덱스 — 저장값을 결과 범위로 클램프해 읽는다(결과가 줄어도 안전).
  const activeIndex =
    results.length === 0 ? 0 : Math.min(rawActive, results.length - 1);

  // 활성 행을 리스트 뷰 안으로 스크롤(외부 시스템=스크롤 위치 동기화 → effect 적합).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.children[activeIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  if (!open) return null;

  const runAt = (i: number) => {
    const item = results[i];
    if (!item) return;
    onClose();
    // 닫기 후 실행 — 뷰 전환/리플레이 등이 팔레트 언마운트와 충돌하지 않게.
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) setRawActive((activeIndex + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0)
        setRawActive((activeIndex - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(activeIndex);
    }
  };

  const placeholder = isCommandMode
    ? "무엇을 실행할까요?  (예: 리플레이, 대시보드 열기)"
    : "무엇을 찾으세요?  산출물·화면 검색  ( > 입력 시 명령 실행)";

  return (
    <div
      className="ide-cmdpalette-overlay"
      // 백드롭 클릭 = 닫기. 패널 내부 클릭은 stopPropagation 으로 막는다.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ide-cmdpalette"
        role="dialog"
        aria-modal="true"
        aria-label={isCommandMode ? "명령 팔레트" : "빠른 열기"}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="ide-cmdpalette-input"
          value={query}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={placeholder}
        />
        <div className="ide-cmdpalette-list" ref={listRef} role="listbox">
          {results.length === 0 ? (
            <div className="ide-cmd-row" aria-disabled>
              <span className="ide-cmd-label" style={{ color: "var(--ide-text-faint)" }}>
                일치하는 항목이 없습니다
              </span>
            </div>
          ) : (
            results.map((item, i) => (
              <div
                key={item.id}
                role="option"
                aria-selected={i === activeIndex}
                className={`ide-cmd-row ${i === activeIndex ? "active" : ""}`}
                // mousedown 으로 처리 — input blur 전에 실행되도록.
                onMouseDown={(e) => {
                  e.preventDefault();
                  runAt(i);
                }}
                onMouseMove={() => setRawActive(i)}
              >
                <i className={`codicon codicon-${item.icon}`} aria-hidden />
                <span className="ide-cmd-label">{item.label}</span>
                {item.meta && <span className="ide-cmd-meta">{item.meta}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
