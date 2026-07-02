import { prisma } from "@/lib/prisma";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

interface PsiCategoryScores {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
}

function scoreOf(raw: unknown): number | null {
  if (typeof raw !== "number") return null;
  return Math.round(raw * 100);
}

function numericAuditValue(audits: Record<string, unknown>, id: string): number | null {
  const audit = audits[id] as { numericValue?: unknown } | undefined;
  return typeof audit?.numericValue === "number" ? audit.numericValue : null;
}

async function fetchPsi(url: string, apiKey: string, strategy: "mobile" | "desktop") {
  const params = new URLSearchParams({ url, strategy, key: apiKey });
  for (const category of CATEGORIES) params.append("category", category);

  const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PageSpeed Insights a repondu ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const categories = data?.lighthouseResult?.categories ?? {};
  const audits = data?.lighthouseResult?.audits ?? {};

  return {
    performance: scoreOf(categories.performance?.score),
    accessibility: scoreOf(categories.accessibility?.score),
    bestPractices: scoreOf(categories["best-practices"]?.score),
    seo: scoreOf(categories.seo?.score),
    lcpMs: numericAuditValue(audits, "largest-contentful-paint"),
    cls: numericAuditValue(audits, "cumulative-layout-shift"),
    inpMs: numericAuditValue(audits, "interaction-to-next-paint"),
  } satisfies PsiCategoryScores;
}

// Audit technique via PageSpeed Insights (gratuit, 25k requetes/jour).
// Mobile + desktop : deux appels PSI par lead (le schema WebsiteAudit a deja
// les colonnes desktop*, elles n'etaient simplement jamais renseignees).
export async function websiteAudit(leadId: string, url: string) {
  const apiKey = process.env.PSI_API_KEY;

  if (!apiKey) {
    await prisma.websiteAudit.upsert({
      where: { leadId },
      create: { leadId, url, errorMessage: "PSI_API_KEY non configuree" },
      update: { errorMessage: "PSI_API_KEY non configuree" },
    });
    return;
  }

  try {
    const [mobile, desktop] = await Promise.all([
      fetchPsi(url, apiKey, "mobile"),
      fetchPsi(url, apiKey, "desktop"),
    ]);

    const fields = {
      mobilePerformance: mobile.performance,
      mobileAccessibility: mobile.accessibility,
      mobileBestPractices: mobile.bestPractices,
      mobileSeo: mobile.seo,
      desktopPerformance: desktop.performance,
      desktopAccessibility: desktop.accessibility,
      desktopBestPractices: desktop.bestPractices,
      desktopSeo: desktop.seo,
      lcpMs: mobile.lcpMs,
      cls: mobile.cls,
      inpMs: mobile.inpMs,
      rawJson: JSON.stringify({ mobile, desktop }),
    };

    await prisma.websiteAudit.upsert({
      where: { leadId },
      create: { leadId, url, ...fields },
      update: { ...fields, errorMessage: null },
    });
  } catch (error) {
    await prisma.websiteAudit.upsert({
      where: { leadId },
      create: { leadId, url, errorMessage: String(error) },
      update: { errorMessage: String(error) },
    });
  }
}
