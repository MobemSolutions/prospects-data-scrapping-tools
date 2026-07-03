"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runCampaign } from "@/lib/pipeline/runCampaign";

export async function startCampaign(formData: FormData) {
  const query = String(formData.get("query") ?? "").trim();

  if (!query) {
    throw new Error("La requete Google Maps est requise.");
  }

  const campaign = await prisma.campaign.create({
    data: { query, status: "PENDING" },
  });

  // Fire-and-forget : le process Node reste actif (pas de serverless), le
  // pipeline continue en arriere-plan pendant que l'utilisateur est redirige.
  runCampaign(campaign.id).catch((error) => {
    console.error(`Campagne ${campaign.id} a echoue`, error);
  });

  redirect(`/campaigns/${campaign.id}`);
}

export async function deleteCampaigns(ids: string[]) {
  if (ids.length === 0) return;

  await prisma.campaign.deleteMany({ where: { id: { in: ids } } });

  revalidatePath("/campaigns");
}
