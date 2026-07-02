import { prisma } from "@/lib/prisma";
import type { SiteArtifacts } from "@/lib/pipeline/crawler/politeCrawler";
import { extractSchemaSignals, extractVisibleTextStats } from "@/lib/pipeline/crawler/onPageParser";

// Robots IA connus (2026). "specified" = mentionne explicitement dans le
// robots.txt (vs. absence = autorise par defaut mais site "jamais pense a l'IA").
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "Bytespider",
  "Applebot-Extended",
];

const JS_SHELL_WORD_COUNT_THRESHOLD = 150;
const JS_SHELL_TEXT_RATIO_THRESHOLD = 0.05;

// Poids nommes : acces robots IA(30) + llms.txt(30) + donnees structurees IA(20) + citabilite(20) = 100
const WEIGHTS = {
  botAccess: 30,
  llmsTxtFound: 20,
  llmsTxtValid: 5,
  llmsFullTxtFound: 5,
  orgOrLocalBusiness: 10,
  faqOrArticle: 5,
  sameAsLinks: 5,
  citability: 20,
};

function isLlmsTxtStructurallyValid(content: string): boolean {
  const hasHeading = /^#\s+/m.test(content);
  const hasLink = /\[.+\]\(.+\)/.test(content);
  return hasHeading && hasLink;
}

// Exportee pour etre testee independamment : c'est l'heuristique la plus
// arbitraire (pas de verite terrain a l'execution), donc la plus utile a figer par des tests.
export function isLikelyJsShell(wordCount: number, textToHtmlByteRatio: number): boolean {
  return wordCount < JS_SHELL_WORD_COUNT_THRESHOLD && textToHtmlByteRatio < JS_SHELL_TEXT_RATIO_THRESHOLD;
}

export async function geoAudit(leadId: string, artifacts: SiteArtifacts) {
  const { baseUrl, html, robots, robotsTxtBody, llmsTxt, llmsFullTxt } = artifacts;

  if (!html) {
    await prisma.geoAudit.upsert({
      where: { leadId },
      create: { leadId, url: baseUrl, errorMessage: "page d'accueil inaccessible" },
      update: { errorMessage: "page d'accueil inaccessible" },
    });
    return;
  }

  const aiBotsResults = AI_BOTS.map((bot) => ({
    bot,
    allowed: robots ? robots.isAllowed(baseUrl, bot) !== false : true,
    specified: robotsTxtBody ? robotsTxtBody.toLowerCase().includes(bot.toLowerCase()) : false,
  }));
  const aiBotsAllowedCount = aiBotsResults.filter((r) => r.allowed).length;
  const aiBotsBlockedCount = aiBotsResults.length - aiBotsAllowedCount;

  // Absence de robots.txt = pas de restriction connue = score plein (pas de
  // penalite pour un site qui n'a simplement pas de robots.txt).
  const botAccessScore = robotsTxtBody
    ? (aiBotsAllowedCount / aiBotsResults.length) * WEIGHTS.botAccess
    : WEIGHTS.botAccess;

  const llmsTxtFound = !!llmsTxt;
  const llmsTxtValid = llmsTxtFound && isLlmsTxtStructurallyValid(llmsTxt);
  const llmsFullTxtFound = !!llmsFullTxt;
  const llmsScore =
    (llmsTxtFound ? WEIGHTS.llmsTxtFound : 0) +
    (llmsTxtValid ? WEIGHTS.llmsTxtValid : 0) +
    (llmsFullTxtFound ? WEIGHTS.llmsFullTxtFound : 0);

  const schema = extractSchemaSignals(html);
  const structuredDataScore =
    (schema.hasOrganizationOrLocalBusiness ? WEIGHTS.orgOrLocalBusiness : 0) +
    (schema.hasFaqOrArticle ? WEIGHTS.faqOrArticle : 0) +
    (schema.sameAsLinks.length > 0 ? WEIGHTS.sameAsLinks : 0);

  const { wordCount: rawHtmlWordCount, textToHtmlByteRatio } = extractVisibleTextStats(html);
  const likelyJsShell = isLikelyJsShell(rawHtmlWordCount, textToHtmlByteRatio);
  const citabilityScore = likelyJsShell
    ? 0
    : Math.min(WEIGHTS.citability, (rawHtmlWordCount / 300) * WEIGHTS.citability);

  const geoScore = Math.round(botAccessScore + llmsScore + structuredDataScore + citabilityScore);

  await prisma.geoAudit.upsert({
    where: { leadId },
    create: {
      leadId,
      url: baseUrl,
      aiBotsJson: JSON.stringify(aiBotsResults),
      aiBotsAllowedCount,
      aiBotsBlockedCount,
      aiBotsTotalChecked: aiBotsResults.length,
      llmsTxtFound,
      llmsTxtValid,
      llmsFullTxtFound,
      schemaTypesJson: JSON.stringify(schema.schemaTypes),
      hasOrganizationOrLocalBusinessSchema: schema.hasOrganizationOrLocalBusiness,
      hasFaqOrArticleSchema: schema.hasFaqOrArticle,
      hasSameAsLinks: schema.sameAsLinks.length > 0,
      sameAsCount: schema.sameAsLinks.length,
      rawHtmlWordCount,
      textToHtmlByteRatio,
      likelyJsShell,
      geoScore,
    },
    update: {
      aiBotsJson: JSON.stringify(aiBotsResults),
      aiBotsAllowedCount,
      aiBotsBlockedCount,
      aiBotsTotalChecked: aiBotsResults.length,
      llmsTxtFound,
      llmsTxtValid,
      llmsFullTxtFound,
      schemaTypesJson: JSON.stringify(schema.schemaTypes),
      hasOrganizationOrLocalBusinessSchema: schema.hasOrganizationOrLocalBusiness,
      hasFaqOrArticleSchema: schema.hasFaqOrArticle,
      hasSameAsLinks: schema.sameAsLinks.length > 0,
      sameAsCount: schema.sameAsLinks.length,
      rawHtmlWordCount,
      textToHtmlByteRatio,
      likelyJsShell,
      geoScore,
      errorMessage: null,
    },
  });
}
