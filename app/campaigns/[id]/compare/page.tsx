import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SeoComparisonTable, type ComparisonRow } from "@/components/SeoComparisonTable";
import { MarketAnalysisPanel } from "@/components/MarketAnalysisPanel";
import { computeMarketAnalysis } from "@/lib/pipeline/marketAnalysis";

export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      leads: {
        where: { website: { not: null } },
        include: { seoAudit: true, geoAudit: true, websiteAudit: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) notFound();

  const rows: ComparisonRow[] = campaign.leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    website: lead.website!,
    mobilePerformance: lead.websiteAudit?.mobilePerformance ?? null,
    mobileAccessibility: lead.websiteAudit?.mobileAccessibility ?? null,
    mobileBestPractices: lead.websiteAudit?.mobileBestPractices ?? null,
    mobileSeo: lead.websiteAudit?.mobileSeo ?? null,
    contentScore: lead.seoAudit?.contentScore ?? null,
    wordCount: lead.seoAudit?.wordCount ?? null,
    altCoveragePct: lead.seoAudit?.altCoveragePct ?? null,
    hasStructuredData: lead.seoAudit?.hasStructuredData ?? null,
    openPageRank: lead.seoAudit?.openPageRank ?? null,
    geoScore: lead.geoAudit?.geoScore ?? null,
    aiBotsAllowedCount: lead.geoAudit?.aiBotsAllowedCount ?? null,
    aiBotsTotalChecked: lead.geoAudit?.aiBotsTotalChecked ?? null,
    llmsTxtFound: lead.geoAudit?.llmsTxtFound ?? null,
  }));

  const marketAnalysis = computeMarketAnalysis(
    campaign.leads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      website: lead.website,
      seoAudit: lead.seoAudit
        ? {
            topKeywordsJson: lead.seoAudit.topKeywordsJson,
            contentScore: lead.seoAudit.contentScore,
            openPageRank: lead.seoAudit.openPageRank,
          }
        : null,
      geoAudit: lead.geoAudit
        ? {
            geoScore: lead.geoAudit.geoScore,
            aiBotsJson: lead.geoAudit.aiBotsJson,
            llmsTxtFound: lead.geoAudit.llmsTxtFound,
            hasOrganizationOrLocalBusinessSchema: lead.geoAudit.hasOrganizationOrLocalBusinessSchema,
            hasFaqOrArticleSchema: lead.geoAudit.hasFaqOrArticleSchema,
          }
        : null,
      websiteAudit: lead.websiteAudit
        ? {
            mobilePerformance: lead.websiteAudit.mobilePerformance,
            mobileAccessibility: lead.websiteAudit.mobileAccessibility,
            mobileBestPractices: lead.websiteAudit.mobileBestPractices,
            mobileSeo: lead.websiteAudit.mobileSeo,
          }
        : null,
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/campaigns/${campaignId}`} className="text-sm text-neutral-500 hover:underline">
          ← Retour à la campagne
        </Link>
        <h1 className="text-xl font-semibold">Comparatif SEO &amp; visibilité IA</h1>
        <p className="text-sm text-neutral-500">
          {campaign.query} — {rows.length} site{rows.length > 1 ? "s" : ""} analysé
          {rows.length > 1 ? "s" : ""}, classés par score de contenu SEO.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
          Aucun prospect avec site web dans cette campagne.
        </p>
      ) : (
        <>
          <SeoComparisonTable campaignId={campaignId} rows={rows} />
          <MarketAnalysisPanel analysis={marketAnalysis} />
        </>
      )}
    </div>
  );
}
