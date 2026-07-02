import { describe, expect, it } from "vitest";
import { isLikelyJsShell } from "./geoAudit";

describe("isLikelyJsShell", () => {
  it("detecte un shell SPA (peu de mots, ratio texte/html faible)", () => {
    expect(isLikelyJsShell(5, 0.01)).toBe(true);
  });

  it("ne signale pas une page statique riche en contenu", () => {
    expect(isLikelyJsShell(600, 0.4)).toBe(false);
  });

  it("ne signale pas une page courte mais legitime avec un bon ratio texte/html", () => {
    // peu de mots (page d'accueil minimaliste) mais le HTML est presque
    // entierement du texte -> pas un JS shell, juste une page sobre
    expect(isLikelyJsShell(120, 0.4)).toBe(false);
  });

  it("signale un cas limite juste sous les deux seuils", () => {
    expect(isLikelyJsShell(149, 0.049)).toBe(true);
  });
});
