import { describe, expect, it } from "vitest";
import { extractPostalCode, findBestMatch, normalizeCompanyName, similarity } from "./matching";

describe("normalizeCompanyName", () => {
  it("retire les accents, la casse et la ponctuation", () => {
    expect(normalizeCompanyName("Café de la Place !")).toBe("cafe de la place");
  });

  it("retire les formes juridiques courantes", () => {
    expect(normalizeCompanyName("Plomberie Dupont SARL")).toBe("plomberie dupont");
    expect(normalizeCompanyName("SAS Boulangerie Martin")).toBe("boulangerie martin");
  });
});

describe("similarity", () => {
  it("retourne 1 pour deux noms identiques apres normalisation", () => {
    expect(similarity("Plomberie Dupont", "PLOMBERIE DUPONT")).toBe(1);
  });

  it("retourne un score eleve pour une variante avec forme juridique", () => {
    expect(similarity("Plomberie Dupont", "Plomberie Dupont SARL")).toBeGreaterThan(0.7);
  });

  it("retourne un score eleve pour une variante accentuee", () => {
    expect(similarity("Boulangerie Herrero", "BOULANGERIE HÉRRÉRO")).toBeGreaterThan(0.8);
  });

  it("retourne un score faible pour des noms sans rapport", () => {
    expect(similarity("Plomberie Dupont", "Boulangerie Martin")).toBeLessThan(0.4);
  });
});

describe("findBestMatch", () => {
  it("classe MATCHED un candidat tres proche", () => {
    const result = findBestMatch("Plomberie Dupont", [
      { displayName: "PLOMBERIE DUPONT", siren: "111" },
      { displayName: "Boulangerie Martin", siren: "222" },
    ]);
    expect(result.status).toBe("MATCHED");
    expect(result.match?.siren).toBe("111");
  });

  it("classe LOW_CONFIDENCE un candidat partiellement proche", () => {
    const result = findBestMatch("Plomberie Dupont", [
      { displayName: "Entreprise Generale Dupont", siren: "333" },
    ]);
    expect(result.status).toBe("LOW_CONFIDENCE");
  });

  it("classe UNMATCHED quand aucun candidat ne ressemble", () => {
    const result = findBestMatch("Plomberie Dupont", [
      { displayName: "Restaurant Le Gourmet", siren: "444" },
    ]);
    expect(result.status).toBe("UNMATCHED");
    expect(result.match).toBeNull();
  });

  it("classe UNMATCHED sans planter quand il n'y a aucun candidat", () => {
    const result = findBestMatch("Plomberie Dupont", []);
    expect(result.status).toBe("UNMATCHED");
    expect(result.match).toBeNull();
    expect(result.confidence).toBe(0);
  });
});

describe("extractPostalCode", () => {
  it("extrait un code postal francais d'une adresse", () => {
    expect(extractPostalCode("12 rue de Paris, 78400 Chatou")).toBe("78400");
  });

  it("retourne null si aucun code postal n'est present", () => {
    expect(extractPostalCode("Adresse inconnue")).toBeNull();
  });

  it("retourne null pour une adresse absente", () => {
    expect(extractPostalCode(null)).toBeNull();
    expect(extractPostalCode(undefined)).toBeNull();
  });
});
