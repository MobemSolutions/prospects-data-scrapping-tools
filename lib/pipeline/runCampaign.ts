import { prisma } from "@/lib/prisma";
import { runQuery } from "@/lib/gosom/client";
import { scrapeQueue, analysisQueue } from "@/lib/pipeline/queue";
import { gmbAnalyze } from "@/lib/pipeline/steps/gmbAnalyze";
import { fetchSiteArtifacts } from "@/lib/pipeline/crawler/politeCrawler";
import { websiteAudit } from "@/lib/pipeline/steps/websiteAudit";
import { seoOnPageAudit } from "@/lib/pipeline/steps/seoOnPageAudit";
import { geoAudit } from "@/lib/pipeline/steps/geoAudit";
import { companyEnrich } from "@/lib/pipeline/steps/companyEnrich";
import { computeAndStoreOpportunityScore } from "@/lib/pipeline/scoring";

// Orchestrateur de campagne.
export async function runCampaign(campaignId: string) {
  try {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "SCRAPING" },
    });

    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
    });

    const results = await scrapeQueue.add(() =>
      runQuery(campaign.query, `campagne-${campaignId}`),
    );

    if (!results || results.length === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "DONE", totalLeads: 0 },
      });
      return;
    }

    const leads = await Promise.all(
      results.map((result) =>
        prisma.lead.create({
          data: {
            campaignId,
            placeId: result.placeId,
            name: result.name,
            address: result.address,
            phone: result.phone,
            website: result.website,
            rating: result.rating,
            reviewCount: result.reviewCount,
            category: result.category,
            latitude: result.latitude,
            longitude: result.longitude,
            thumbnailUrl: result.thumbnailUrl,
            status: "SCRAPED",
          },
        }),
      ),
    );

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "ANALYZING", totalLeads: leads.length },
    });

    await Promise.all(
      leads.map((lead, index) =>
        analysisQueue.add(() => analyzeLead(campaignId, lead.id, results[index])),
      ),
    );

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "DONE" },
    });
  } catch (error) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "ERROR", errorMessage: String(error) },
    });
  }
}

export function normalizeWebsiteUrl(website: string): string | null {
  try {
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    return new URL(url).toString();
  } catch {
    return null;
  }
}

// Etapes d'analyse qui ne dependent que des champs deja persistes sur le
// Lead (nom, adresse, site web) : audit site/SEO/GEO + enrichissement
// entreprise + score. Reutilisee a la fois par le run initial (apres
// gmbAnalyze) et par le retry manuel d'un lead en erreur.
export async function runAnalysisSteps(
  leadId: string,
  name: string,
  address: string | null,
  website: string | null,
) {
  const websiteUrl = website ? normalizeWebsiteUrl(website) : null;

  await Promise.allSettled([
    websiteUrl
      ? (async () => {
          const artifacts = await fetchSiteArtifacts(websiteUrl);
          await Promise.allSettled([
            websiteAudit(leadId, websiteUrl),
            seoOnPageAudit(leadId, artifacts),
            geoAudit(leadId, artifacts),
          ]);
        })()
      : Promise.resolve(),
    companyEnrich(leadId, name, address),
  ]);

  // Pappers reste manuel (quota 100/mois) : declenche via l'action
  // enrichWithPappers sur les leads marques prioritaires, pas ici.

  await computeAndStoreOpportunityScore(leadId);
}

async function analyzeLead(
  campaignId: string,
  leadId: string,
  result: Parameters<typeof gmbAnalyze>[1],
) {
  try {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "ANALYZING" } });

    await gmbAnalyze(leadId, result);
    await runAnalysisSteps(leadId, result.name, result.address, result.website);

    await prisma.lead.update({ where: { id: leadId }, data: { status: "DONE" } });
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "ERROR", errorMessage: String(error) },
    });
  } finally {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { processedLeads: { increment: 1 } },
    });
  }
}
