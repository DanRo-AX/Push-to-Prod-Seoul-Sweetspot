// 시나리오 팩 로더 — 서버 전용 모듈 (fs 사용, 클라이언트 번들에 포함 금지)
// scenarios/<id>/ 디렉토리에서 브랜드 브리프, 프롬프트 조각, mock 데이터를 읽어
// ScenarioPack 으로 조립한다. 시나리오 팩 파일 자체는 별도 모듈이 생성한다.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AttributionPack,
  BtlScenarioPack,
  CrmLead,
  FollowerGrowthPack,
  JourneyPack,
  KeywordJourneyPack,
  KeywordPack,
  LeadJourneyPack,
  MentionsPack,
  MetricsTimeline,
  NewsletterAudiencePack,
  NewsletterPerformancePack,
  OutboundContact,
  PatternCard,
  PostPerformancePack,
  PricingMasterItem,
  RfpDocument,
  ScenarioId,
  ScenarioPack,
} from "@/lib/types";

const VALID_SCENARIO_IDS: ScenarioId[] = ["A-zero-to-one", "B-rebrand", "C-btl"];

function resolveScenarioId(id?: ScenarioId): ScenarioId {
  const candidate =
    id ??
    (process.env.OCTOPUS_SCENARIO as ScenarioId | undefined) ??
    "A-zero-to-one";
  if (!VALID_SCENARIO_IDS.includes(candidate)) {
    throw new Error(
      `알 수 없는 시나리오 ID: "${candidate}" — 사용 가능한 값: ${VALID_SCENARIO_IDS.join(", ")}`,
    );
  }
  return candidate;
}

// ── C-BTL 시나리오 팩 로더 ──
export async function loadBtlScenarioPack(): Promise<BtlScenarioPack> {
  const dir = path.join(process.cwd(), "scenarios", "C-btl");

  const [brandBrief, promptFragments, rfpRaw, pricingRaw, patternCardsRaw] =
    await Promise.all([
      readScenarioFile(dir, "brand-brief.md"),
      readScenarioFile(dir, "prompt-fragments.md"),
      readScenarioFile(dir, "mock-rfp.json"),
      readScenarioFile(dir, "mock-pricing.json"),
      readScenarioFile(dir, "mock-pattern-cards.json"),
    ]);

  return {
    id: "C-btl",
    brandBrief,
    promptFragments,
    mockRfp: parseJson<RfpDocument>(rfpRaw, "mock-rfp.json"),
    mockPricing: parseJson<PricingMasterItem[]>(pricingRaw, "mock-pricing.json"),
    mockPatternCards: parseJson<PatternCard[]>(patternCardsRaw, "mock-pattern-cards.json"),
  };
}

async function readScenarioFile(dir: string, filename: string): Promise<string> {
  const filePath = path.join(dir, filename);
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    throw new Error(
      `시나리오 팩 파일을 읽을 수 없습니다: ${filePath} — scenarios/<id>/ 디렉토리에 ${filename} 파일이 존재하는지 확인하세요.`,
    );
  }
}

function parseJson<T>(raw: string, filename: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`시나리오 팩 JSON 파싱 실패: ${filename} — 파일 내용이 올바른 JSON 인지 확인하세요.`);
  }
}

export async function loadScenarioPack(id?: ScenarioId): Promise<ScenarioPack> {
  const scenarioId = resolveScenarioId(id);
  const dir = path.join(process.cwd(), "scenarios", scenarioId);

  const [
    brandBrief,
    promptFragments,
    gaRaw,
    crmRaw,
    contactsRaw,
    keywordsRaw,
    journeyRaw,
    postPerformanceRaw,
    mentionsRaw,
    leadJourneyRaw,
    keywordJourneyRaw,
    attributionRaw,
    followerGrowthRaw,
    newsletterAudienceRaw,
    newsletterPerformanceRaw,
  ] = await Promise.all([
    readScenarioFile(dir, "brand-brief.md"),
    readScenarioFile(dir, "prompt-fragments.md"),
    readScenarioFile(dir, "mock-ga.json"),
    readScenarioFile(dir, "mock-crm.json"),
    readScenarioFile(dir, "mock-contacts.json"),
    readScenarioFile(dir, "mock-keywords.json"),
    readScenarioFile(dir, "mock-journey.json"),
    readScenarioFile(dir, "mock-post-performance.json"),
    readScenarioFile(dir, "mock-mentions.json"),
    readScenarioFile(dir, "mock-lead-journey.json"),
    readScenarioFile(dir, "mock-keyword-journey.json"),
    readScenarioFile(dir, "mock-attribution.json"),
    readScenarioFile(dir, "mock-follower-growth.json"),
    readScenarioFile(dir, "mock-newsletter-audience.json"),
    readScenarioFile(dir, "mock-newsletter-performance.json"),
  ]);

  return {
    id: scenarioId,
    brandBrief,
    promptFragments,
    mockGa: parseJson<MetricsTimeline>(gaRaw, "mock-ga.json"),
    mockCrm: parseJson<{ leads: CrmLead[] }>(crmRaw, "mock-crm.json"),
    mockContacts: parseJson<{ contacts: OutboundContact[] }>(
      contactsRaw,
      "mock-contacts.json",
    ),
    mockKeywords: parseJson<KeywordPack>(keywordsRaw, "mock-keywords.json"),
    mockJourney: parseJson<JourneyPack>(journeyRaw, "mock-journey.json"),
    mockPostPerformance: parseJson<PostPerformancePack>(
      postPerformanceRaw,
      "mock-post-performance.json",
    ),
    mockMentions: parseJson<MentionsPack>(mentionsRaw, "mock-mentions.json"),
    mockLeadJourney: parseJson<LeadJourneyPack>(
      leadJourneyRaw,
      "mock-lead-journey.json",
    ),
    mockKeywordJourney: parseJson<KeywordJourneyPack>(
      keywordJourneyRaw,
      "mock-keyword-journey.json",
    ),
    mockAttribution: parseJson<AttributionPack>(
      attributionRaw,
      "mock-attribution.json",
    ),
    mockFollowerGrowth: parseJson<FollowerGrowthPack>(
      followerGrowthRaw,
      "mock-follower-growth.json",
    ),
    mockNewsletterAudience: parseJson<NewsletterAudiencePack>(
      newsletterAudienceRaw,
      "mock-newsletter-audience.json",
    ),
    mockNewsletterPerformance: parseJson<NewsletterPerformancePack>(
      newsletterPerformanceRaw,
      "mock-newsletter-performance.json",
    ),
  };
}
