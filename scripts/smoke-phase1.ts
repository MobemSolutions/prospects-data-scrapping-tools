// Smoke test manuel : lance une vraie campagne (scrape gosom + analyse GMB
// + SEO + GEO + entreprise) sans passer par l'UI, pour verifier le pipeline
// de bout en bout. tsx ne charge pas .env.local automatiquement (contrairement
// a Next.js), d'ou le chargement explicite ci-dessous.
// Usage : npx tsx scripts/smoke-phase1.ts "requete google maps"
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { prisma } from "../lib/prisma";
import { runCampaign } from "../lib/pipeline/runCampaign";

async function main() {
  const query = process.argv[2] ?? "boulanger Chatou";

  const campaign = await prisma.campaign.create({
    data: { query, status: "PENDING" },
  });
  console.log(`Campagne creee (${campaign.id}) pour la requete : "${query}"`);

  await runCampaign(campaign.id);

  const result = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaign.id },
    include: { leads: { include: { gmbData: true } } },
  });

  console.log(
    `\nStatut final : ${result.status} — ${result.processedLeads}/${result.totalLeads} leads traites`,
  );
  if (result.errorMessage) console.error("Erreur campagne :", result.errorMessage);

  for (const lead of result.leads) {
    console.log(
      `- ${lead.name} | site: ${lead.website ?? "aucun"} | note: ${lead.rating ?? "—"} (${lead.reviewCount ?? 0} avis) | photos GMB: ${lead.gmbData?.hasPhotos ?? "—"} | statut: ${lead.status}${lead.errorMessage ? ` (${lead.errorMessage})` : ""}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
