"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement, getQuotaStatus } from "@/lib/quota/quotaManager";
import { runAnalysisSteps } from "@/lib/pipeline/runCampaign";

const PAPPERS_SERVICE = "pappers";
const PAPPERS_MONTHLY_LIMIT = Number(process.env.PAPPERS_MONTHLY_LIMIT ?? 100);

export async function togglePriority(campaignId: string, leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  await prisma.lead.update({
    where: { id: leadId },
    data: { priorityFlag: !lead.priorityFlag },
  });
  revalidatePath(`/campaigns/${campaignId}/leads/${leadId}`);
  revalidatePath(`/campaigns/${campaignId}`);
}

// Reessaie l'audit site/SEO/GEO/entreprise d'un lead en erreur, a partir des
// champs deja persistes (nom/adresse/site web) — ne re-scrape pas Google
// Maps (le scraping ayant deja reussi si le lead a un statut ERROR ici).
export async function retryLeadAnalysis(campaignId: string, leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  await prisma.lead.update({ where: { id: leadId }, data: { status: "ANALYZING", errorMessage: null } });

  try {
    await runAnalysisSteps(leadId, lead.name, lead.address, lead.website);
    await prisma.lead.update({ where: { id: leadId }, data: { status: "DONE" } });
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "ERROR", errorMessage: String(error) },
    });
    throw error;
  }

  revalidatePath(`/campaigns/${campaignId}/leads/${leadId}`);
  revalidatePath(`/campaigns/${campaignId}`);
}

// Enrichissement manuel via Pappers (dirigeants + finances), reserve aux
// leads marques prioritaires vu le quota gratuit tres limite (100/mois).
// Champs "representants" et "finances" verifies contre une vraie reponse
// /v2/entreprise le 2026-07-01 (le champ "dirigeants" n'existe pas dans la
// reponse reelle, seul "representants" est utilise ; le fallback est garde
// par securite si Pappers fait evoluer son schema).
export async function enrichWithPappers(campaignId: string, leadId: string) {
  const apiKey = process.env.PAPPERS_API_KEY;
  if (!apiKey) {
    throw new Error("PAPPERS_API_KEY non configuree dans .env.local");
  }

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { companyData: true },
  });

  if (!lead.companyData?.siren) {
    throw new Error("Aucun SIREN identifie pour ce prospect (pas de correspondance gouv.fr).");
  }

  // Verification "legere" avant l'appel (evite un appel inutile si le quota
  // local est deja visiblement epuise) ; le quota n'est reellement consomme
  // qu'apres un appel Pappers reussi, pour ne pas gaspiller le compteur sur
  // des echecs (compte a 0 credit, erreur reseau, timeout...).
  const preCheck = await getQuotaStatus(PAPPERS_SERVICE, PAPPERS_MONTHLY_LIMIT);
  if (!preCheck.allowed) {
    throw new Error(
      `Quota Pappers mensuel atteint (${preCheck.limit} requetes/mois). Reessayez le mois prochain.`,
    );
  }

  const res = await fetch(
    `https://api.pappers.fr/v2/entreprise?siren=${lead.companyData.siren}&api_token=${apiKey}`,
    { signal: AbortSignal.timeout(15000) },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pappers a repondu ${res.status} : ${body.slice(0, 300)}`);
  }

  const quota = await checkAndIncrement(PAPPERS_SERVICE, PAPPERS_MONTHLY_LIMIT);
  if (!quota.allowed) {
    // Course rare entre deux clics quasi simultanes : l'appel Pappers a
    // reussi mais le quota vient d'etre atteint entre-temps par un autre appel.
    throw new Error(
      `Quota Pappers mensuel atteint juste avant l'enregistrement (${quota.limit}/mois). Les donnees recues ne sont pas sauvegardees.`,
    );
  }

  const data = await res.json();
  const dirigeants = data.representants ?? data.dirigeants ?? null;
  const finances = data.finances ?? null;

  await prisma.companyData.update({
    where: { leadId },
    data: {
      pappersFetched: true,
      dirigeantsJson: dirigeants ? JSON.stringify(dirigeants) : null,
      financialsJson: finances ? JSON.stringify(finances) : null,
      rawJson: JSON.stringify(data),
      errorMessage: null,
    },
  });

  revalidatePath(`/campaigns/${campaignId}/leads/${leadId}`);
}

export async function getPappersQuota() {
  return getQuotaStatus(PAPPERS_SERVICE, PAPPERS_MONTHLY_LIMIT);
}
