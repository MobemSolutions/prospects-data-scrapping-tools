import { prisma } from "@/lib/prisma";
import { CampaignForm } from "@/components/CampaignForm";
import { CampaignList } from "@/components/CampaignList";

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
        <CampaignList campaigns={campaigns} />
      )}
    </div>
  );
}
