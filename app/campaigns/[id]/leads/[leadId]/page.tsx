import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPappersQuota } from "@/app/actions/leads";
import { GmbCard } from "@/components/lead-detail/GmbCard";
import { SiteTechniqueCard } from "@/components/lead-detail/SiteTechniqueCard";
import { SeoContenuCard } from "@/components/lead-detail/SeoContenuCard";
import { GeoVisibiliteCard } from "@/components/lead-detail/GeoVisibiliteCard";
import { EntrepriseCard } from "@/components/lead-detail/EntrepriseCard";
import { PriorityToggle } from "@/components/PriorityToggle";
import { RetryButton } from "@/components/RetryButton";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string; leadId: string }>;
}) {
  const { id: campaignId, leadId } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      gmbData: true,
      websiteAudit: true,
      seoAudit: true,
      geoAudit: true,
      companyData: true,
    },
  });

  if (!lead || lead.campaignId !== campaignId) notFound();

  const breakdown = lead.scoreBreakdownJson ? JSON.parse(lead.scoreBreakdownJson) : null;
  const pappersQuota = await getPappersQuota();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/campaigns/${campaignId}`} className="text-sm text-neutral-500 hover:underline">
          ← Retour à la campagne
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{lead.name}</h1>
          <PriorityToggle campaignId={campaignId} leadId={leadId} priorityFlag={lead.priorityFlag} />
          {lead.status === "ERROR" && <RetryButton campaignId={campaignId} leadId={leadId} />}
        </div>
        {lead.status === "ERROR" && lead.errorMessage && (
          <p className="text-sm text-red-600">Erreur : {lead.errorMessage}</p>
        )}
        {lead.opportunityScore != null && (
          <details className="text-sm text-neutral-500">
            <summary className="cursor-pointer">
              Score d&apos;opportunité : <span className="font-medium text-neutral-900">{lead.opportunityScore}</span>
            </summary>
            {breakdown && (
              <ul className="mt-2 list-inside list-disc pl-2">
                <li>Écart GMB : {Math.round(breakdown.gmbGap)} (poids {breakdown.weights.gmb * 100}%)</li>
                <li>Écart site technique : {Math.round(breakdown.techGap)} (poids {breakdown.weights.tech * 100}%)</li>
                <li>Écart SEO contenu : {Math.round(breakdown.seoGap)} (poids {breakdown.weights.seo * 100}%)</li>
                <li>Écart visibilité IA : {Math.round(breakdown.geoGap)} (poids {breakdown.weights.geo * 100}%)</li>
              </ul>
            )}
          </details>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <GmbCard lead={lead} gmbData={lead.gmbData} />
        <SiteTechniqueCard audit={lead.websiteAudit} />
        <SeoContenuCard audit={lead.seoAudit} />
        <GeoVisibiliteCard audit={lead.geoAudit} />
        <EntrepriseCard
          campaignId={campaignId}
          leadId={leadId}
          company={lead.companyData}
          pappersQuotaRemaining={pappersQuota.remaining}
          priorityFlag={lead.priorityFlag}
        />
      </div>
    </div>
  );
}
