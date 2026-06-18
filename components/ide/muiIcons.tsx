// components/ide/muiIcons.tsx — IDE 셸 크롬 아이콘을 "기능에 맞는" MUI 아이콘으로 통일.
// codicon 글리프 대신 셸 네비게이션/패널 크롬에서 쓰는 아이콘을 의미가 맞는 MUI 아이콘으로 모음.
// 사이징/색: globals.css 의 `.ide-act-item svg / .ide-icon-btn svg / .ide-panel-tab svg /
// .ide-status-item svg / .ide-view-bar svg` 규칙이 크기를, fill:currentColor 가 색을 상속한다.

import type { SvgIconProps } from "@mui/material/SvgIcon";
import ForumOutlined from "@mui/icons-material/ForumOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import AccountTreeOutlined from "@mui/icons-material/AccountTreeOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import TerminalOutlined from "@mui/icons-material/TerminalOutlined";
import KeyboardArrowDownOutlined from "@mui/icons-material/KeyboardArrowDownOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import StarBorderOutlined from "@mui/icons-material/StarBorderOutlined";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";

import type { IdeViewKind } from "@/lib/ide/views";

// ── 셸 크롬 아이콘(의미 기준) ──
export const ChatIcon = ForumOutlined;          // 대화 — Claude 채팅 패널
export const ExplorerIcon = FolderOpenOutlined; // 탐색기 — 작업 폴더
export const WorkflowIcon = AccountTreeOutlined; // 워크플로 정의 — 카드 스펙
export const QuickOpenIcon = SearchOutlined;     // 빠른 열기/검색 — 명령 팔레트(⌘P)
export const DashboardIcon = InsightsOutlined;   // 대시보드 — 성과 지표
export const ContentIcon = PhotoCameraOutlined;  // 콘텐츠 — 인스타/콘텐츠 스튜디오
export const OutboundIcon = SendOutlined;        // 아웃바운드 — 콜드메일 파이프라인
export const PersonaIcon = GroupsOutlined;       // 에이전트 — 페르소나 패널
export const SettingsIcon = SettingsOutlined;    // 설정
export const TerminalIcon = TerminalOutlined;    // 터미널 패널
export const ChevronDownIcon = KeyboardArrowDownOutlined; // 패널 접기
export const BackIcon = ArrowBackOutlined;       // 작업 보드로 복귀

/** 뷰 종류 → MUI 아이콘(액티비티바·뷰바 공용). */
const VIEW_ICONS: Record<IdeViewKind, React.ComponentType<SvgIconProps>> = {
  welcome: StarBorderOutlined,
  workflow: AccountTreeOutlined,
  dashboard: InsightsOutlined,
  content: PhotoCameraOutlined,
  outbound: SendOutlined,
  settings: SettingsOutlined,
};

/** 뷰 탭 아이콘 — kind 에 맞는 MUI 아이콘(매핑 누락 시 일반 파일 아이콘). */
export function ViewIcon({ kind, ...props }: { kind: IdeViewKind } & SvgIconProps) {
  const Icon = VIEW_ICONS[kind] ?? InsertDriveFileOutlined;
  return <Icon {...props} />;
}
