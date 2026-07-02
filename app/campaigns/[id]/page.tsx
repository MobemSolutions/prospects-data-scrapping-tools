import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CampaignLiveView } from "@/components/CampaignLiveView";
import { ExportCsvButton } from "@/components/ExportCsvButton";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      leads: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          website: true,
          rating: true,
          reviewCount: true,
          status: true,
          errorMessage: true,
          opportunityScore: true,
          priorityFlag: true,
          gmbData: { select: { hasPhotos: true, photoCount: true } },
          companyData: { select: { matchStatus: true } },
        },
      },
    },
  });

  if (!campaign) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/campaigns" className="text-sm text-neutral-500 hover:underline">
            ← Toutes les campagnes
          </Link>
          <h1 className="text-xl font-semibold">{campaign.query}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/campaigns/${campaign.id}/compare`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
          >
            Comparer le SEO
          </Link>
          <ExportCsvButton campaignId={campaign.id} />
        </div>
      </div>

      <CampaignLiveView
        campaignId={campaign.id}
        initial={{
          status: campaign.status,
          totalLeads: campaign.totalLeads,
          processedLeads: campaign.processedLeads,
          leads: campaign.leads,
        }}
      />
    </div>
  );
}
