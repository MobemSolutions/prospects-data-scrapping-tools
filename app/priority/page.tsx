import { prisma } from "@/lib/prisma";
import { PriorityLeadsTable, type PriorityLeadRow } from "@/components/PriorityLeadsTable";

// Toujours lue en direct : la liste change a chaque etoile cliquee dans une campagne.
export const dynamic = "force-dynamic";

export default async function PriorityPage() {
  const leads = await prisma.lead.findMany({
    where: { priorityFlag: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      campaignId: true,
      name: true,
      address: true,
      website: true,
      rating: true,
      reviewCount: true,
      status: true,
      errorMessage: true,
      opportunityScore: true,
      companyData: { select: { matchStatus: true } },
      campaign: { select: { query: true } },
    },
  });

  const rows: PriorityLeadRow[] = leads.map((lead) => ({
    id: lead.id,
    campaignId: lead.campaignId,
    campaignQuery: lead.campaign.query,
    name: lead.name,
    address: lead.address,
    website: lead.website,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    status: lead.status,
    errorMessage: lead.errorMessage,
    opportunityScore: lead.opportunityScore,
    companyData: lead.companyData,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">★ Prospects prioritaires</h1>
        <p className="text-sm text-neutral-500">
          Tous les prospects marqués prioritaires, toutes campagnes confondues ({rows.length}). Triez par
          &laquo;&nbsp;Recherche d&apos;origine&nbsp;&raquo; pour les regrouper par campagne.
        </p>
      </div>

      <PriorityLeadsTable initialLeads={rows} />
    </div>
  );
}
