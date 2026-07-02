import { prisma } from "@/lib/prisma";
import { extractPostalCode, findBestMatch, type MatchCandidate } from "@/lib/pipeline/matching";

const GOUV_SEARCH_URL = "https://recherche-entreprises.api.gouv.fr/search";

interface GouvSiege {
  siret: string | null;
  adresse: string | null;
  code_postal: string | null;
}

interface GouvResult {
  siren: string;
  nom_complet: string | null;
  nom_raison_sociale: string | null;
  activite_principale: string | null;
  nature_juridique: string | null;
  date_creation: string | null;
  tranche_effectif_salarie: string | null;
  siege: GouvSiege | null;
}

interface GouvCandidate extends MatchCandidate {
  raw: GouvResult;
}

async function searchGouv(query: string, postalCode: string | null): Promise<GouvResult[]> {
  const params = new URLSearchParams({ q: query, per_page: "5" });
  if (postalCode) params.set("code_postal", postalCode);

  const res = await fetch(`${GOUV_SEARCH_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`recherche-entreprises.api.gouv.fr a repondu ${res.status}`);

  const data = await res.json();
  return (data?.results ?? []) as GouvResult[];
}

// Enrichissement gratuit et illimite (pas de cle requise) via l'API officielle
// Etalab/INSEE. Le nom d'une fiche GMB ne correspond pas toujours a la raison
// sociale : on filtre par code postal quand disponible puis on classe les
// candidats par similarite de nom (cf. lib/pipeline/matching.ts).
export async function companyEnrich(leadId: string, businessName: string, address: string | null) {
  try {
    const postalCode = extractPostalCode(address);
    let results = await searchGouv(businessName, postalCode);

    // Si le filtre par code postal est trop restrictif (adresse GMB parfois
    // legerement differente de l'adresse legale), on retente sans filtre.
    if (results.length === 0 && postalCode) {
      results = await searchGouv(businessName, null);
    }

    const candidates: GouvCandidate[] = results.map((r) => ({
      displayName: r.nom_complet ?? r.nom_raison_sociale ?? "",
      raw: r,
    }));

    const { match, status, confidence } = findBestMatch(businessName, candidates);

    if (!match) {
      await prisma.companyData.upsert({
        where: { leadId },
        create: { leadId, matchStatus: "UNMATCHED", matchConfidence: confidence },
        update: { matchStatus: "UNMATCHED", matchConfidence: confidence },
      });
      return;
    }

    const company = match.raw;
    const data = {
      siren: company.siren,
      siret: company.siege?.siret ?? null,
      legalName: company.nom_complet ?? company.nom_raison_sociale,
      legalForm: company.nature_juridique,
      nafCode: company.activite_principale,
      nafLabel: null,
      creationDate: company.date_creation ? new Date(company.date_creation) : null,
      workforceRange: company.tranche_effectif_salarie,
      matchConfidence: confidence,
      matchStatus: status,
      rawJson: JSON.stringify(company),
    };

    await prisma.companyData.upsert({
      where: { leadId },
      create: { leadId, ...data },
      update: data,
    });
  } catch (error) {
    await prisma.companyData.upsert({
      where: { leadId },
      create: { leadId, matchStatus: "UNMATCHED", errorMessage: String(error) },
      update: { errorMessage: String(error) },
    });
  }
}
