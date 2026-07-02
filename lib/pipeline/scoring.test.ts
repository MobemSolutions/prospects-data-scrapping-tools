import { describe, expect, it } from "vitest";
import { computeOpportunityScoreFromFacts, type ScoringFacts } from "./scoring";

const NO_WEBSITE: ScoringFacts = {
  hasWebsite: false,
  gmb: { hasPhotos: false, reviewCount: 0, rating: 0 },
  tech: null,
  seoContentScore: null,
  geoScore: null,
};

const PERFECT: ScoringFacts = {
  hasWebsite: true,
  gmb: { hasPhotos: true, reviewCount: 100, rating: 5 },
  tech: { performance: 100, accessibility: 100, bestPractices: 100, seo: 100 },
  seoContentScore: 100,
  geoScore: 100,
};

const WORST_WITH_WEBSITE: ScoringFacts = {
  hasWebsite: true,
  gmb: { hasPhotos: false, reviewCount: 0, rating: 0 },
  tech: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
  seoContentScore: 0,
  geoScore: 0,
};

describe("computeOpportunityScoreFromFacts", () => {
  it("attribue un score eleve a un prospect sans site web", () => {
    const { score } = computeOpportunityScoreFromFacts(NO_WEBSITE);
    expect(score).toBeGreaterThanOrEqual(65);
  });

  it("attribue un score proche de 0 a un prospect parfait sur tous les axes", () => {
    const { score } = computeOpportunityScoreFromFacts(PERFECT);
    expect(score).toBeLessThanOrEqual(5);
  });

  it("attribue un score eleve a un prospect avec site mais tout au plus bas (plafonne par le credit 'a un site')", () => {
    // hasWebsite=true accorde toujours 40/100 de gmbMaturity par design (avoir
    // un site est deja un signal de maturite, meme si tout le reste est nul) :
    // score max theorique ici = round(0.30*60 + 0.25*100 + 0.25*100 + 0.20*100) = 88.
    const { score } = computeOpportunityScoreFromFacts(WORST_WITH_WEBSITE);
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it("reste borne entre 0 et 100 et ne plante pas avec des champs nuls", () => {
    const facts: ScoringFacts = {
      hasWebsite: true,
      gmb: null,
      tech: null,
      seoContentScore: null,
      geoScore: null,
    };
    const { score } = computeOpportunityScoreFromFacts(facts);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(Number.isNaN(score)).toBe(false);
  });

  it("les poids somment a 1", () => {
    const { breakdown } = computeOpportunityScoreFromFacts(PERFECT);
    const sum = Object.values(breakdown.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("une meilleure note GMB ne peut pas faire baisser le score (monotonie)", () => {
    const low: ScoringFacts = { ...WORST_WITH_WEBSITE, gmb: { hasPhotos: false, reviewCount: 0, rating: 1 } };
    const high: ScoringFacts = { ...WORST_WITH_WEBSITE, gmb: { hasPhotos: false, reviewCount: 0, rating: 5 } };
    const scoreLow = computeOpportunityScoreFromFacts(low).score;
    const scoreHigh = computeOpportunityScoreFromFacts(high).score;
    expect(scoreHigh).toBeLessThanOrEqual(scoreLow);
  });

  it("absence de site penalise au maximum les gaps tech/seo/geo meme si des donnees existent", () => {
    const facts: ScoringFacts = {
      hasWebsite: false,
      gmb: { hasPhotos: true, reviewCount: 50, rating: 5 },
      tech: { performance: 100, accessibility: 100, bestPractices: 100, seo: 100 },
      seoContentScore: 100,
      geoScore: 100,
    };
    const { breakdown } = computeOpportunityScoreFromFacts(facts);
    expect(breakdown.techGap).toBe(100);
    expect(breakdown.seoGap).toBe(100);
    expect(breakdown.geoGap).toBe(100);
  });
});
