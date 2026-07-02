import { prisma } from "@/lib/prisma";

// Cle de periode mensuelle (ex: "2026-07"), pure et testable independamment
// de la base de donnees.
export function periodKeyFor(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export interface QuotaStatus {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
}

// Incremente atomiquement le compteur d'un service pour la periode en cours
// SI la limite n'est pas encore atteinte (une seule requete UPDATE conditionnelle,
// donc sure meme avec deux appels quasi simultanes). Retourne allowed=false
// sans incrementer si la limite est deja atteinte.
export async function checkAndIncrement(
  service: string,
  limit: number,
  now: Date = new Date(),
): Promise<QuotaStatus> {
  const periodKey = periodKeyFor(now);

  await prisma.quotaUsage.upsert({
    where: { service_periodKey: { service, periodKey } },
    create: { service, periodKey, count: 0, limit },
    update: {},
  });

  const result = await prisma.quotaUsage.updateMany({
    where: { service, periodKey, count: { lt: limit } },
    data: { count: { increment: 1 } },
  });

  const row = await prisma.quotaUsage.findUniqueOrThrow({
    where: { service_periodKey: { service, periodKey } },
  });

  return {
    allowed: result.count > 0,
    count: row.count,
    limit,
    remaining: Math.max(0, limit - row.count),
  };
}

// Lecture seule (pour affichage UI), n'incremente rien.
export async function getQuotaStatus(
  service: string,
  limit: number,
  now: Date = new Date(),
): Promise<QuotaStatus> {
  const periodKey = periodKeyFor(now);
  const row = await prisma.quotaUsage.findUnique({ where: { service_periodKey: { service, periodKey } } });
  const count = row?.count ?? 0;

  return { allowed: count < limit, count, limit, remaining: Math.max(0, limit - count) };
}
