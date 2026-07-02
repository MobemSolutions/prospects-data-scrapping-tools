import Papa from "papaparse";
import { prisma } from "@/lib/prisma";

export async function exportCampaignCsv(campaignId: string): Promise<{ query: string; csv: string } | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      leads: {
        include: { gmbData: true, websiteAudit: true, seoAudit: true, geoAudit: true, companyData: true },
        orderBy: { opportunityScore: "desc" },
      },
    },
  });

  if (!campaign) return null;

  const rows = campaign.leads.map((lead) => ({
    Nom: lead.name,
    Adresse: lead.address ?? "",
    Téléphone: lead.phone ?? "",
    "Site web": lead.website ?? "",
    Note: lead.rating ?? "",
    Avis: lead.reviewCount ?? "",
    "Photos GMB": lead.gmbData?.hasPhotos ? "Oui" : lead.gmbData ? "Non" : "",
    "Perf. mobile (PSI)": lead.websiteAudit?.mobilePerformance ?? "",
    "SEO technique (PSI)": lead.websiteAudit?.mobileSeo ?? "",
    "Score contenu SEO": lead.seoAudit?.contentScore ?? "",
    OpenPageRank: lead.seoAudit?.openPageRank ?? "",
    "Score GEO (visibilité IA)": lead.geoAudit?.geoScore ?? "",
    "Bots IA bloqués/total": lead.geoAudit
      ? `${lead.geoAudit.aiBotsBlockedCount ?? 0}/${lead.geoAudit.aiBotsTotalChecked ?? 0}`
      : "",
    "llms.txt présent": lead.geoAudit ? (lead.geoAudit.llmsTxtFound ? "Oui" : "Non") : "",
    SIREN: lead.companyData?.siren ?? "",
    "Raison sociale": lead.companyData?.legalName ?? "",
    "Forme juridique": lead.companyData?.legalForm ?? "",
    NAF: lead.companyData?.nafCode ?? "",
    "Date de création": lead.companyData?.creationDate
      ? new Date(lead.companyData.creationDate).toLocaleDateString("fr-FR")
      : "",
    Effectif: lead.companyData?.workforceRange ?? "",
    "Score opportunité": lead.opportunityScore ?? "",
  }));

  // BOM UTF-8 pour qu'Excel affiche correctement les accents francais.
  const csv = "﻿" + Papa.unparse(rows);

  return { query: campaign.query, csv };
}
