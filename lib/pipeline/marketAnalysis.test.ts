import { describe, expect, it } from "vitest";
import { computeMarketAnalysis, type MarketLeadInput } from "./marketAnalysis";

function makeLead(overrides: Partial<MarketLeadInput> & { id: string; name: string }): MarketLeadInput {
  return {
    website: "https://example.com",
    seoAudit: null,
    geoAudit: null,
    websiteAudit: null,
    ...overrides,
  };
}

describe("computeMarketAnalysis", () => {
  it("ne plante pas et retourne des valeurs vides sans leads", () => {
    const result = computeMarketAnalysis([]);
    expect(result.sitesAnalyzed).toBe(0);
    expect(result.sharedKeywords).toEqual([]);
    expect(result.geoMarket.llmsTxtAdoptionPct).toBe(0);
    expect(result.technicalBenchmark.avgPerformance).toBeNull();
  });

  it("identifie les mots-cles partages entre plusieurs sites, tries par couverture", () => {
    const leads: MarketLeadInput[] = [
      makeLead({
        id: "1",
        name: "Site A",
        seoAudit: { topKeywordsJson: JSON.stringify([{ term: "chatou", count: 5 }, { term: "boulangerie", count: 3 }]), contentScore: 70, openPageRank: null },
      }),
      makeLead({
        id: "2",
        name: "Site B",
        seoAudit: { topKeywordsJson: JSON.stringify([{ term: "chatou", count: 8 }, { term: "pain", count: 2 }]), contentScore: 60, openPageRank: null },
      }),
      makeLead({
        id: "3",
        name: "Site C",
        seoAudit: { topKeywordsJson: JSON.stringify([{ term: "chatou", count: 1 }]), contentScore: 50, openPageRank: null },
      }),
    ];

    const result = computeMarketAnalysis(leads);
    expect(result.sitesAnalyzed).toBe(3);
    expect(result.sharedKeywords[0].term).toBe("chatou");
    expect(result.sharedKeywords[0].siteCount).toBe(3);
    expect(result.sharedKeywords[0].totalOccurrences).toBe(14);
    expect(result.sharedKeywords[0].sites).toEqual(["Site A", "Site B", "Site C"]);
  });

  it("identifie les mots-cles uniques a un seul site (differenciation)", () => {
    const leads: MarketLeadInput[] = [
      makeLead({
        id: "1",
        name: "Site A",
        seoAudit: { topKeywordsJson: JSON.stringify([{ term: "chatou", count: 5 }, { term: "vegan", count: 4 }]), contentScore: 70, openPageRank: null },
      }),
      makeLead({
        id: "2",
        name: "Site B",
        seoAudit: { topKeywordsJson: JSON.stringify([{ term: "chatou", count: 8 }]), contentScore: 60, openPageRank: null },
      }),
    ];

    const result = computeMarketAnalysis(leads);
    const siteA = result.uniqueKeywordsBySite.find((s) => s.leadId === "1");
    expect(siteA?.keywords).toEqual(["vegan"]);
    expect(result.uniqueKeywordsBySite.find((s) => s.leadId === "2")).toBeUndefined();
  });

  it("calcule les moyennes techniques en ignorant les valeurs nulles", () => {
    const leads: MarketLeadInput[] = [
      makeLead({ id: "1", name: "A", websiteAudit: { mobilePerformance: 80, mobileAccessibility: 90, mobileBestPractices: 90, mobileSeo: 100 } }),
      makeLead({ id: "2", name: "B", websiteAudit: { mobilePerformance: 40, mobileAccessibility: 70, mobileBestPractices: 70, mobileSeo: 80 } }),
      makeLead({ id: "3", name: "C", websiteAudit: null }),
    ];

    const result = computeMarketAnalysis(leads);
    expect(result.technicalBenchmark.avgPerformance).toBe(60);
  });

  it("calcule les taux d'adoption GEO du marche", () => {
    const leads: MarketLeadInput[] = [
      makeLead({
        id: "1",
        name: "A",
        geoAudit: {
          geoScore: 80,
          aiBotsJson: JSON.stringify([{ bot: "GPTBot", allowed: true }, { bot: "ClaudeBot", allowed: false }]),
          llmsTxtFound: true,
          hasOrganizationOrLocalBusinessSchema: true,
          hasFaqOrArticleSchema: false,
        },
      }),
      makeLead({
        id: "2",
        name: "B",
        geoAudit: {
          geoScore: 50,
          aiBotsJson: JSON.stringify([{ bot: "GPTBot", allowed: false }, { bot: "ClaudeBot", allowed: false }]),
          llmsTxtFound: false,
          hasOrganizationOrLocalBusinessSchema: false,
          hasFaqOrArticleSchema: false,
        },
      }),
    ];

    const result = computeMarketAnalysis(leads);
    expect(result.geoMarket.llmsTxtAdoptionPct).toBe(50);
    expect(result.geoMarket.structuredDataAdoptionPct).toBe(50);

    const claudeBot = result.geoMarket.botBlockRates.find((b) => b.bot === "ClaudeBot");
    expect(claudeBot?.blockedPct).toBe(100);
    const gptBot = result.geoMarket.botBlockRates.find((b) => b.bot === "GPTBot");
    expect(gptBot?.blockedPct).toBe(50);
  });

  it("ignore proprement un JSON de mots-cles malforme", () => {
    const leads: MarketLeadInput[] = [
      makeLead({ id: "1", name: "A", seoAudit: { topKeywordsJson: "{ invalide", contentScore: 50, openPageRank: null } }),
    ];
    expect(() => computeMarketAnalysis(leads)).not.toThrow();
    expect(computeMarketAnalysis(leads).sharedKeywords).toEqual([]);
  });
});
