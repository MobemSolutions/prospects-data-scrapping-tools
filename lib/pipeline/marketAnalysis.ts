// Analyse comparative de marche a partir des audits SEO/GEO deja calcules
// pour chaque lead d'une campagne (fonction pure, testable sans base de
// donnees). Objectif : degager ce qui est pertinent pour un comparatif
// SEO/GEO entre concurrents d'une meme recherche Google Maps.
//
// Limite assumee (honnetete, meme principe que le reste de l'app) : ceci
// mesure la frequence d'usage des mots-cles DANS LE CONTENU des sites
// analyses ici, pas de vraies donnees de volume de recherche/concurrence
// Google (aucune API gratuite ne fournit ça). C'est donc une photographie
// du "champ lexical" du marche local observe, pas un outil de recherche de
// mots-cles a proprement parler.

export interface MarketLeadInput {
  id: string;
  name: string;
  website: string | null;
  seoAudit: {
    topKeywordsJson: string | null;
    contentScore: number | null;
    openPageRank: number | null;
  } | null;
  geoAudit: {
    geoScore: number | null;
    aiBotsJson: string | null;
    llmsTxtFound: boolean | null;
    hasOrganizationOrLocalBusinessSchema: boolean | null;
    hasFaqOrArticleSchema: boolean | null;
  } | null;
  websiteAudit: {
    mobilePerformance: number | null;
    mobileAccessibility: number | null;
    mobileBestPractices: number | null;
    mobileSeo: number | null;
  } | null;
}

export interface KeywordMarketEntry {
  term: string;
  siteCount: number;
  totalOccurrences: number;
  sites: string[];
}

export interface UniqueKeywordsBySite {
  leadId: string;
  name: string;
  keywords: string[];
}

export interface BotBlockRate {
  bot: string;
  blockedCount: number;
  totalChecked: number;
  blockedPct: number;
}

export interface TechnicalBenchmark {
  avgPerformance: number | null;
  avgAccessibility: number | null;
  avgSeoTechnique: number | null;
  avgContentScore: number | null;
  avgGeoScore: number | null;
  avgOpenPageRank: number | null;
}

export interface GeoMarketStats {
  sitesWithGeoAudit: number;
  llmsTxtAdoptionPct: number;
  structuredDataAdoptionPct: number;
  botBlockRates: BotBlockRate[];
}

export interface MarketAnalysis {
  sitesAnalyzed: number;
  sharedKeywords: KeywordMarketEntry[];
  uniqueKeywordsBySite: UniqueKeywordsBySite[];
  technicalBenchmark: TechnicalBenchmark;
  geoMarket: GeoMarketStats;
}

const MAX_SHARED_KEYWORDS = 20;
const MAX_UNIQUE_KEYWORDS_PER_SITE = 6;

function average(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((sum, v) => sum + v, 0) / nums.length) * 10) / 10;
}

function parseKeywords(topKeywordsJson: string | null): { term: string; count: number }[] {
  if (!topKeywordsJson) return [];
  try {
    const parsed = JSON.parse(topKeywordsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface AiBotResult {
  bot: string;
  allowed: boolean;
}

function parseAiBots(aiBotsJson: string | null): AiBotResult[] {
  if (!aiBotsJson) return [];
  try {
    const parsed = JSON.parse(aiBotsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function computeMarketAnalysis(leads: MarketLeadInput[]): MarketAnalysis {
  const sitesWithSeo = leads.filter((l) => l.seoAudit);

  // --- Paysage des mots-cles ---
  const keywordMap = new Map<string, { siteCount: number; totalOccurrences: number; sites: Set<string> }>();
  const keywordsByLead = new Map<string, { term: string; count: number }[]>();

  for (const lead of sitesWithSeo) {
    const keywords = parseKeywords(lead.seoAudit?.topKeywordsJson ?? null);
    keywordsByLead.set(lead.id, keywords);

    for (const { term, count } of keywords) {
      const entry = keywordMap.get(term) ?? { siteCount: 0, totalOccurrences: 0, sites: new Set<string>() };
      entry.siteCount += 1;
      entry.totalOccurrences += count;
      entry.sites.add(lead.name);
      keywordMap.set(term, entry);
    }
  }

  const sharedKeywords: KeywordMarketEntry[] = [...keywordMap.entries()]
    .map(([term, e]) => ({ term, siteCount: e.siteCount, totalOccurrences: e.totalOccurrences, sites: [...e.sites] }))
    .sort((a, b) => b.siteCount - a.siteCount || b.totalOccurrences - a.totalOccurrences)
    .slice(0, MAX_SHARED_KEYWORDS);

  const uniqueKeywordsBySite: UniqueKeywordsBySite[] = sitesWithSeo
    .map((lead) => {
      const keywords = keywordsByLead.get(lead.id) ?? [];
      const unique = keywords
        .filter((k) => (keywordMap.get(k.term)?.siteCount ?? 0) === 1)
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_UNIQUE_KEYWORDS_PER_SITE)
        .map((k) => k.term);
      return { leadId: lead.id, name: lead.name, keywords: unique };
    })
    .filter((s) => s.keywords.length > 0);

  // --- Benchmark technique ---
  const technicalBenchmark: TechnicalBenchmark = {
    avgPerformance: average(leads.map((l) => l.websiteAudit?.mobilePerformance)),
    avgAccessibility: average(leads.map((l) => l.websiteAudit?.mobileAccessibility)),
    avgSeoTechnique: average(leads.map((l) => l.websiteAudit?.mobileSeo)),
    avgContentScore: average(leads.map((l) => l.seoAudit?.contentScore)),
    avgGeoScore: average(leads.map((l) => l.geoAudit?.geoScore)),
    avgOpenPageRank: average(leads.map((l) => l.seoAudit?.openPageRank)),
  };

  // --- Adoption GEO du marche ---
  const sitesWithGeo = leads.filter((l) => l.geoAudit);
  const llmsTxtCount = sitesWithGeo.filter((l) => l.geoAudit?.llmsTxtFound).length;
  const structuredDataCount = sitesWithGeo.filter(
    (l) => l.geoAudit?.hasOrganizationOrLocalBusinessSchema || l.geoAudit?.hasFaqOrArticleSchema,
  ).length;

  const botTally = new Map<string, { blocked: number; total: number }>();
  for (const lead of sitesWithGeo) {
    const bots = parseAiBots(lead.geoAudit?.aiBotsJson ?? null);
    for (const { bot, allowed } of bots) {
      const entry = botTally.get(bot) ?? { blocked: 0, total: 0 };
      entry.total += 1;
      if (!allowed) entry.blocked += 1;
      botTally.set(bot, entry);
    }
  }

  const botBlockRates: BotBlockRate[] = [...botTally.entries()]
    .map(([bot, { blocked, total }]) => ({
      bot,
      blockedCount: blocked,
      totalChecked: total,
      blockedPct: total > 0 ? Math.round((blocked / total) * 100) : 0,
    }))
    .sort((a, b) => b.blockedPct - a.blockedPct);

  const geoMarket: GeoMarketStats = {
    sitesWithGeoAudit: sitesWithGeo.length,
    llmsTxtAdoptionPct: sitesWithGeo.length > 0 ? Math.round((llmsTxtCount / sitesWithGeo.length) * 100) : 0,
    structuredDataAdoptionPct:
      sitesWithGeo.length > 0 ? Math.round((structuredDataCount / sitesWithGeo.length) * 100) : 0,
    botBlockRates,
  };

  return {
    sitesAnalyzed: sitesWithSeo.length,
    sharedKeywords,
    uniqueKeywordsBySite,
    technicalBenchmark,
    geoMarket,
  };
}
