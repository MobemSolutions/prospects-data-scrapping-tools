"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  createProspectPage,
  findAvailableSuffixedName,
  findExistingPageByName,
  overwriteProspectPage,
} from "@/lib/notion/client";

function requireNotionConfig() {
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
    throw new Error("NOTION_API_KEY / NOTION_DATABASE_ID non configurees dans .env.local");
  }
}

export interface NotionConflictCheckResult {
  leadId: string;
  name: string;
  conflict: boolean;
  existingPageUrl?: string;
}

// Verifie, pour chaque lead selectionne, si une page du meme nom existe deja
// dans la VRAIE base Notion (pas seulement Lead.notionPageId) — detecte
// aussi les pages creees manuellement par l'utilisateur.
export async function checkNotionExportConflicts(
  campaignId: string,
  leadIds: string[],
): Promise<NotionConflictCheckResult[]> {
  requireNotionConfig();

  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, campaignId },
    select: { id: true, name: true },
  });

  const results: NotionConflictCheckResult[] = [];
  for (const lead of leads) {
    const existing = await findExistingPageByName(lead.name);
    results.push({
      leadId: lead.id,
      name: lead.name,
      conflict: existing !== null,
      existingPageUrl: existing?.url,
    });
  }
  return results;
}

export type NotionExportAction = "create" | "overwrite" | "duplicate";
export interface NotionExportDecision {
  leadId: string;
  action: NotionExportAction;
}
export interface NotionExportResult {
  leadId: string;
  name: string;
  status: "created" | "updated" | "failed";
  notionUrl?: string;
  error?: string;
}

export async function exportLeadsToNotion(
  campaignId: string,
  decisions: NotionExportDecision[],
): Promise<NotionExportResult[]> {
  requireNotionConfig();

  const leads = await prisma.lead.findMany({
    where: { id: { in: decisions.map((d) => d.leadId) }, campaignId },
    include: { gmbData: true, websiteAudit: true, seoAudit: true, geoAudit: true, companyData: true },
  });
  const leadsById = new Map(leads.map((l) => [l.id, l]));

  const results = await Promise.all(
    decisions.map(async (decision): Promise<NotionExportResult> => {
      const lead = leadsById.get(decision.leadId);
      if (!lead) {
        return { leadId: decision.leadId, name: "?", status: "failed", error: "Lead introuvable" };
      }

      try {
        if (decision.action === "overwrite") {
          const existing = await findExistingPageByName(lead.name);
          if (!existing) {
            throw new Error("Page Notion existante introuvable (supprimee entre-temps ?)");
          }
          const page = await overwriteProspectPage(existing.id, lead);
          await prisma.lead.update({ where: { id: lead.id }, data: { notionPageId: page.id } });
          return { leadId: lead.id, name: lead.name, status: "updated", notionUrl: page.url };
        }

        const title = decision.action === "duplicate" ? await findAvailableSuffixedName(lead.name) : lead.name;
        const page = await createProspectPage(lead, title);
        await prisma.lead.update({ where: { id: lead.id }, data: { notionPageId: page.id } });
        return { leadId: lead.id, name: lead.name, status: "created", notionUrl: page.url };
      } catch (error) {
        return { leadId: lead.id, name: lead.name, status: "failed", error: String(error) };
      }
    }),
  );

  revalidatePath(`/campaigns/${campaignId}`);
  return results;
}
