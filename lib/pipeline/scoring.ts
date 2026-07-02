import { prisma } from "@/lib/prisma";

// Poids nommes du score final. Plus le score est eleve, plus la presence
// digitale est faible -> meilleur prospect pour l'agence.
export const OPPORTUNITY_WEIGHTS = {
  gmb: 0.3,
  tech: 0.25,
  seo: 0.25,
  geo: 0.2,
};

export interface ScoringFacts {
  hasWebsite: boolean;
  gmb: {
    hasPhotos: boolean;
    reviewCount: number;
    rating: number;
  } | null;
  tech: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  } | null;
  seoContentScore: number | null;
  geoScore: number | null;
}

export interface ScoreBreakdown {
  gmbMaturity: number;
  techMaturity: number | null;
  seoMaturity: number | null;
  geoMaturity: number | null;
  gmbGap: number;
  techGap: number;
  seoGap: number;
  geoGap: number;
  weights: typeof OPPORTUNITY_WEIGHTS;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeGmbMaturity(facts: ScoringFacts): number {
  if (!facts.gmb) return facts.hasWebsite ? 40 : 0;

  const websitePoints = facts.hasWebsite ? 40 : 0;
  const photosPoints = facts.gmb.hasPhotos ? 20 : 0;
  const reviewsPoints = (Math.min(facts.gmb.reviewCount, 50) / 50) * 20;
  const ratingPoints = (clamp(facts.gmb.rating, 0, 5) / 5) * 20;

  return websitePoints + photosPoints + reviewsPoints + ratingPoints;
}

function computeTechMaturity(facts: ScoringFacts): number | null {
  if (!facts.hasWebsite || !facts.tech) return null;

  const scores = [
    facts.tech.performance,
    facts.tech.accessibility,
    facts.tech.bestPractices,
    facts.tech.seo,
  ].filter((s): s is number => s != null);

  if (scores.length === 0) return null;

  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

// Calcule le score d'opportunite a partir de faits deja charges (fonction
// pure, testable sans base de donnees).
export function computeOpportunityScoreFromFacts(facts: ScoringFacts): ScoreResult {
  const gmbMaturity = computeGmbMaturity(facts);
  const gmbGap = 100 - gmbMaturity;

  const techMaturity = computeTechMaturity(facts);
  const techGap = facts.hasWebsite ? 100 - (techMaturity ?? 0) : 100;

  const seoMaturity = facts.hasWebsite ? (facts.seoContentScore ?? 0) : null;
  const seoGap = facts.hasWebsite ? 100 - (seoMaturity ?? 0) : 100;

  const geoMaturity = facts.hasWebsite ? (facts.geoScore ?? 0) : null;
  const geoGap = facts.hasWebsite ? 100 - (geoMaturity ?? 0) : 100;

  const score = Math.round(
    OPPORTUNITY_WEIGHTS.gmb * gmbGap +
      OPPORTUNITY_WEIGHTS.tech * techGap +
      OPPORTUNITY_WEIGHTS.seo * seoGap +
      OPPORTUNITY_WEIGHTS.geo * geoGap,
  );

  return {
    score: clamp(score, 0, 100),
    breakdown: {
      gmbMaturity,
      techMaturity,
      seoMaturity,
      geoMaturity,
      gmbGap,
      techGap,
      seoGap,
      geoGap,
      weights: OPPORTUNITY_WEIGHTS,
    },
  };
}

// Charge les faits necessaires depuis la base puis calcule et persiste le score.
export async function computeAndStoreOpportunityScore(leadId: string): Promise<ScoreResult> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { gmbData: true, websiteAudit: true, seoAudit: true, geoAudit: true },
  });

  const facts: ScoringFacts = {
    hasWebsite: !!lead.website,
    gmb: lead.gmbData
      ? {
          hasPhotos: lead.gmbData.hasPhotos,
          reviewCount: lead.gmbData.reviewCount,
          rating: lead.gmbData.rating,
        }
      : null,
    tech: lead.websiteAudit
      ? {
          performance: lead.websiteAudit.mobilePerformance,
          accessibility: lead.websiteAudit.mobileAccessibility,
          bestPractices: lead.websiteAudit.mobileBestPractices,
          seo: lead.websiteAudit.mobileSeo,
        }
      : null,
    seoContentScore: lead.seoAudit?.contentScore ?? null,
    geoScore: lead.geoAudit?.geoScore ?? null,
  };

  const result = computeOpportunityScoreFromFacts(facts);

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      opportunityScore: result.score,
      scoreBreakdownJson: JSON.stringify(result.breakdown),
    },
  });

  return result;
}
