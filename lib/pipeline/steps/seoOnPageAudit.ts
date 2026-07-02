import { prisma } from "@/lib/prisma";
import type { SiteArtifacts } from "@/lib/pipeline/crawler/politeCrawler";
import { extractOnPageFacts, extractSchemaSignals } from "@/lib/pipeline/crawler/onPageParser";

// OpenPageRank a ete racheté par Keywords Everywhere (migration effective
// courant 2026) : nouveau domaine, nouvelle authentification Bearer, corps
// JSON au lieu de query params. Verifie en reel le 2026-07-01 — la cle
// "opr_live_..." existante reste valide, seul le format d'appel a change.
async function fetchOpenPageRank(domain: string): Promise<number | null> {
  const apiKey = process.env.OPENPAGERANK_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://openpagerank.keywordseverywhere.com/v1/domains/bulk", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ domains: [domain] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.results?.[0];
    const rank = result?.found ? result.open_page_rank : null;
    return typeof rank === "number" ? rank : null;
  } catch {
    return null;
  }
}

// Poids nommes : title(15) + meta(15) + h1(10) + contenu(15) + alt(15)
// + donnees structurees(10) + hygiene technique(10) + autorite OpenPageRank(10) = 100
const WEIGHTS = {
  title: 15,
  metaDescription: 15,
  singleH1: 10,
  wordCount: 15,
  altCoverage: 15,
  structuredData: 10,
  technicalHygiene: 10,
  authority: 10,
};

function computeContentScore(params: {
  titleLength: number;
  metaDescriptionLength: number;
  h1Count: number;
  wordCount: number;
  altCoveragePct: number;
  hasStructuredData: boolean;
  hasCanonical: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  openPageRank: number | null;
}): number {
  const titleScore = params.titleLength >= 10 && params.titleLength <= 70 ? WEIGHTS.title : 0;
  const metaScore =
    params.metaDescriptionLength >= 50 && params.metaDescriptionLength <= 160
      ? WEIGHTS.metaDescription
      : 0;
  const h1Score = params.h1Count === 1 ? WEIGHTS.singleH1 : 0;
  const wordCountScore =
    params.wordCount >= 300 ? WEIGHTS.wordCount : (params.wordCount / 300) * WEIGHTS.wordCount;
  const altScore = (params.altCoveragePct / 100) * WEIGHTS.altCoverage;
  const structuredDataScore = params.hasStructuredData ? WEIGHTS.structuredData : 0;

  const hygieneChecks = [params.hasCanonical, params.hasRobotsTxt, params.hasSitemap];
  const hygieneScore =
    (hygieneChecks.filter(Boolean).length / hygieneChecks.length) * WEIGHTS.technicalHygiene;

  const authorityScore =
    params.openPageRank != null ? (params.openPageRank / 10) * WEIGHTS.authority : WEIGHTS.authority / 2;

  return Math.round(
    titleScore + metaScore + h1Score + wordCountScore + altScore + structuredDataScore + hygieneScore + authorityScore,
  );
}

export async function seoOnPageAudit(leadId: string, artifacts: SiteArtifacts) {
  const { baseUrl, html, robotsTxtBody, sitemapReachable } = artifacts;

  if (!html) {
    await prisma.seoOnPageAudit.upsert({
      where: { leadId },
      create: { leadId, url: baseUrl, errorMessage: "page d'accueil inaccessible" },
      update: { errorMessage: "page d'accueil inaccessible" },
    });
    return;
  }

  const facts = extractOnPageFacts(html);
  const schema = extractSchemaSignals(html);
  const hasStructuredData = schema.schemaTypes.length > 0;

  const domain = new URL(baseUrl).hostname;
  const openPageRank = await fetchOpenPageRank(domain);

  const contentScore = computeContentScore({
    titleLength: facts.titleLength,
    metaDescriptionLength: facts.metaDescriptionLength,
    h1Count: facts.h1Count,
    wordCount: facts.wordCount,
    altCoveragePct: facts.altCoveragePct,
    hasStructuredData,
    hasCanonical: facts.hasCanonical,
    hasRobotsTxt: !!robotsTxtBody,
    hasSitemap: sitemapReachable,
    openPageRank,
  });

  await prisma.seoOnPageAudit.upsert({
    where: { leadId },
    create: {
      leadId,
      url: baseUrl,
      titleTag: facts.titleTag,
      titleLength: facts.titleLength,
      metaDescription: facts.metaDescription,
      metaDescriptionLength: facts.metaDescriptionLength,
      h1Count: facts.h1Count,
      h2Count: facts.h2Count,
      wordCount: facts.wordCount,
      topKeywordsJson: JSON.stringify(facts.topKeywords),
      imageCount: facts.imageCount,
      imagesWithAlt: facts.imagesWithAlt,
      altCoveragePct: facts.altCoveragePct,
      hasCanonical: facts.hasCanonical,
      hasStructuredData,
      hasRobotsTxt: !!robotsTxtBody,
      hasSitemap: sitemapReachable,
      openPageRank,
      contentScore,
    },
    update: {
      titleTag: facts.titleTag,
      titleLength: facts.titleLength,
      metaDescription: facts.metaDescription,
      metaDescriptionLength: facts.metaDescriptionLength,
      h1Count: facts.h1Count,
      h2Count: facts.h2Count,
      wordCount: facts.wordCount,
      topKeywordsJson: JSON.stringify(facts.topKeywords),
      imageCount: facts.imageCount,
      imagesWithAlt: facts.imagesWithAlt,
      altCoveragePct: facts.altCoveragePct,
      hasCanonical: facts.hasCanonical,
      hasStructuredData,
      hasRobotsTxt: !!robotsTxtBody,
      hasSitemap: sitemapReachable,
      openPageRank,
      contentScore,
      errorMessage: null,
    },
  });
}
