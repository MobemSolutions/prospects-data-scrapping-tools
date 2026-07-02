import { prisma } from "@/lib/prisma";
import type { GosomResult } from "@/lib/gosom/client";

// Transforme le payload gosom deja recupere (aucun appel reseau supplementaire).
export async function gmbAnalyze(leadId: string, result: GosomResult) {
  const hasWebsite = !!result.website;
  const hasPhotos = result.imageCount > 0 || !!result.thumbnailUrl;

  await prisma.gmbData.upsert({
    where: { leadId },
    create: {
      leadId,
      hasWebsite,
      hasPhotos,
      photoCount: result.imageCount || null,
      reviewCount: result.reviewCount,
      rating: result.rating ?? 0,
      openingHoursJson: result.openingHoursJson,
      rawJson: JSON.stringify(result.raw),
    },
    update: {
      hasWebsite,
      hasPhotos,
      photoCount: result.imageCount || null,
      reviewCount: result.reviewCount,
      rating: result.rating ?? 0,
      openingHoursJson: result.openingHoursJson,
      rawJson: JSON.stringify(result.raw),
    },
  });
}
