import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CampaignForm } from "@/components/CampaignForm";

// Toujours lue en direct depuis la base : la liste change a chaque campagne
// lancee, elle ne doit jamais etre figee au build.
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Campagnes de prospection</h1>
        <p className="text-sm text-neutral-500">
          Lancez une recherche Google Maps pour générer une liste de
          prospects analysés.
        </p>
      </div>

      <CampaignForm />

      {campaigns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
          Aucune campagne pour le moment.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/campaigns/${campaign.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
              >
                <span className="font-medium">{campaign.query}</span>
                <span className="flex items-center gap-3 text-sm text-neutral-500">
                  <span>
                    {campaign.processedLeads}/{campaign.totalLeads} leads
                  </span>
                  <StatusBadge status={campaign.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-neutral-100 text-neutral-600",
    SCRAPING: "bg-amber-100 text-amber-700",
    ANALYZING: "bg-amber-100 text-amber-700",
    DONE: "bg-emerald-100 text-emerald-700",
    ERROR: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-600"}`}
    >
      {status}
    </span>
  );
}
