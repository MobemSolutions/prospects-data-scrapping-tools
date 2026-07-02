import levenshtein from "fast-levenshtein";

const LEGAL_SUFFIXES = /\b(sarl|sas|sasu|eurl|sa|sci|ei|micro-entreprise|entreprise individuelle)\b/g;

// Normalisation pour comparer un nom GMB (souvent une enseigne commerciale)
// a une raison sociale officielle : accents, casse, formes juridiques et
// ponctuation retires.
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(LEGAL_SUFFIXES, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Similarite de Levenshtein normalisee entre 0 (rien en commun) et 1 (identique).
export function similarity(a: string, b: string): number {
  const normA = normalizeCompanyName(a);
  const normB = normalizeCompanyName(b);
  const maxLength = Math.max(normA.length, normB.length);
  if (maxLength === 0) return 1;
  const distance = levenshtein.get(normA, normB);
  return 1 - distance / maxLength;
}

// Extrait un code postal francais (5 chiffres) d'une adresse GMB en texte libre.
export function extractPostalCode(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

export const MATCH_CONFIDENCE_THRESHOLDS = {
  matched: 0.6,
  lowConfidence: 0.35,
};

export type MatchStatus = "MATCHED" | "LOW_CONFIDENCE" | "UNMATCHED";

export interface MatchCandidate {
  displayName: string;
  [key: string]: unknown;
}

export interface MatchResult<T> {
  match: T | null;
  status: MatchStatus;
  confidence: number;
}

// Fonction pure : choisit le meilleur candidat deja recupere (aucun appel
// reseau ici, cf. companyEnrich.ts pour la recherche via l'API gouv.fr).
export function findBestMatch<T extends MatchCandidate>(
  businessName: string,
  candidates: T[],
): MatchResult<T> {
  if (candidates.length === 0) {
    return { match: null, status: "UNMATCHED", confidence: 0 };
  }

  const scored = candidates
    .map((candidate) => ({ candidate, score: similarity(businessName, candidate.displayName) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  const status: MatchStatus =
    best.score >= MATCH_CONFIDENCE_THRESHOLDS.matched
      ? "MATCHED"
      : best.score >= MATCH_CONFIDENCE_THRESHOLDS.lowConfidence
        ? "LOW_CONFIDENCE"
        : "UNMATCHED";

  return { match: status === "UNMATCHED" ? null : best.candidate, status, confidence: best.score };
}
