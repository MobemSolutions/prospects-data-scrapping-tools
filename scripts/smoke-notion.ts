// Smoke test manuel de l'integration Notion : verifie schema/recherche/
// creation/detection/ecrasement/suffixage contre la vraie base Notion de
// l'utilisateur. Usage : npx tsx scripts/smoke-notion.ts
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import {
  getDatabaseSchema,
  findExistingPageByName,
  findAvailableSuffixedName,
  createProspectPage,
  overwriteProspectPage,
} from "../lib/notion/client";

const TEST_NAME = "Test Outil Prospection (a supprimer)";

const FAKE_LEAD = {
  name: TEST_NAME,
  phone: "06 12 34 56 78",
  website: "https://example.com",
  category: "Plombier",
  opportunityScore: 72,
  scoreBreakdownJson: JSON.stringify({ gmbGap: 40, techGap: 80, seoGap: 90, geoGap: 70 }),
  gmbData: { rating: 4.2, reviewCount: 18, hasPhotos: true, photoCount: 5, hasWebsite: true },
  websiteAudit: { mobilePerformance: 55, mobileAccessibility: 88, mobileSeo: 70 },
  seoAudit: {
    contentScore: 60,
    openPageRank: 1.2,
    topKeywordsJson: JSON.stringify([{ term: "plombier", count: 5 }, { term: "depannage", count: 3 }]),
  },
  geoAudit: { geoScore: 65, aiBotsBlockedCount: 0, aiBotsTotalChecked: 10, llmsTxtFound: false },
  companyData: {
    siren: "123456789",
    legalName: "PLOMBERIE TEST",
    legalForm: "SARL",
    pappersFetched: false,
    dirigeantsJson: null,
  },
};

async function main() {
  console.log("1. Schema de la base Notion :");
  const schema = await getDatabaseSchema();
  console.log("   dataSourceId:", schema.dataSourceId);
  console.log("   propriete titre:", schema.titlePropertyName);
  console.log("   proprietes:", schema.properties);

  console.log("\n2. Recherche avant creation (doit etre vide) :");
  const before = await findExistingPageByName(TEST_NAME);
  console.log("   ->", before);

  console.log("\n3. Creation d'une page test :");
  const created = await createProspectPage(FAKE_LEAD);
  console.log("   -> creee :", created.url);

  console.log("\n4. Recherche apres creation (doit trouver la page) :");
  const after = await findExistingPageByName(TEST_NAME);
  console.log("   ->", after);

  console.log("\n5. Ecrasement (donnees modifiees) :");
  const overwritten = await overwriteProspectPage(created.id, {
    ...FAKE_LEAD,
    opportunityScore: 15,
    gmbData: { ...FAKE_LEAD.gmbData, rating: 4.9, reviewCount: 200 },
  });
  console.log("   -> mise a jour :", overwritten.url);
  console.log("   -> ouvrez ce lien pour verifier a l'oeil que les blocs ont bien ete remplaces");

  console.log("\n6. Calcul du prochain nom libre (doit retourner '... (1)') :");
  const suffixed = await findAvailableSuffixedName(TEST_NAME);
  console.log("   ->", suffixed);

  console.log(
    "\nTermine. Pensez a supprimer manuellement la page de test dans Notion :",
    created.url,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
