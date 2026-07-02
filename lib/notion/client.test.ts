import { describe, expect, it } from "vitest";
import {
  buildPropertiesPayload,
  buildSynthesisBlocks,
  computeNextFreeSuffixedName,
  type LeadForNotion,
  type LeadForSynthesis,
  type NotionDbSchema,
} from "./client";

describe("computeNextFreeSuffixedName", () => {
  it("retourne le nom de base si aucun conflit", () => {
    expect(computeNextFreeSuffixedName("Plomberie Dupont", [])).toBe("Plomberie Dupont");
    expect(computeNextFreeSuffixedName("Plomberie Dupont", ["Autre Nom"])).toBe("Plomberie Dupont");
  });

  it("ajoute (1) si le nom de base est pris", () => {
    expect(computeNextFreeSuffixedName("Plomberie Dupont", ["Plomberie Dupont"])).toBe(
      "Plomberie Dupont (1)",
    );
  });

  it("incremente jusqu'a trouver un nom libre", () => {
    const existing = ["Plomberie Dupont", "Plomberie Dupont (1)", "Plomberie Dupont (2)"];
    expect(computeNextFreeSuffixedName("Plomberie Dupont", existing)).toBe("Plomberie Dupont (3)");
  });

  it("retourne (1) meme si (2) est deja pris mais pas (1) (premier libre, pas le plus grand)", () => {
    const existing = ["Plomberie Dupont", "Plomberie Dupont (2)"];
    expect(computeNextFreeSuffixedName("Plomberie Dupont", existing)).toBe("Plomberie Dupont (1)");
  });
});

describe("buildPropertiesPayload", () => {
  const lead: LeadForNotion = {
    name: "Plomberie Dupont",
    phone: "0612345678",
    website: "https://plomberie-dupont.fr",
    category: "Plombier",
  };

  it("inclut toujours le titre, avec titleOverride prioritaire sur lead.name", () => {
    const schema: NotionDbSchema = { dataSourceId: "ds1", titlePropertyName: "Nom", properties: {} };
    const payload = buildPropertiesPayload(lead, schema, "Plomberie Dupont (1)");
    expect(payload["Nom"]).toEqual({ title: [{ text: { content: "Plomberie Dupont (1)" } }] });
  });

  it("inclut une propriete presente avec le bon type", () => {
    const schema: NotionDbSchema = {
      dataSourceId: "ds1",
      titlePropertyName: "Nom",
      properties: { Téléphone: { type: "phone_number" } },
    };
    const payload = buildPropertiesPayload(lead, schema);
    expect(payload["Téléphone"]).toEqual({ phone_number: "0612345678" });
  });

  it("ignore une propriete absente du schema", () => {
    const schema: NotionDbSchema = { dataSourceId: "ds1", titlePropertyName: "Nom", properties: {} };
    const payload = buildPropertiesPayload(lead, schema);
    expect(payload["Téléphone"]).toBeUndefined();
    expect(payload["Secteur d'activité"]).toBeUndefined();
  });

  it("ignore une propriete dont le type ne correspond pas (evite un crash sur un champ renomme)", () => {
    const schema: NotionDbSchema = {
      dataSourceId: "ds1",
      titlePropertyName: "Nom",
      properties: { Téléphone: { type: "rich_text" } }, // type inattendu
    };
    const payload = buildPropertiesPayload(lead, schema);
    expect(payload["Téléphone"]).toBeUndefined();
  });

  it("adapte URL site selon que la propriete est de type url ou rich_text", () => {
    const urlSchema: NotionDbSchema = {
      dataSourceId: "ds1",
      titlePropertyName: "Nom",
      properties: { "URL site": { type: "url" } },
    };
    expect(buildPropertiesPayload(lead, urlSchema)["URL site"]).toEqual({
      url: "https://plomberie-dupont.fr",
    });

    const richTextSchema: NotionDbSchema = {
      dataSourceId: "ds1",
      titlePropertyName: "Nom",
      properties: { "URL site": { type: "rich_text" } },
    };
    expect(buildPropertiesPayload(lead, richTextSchema)["URL site"]).toEqual({
      rich_text: [{ text: { content: "https://plomberie-dupont.fr" } }],
    });
  });

  it("ne remplit pas Statut/Méthode si le lead n'a pas de site (valeurs par defaut toujours appliquees)", () => {
    const schema: NotionDbSchema = {
      dataSourceId: "ds1",
      titlePropertyName: "Nom",
      properties: { Statut: { type: "select" }, Méthode: { type: "select" } },
    };
    const payload = buildPropertiesPayload({ ...lead, website: null }, schema);
    expect(payload["Statut"]).toEqual({ select: { name: "Nouveau" } });
    expect(payload["Méthode"]).toEqual({ select: { name: "Outbound" } });
  });
});

describe("buildSynthesisBlocks", () => {
  const emptyLead: LeadForSynthesis = {
    opportunityScore: null,
    scoreBreakdownJson: null,
    gmbData: null,
    websiteAudit: null,
    seoAudit: null,
    geoAudit: null,
    companyData: null,
  };

  it("ne plante pas et produit des sections de repli quand tout est null", () => {
    expect(() => buildSynthesisBlocks(emptyLead)).not.toThrow();
    const blocks = buildSynthesisBlocks(emptyLead);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("gere un scoreBreakdownJson malforme sans planter", () => {
    const lead: LeadForSynthesis = { ...emptyLead, opportunityScore: 50, scoreBreakdownJson: "{ invalide" };
    expect(() => buildSynthesisBlocks(lead)).not.toThrow();
  });

  it("gere un topKeywordsJson / dirigeantsJson malforme sans planter", () => {
    const lead: LeadForSynthesis = {
      ...emptyLead,
      seoAudit: { contentScore: 80, openPageRank: null, topKeywordsJson: "{ invalide" },
      companyData: {
        siren: "123456789",
        legalName: "Test",
        legalForm: "SARL",
        pappersFetched: true,
        dirigeantsJson: "{ invalide",
      },
    };
    expect(() => buildSynthesisBlocks(lead)).not.toThrow();
  });

  it("produit plus de blocs quand toutes les donnees sont presentes", () => {
    const fullLead: LeadForSynthesis = {
      opportunityScore: 72,
      scoreBreakdownJson: JSON.stringify({ gmbGap: 40, techGap: 80, seoGap: 90, geoGap: 70 }),
      gmbData: { rating: 4.2, reviewCount: 18, hasPhotos: true, photoCount: 5, hasWebsite: true },
      websiteAudit: { mobilePerformance: 55, mobileAccessibility: 88, mobileSeo: 70 },
      seoAudit: {
        contentScore: 60,
        openPageRank: 1.2,
        topKeywordsJson: JSON.stringify([{ term: "plombier", count: 5 }]),
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
    const emptyBlocks = buildSynthesisBlocks(emptyLead);
    const fullBlocks = buildSynthesisBlocks(fullLead);
    expect(fullBlocks.length).toBeGreaterThan(emptyBlocks.length);
  });
});
