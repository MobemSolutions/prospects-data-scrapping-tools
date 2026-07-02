import { describe, expect, it } from "vitest";
import { buildCandidates } from "./client";

describe("buildCandidates", () => {
  it("genere les candidats du plus specifique au plus court en retirant les mots de tete", () => {
    expect(buildCandidates("restaurant Chatou")).toEqual(["restaurant Chatou", "Chatou"]);
  });

  it("garde ensemble les lieux a plusieurs mots (ex: arrondissement)", () => {
    expect(buildCandidates("plombier paris 15")).toEqual([
      "plombier paris 15",
      "paris 15",
      "15",
    ]);
  });

  it("gere une requete a un seul mot", () => {
    expect(buildCandidates("chatou")).toEqual(["chatou"]);
  });

  it("ignore les espaces superflus", () => {
    expect(buildCandidates("  restaurant   Chatou  ")).toEqual(["restaurant Chatou", "Chatou"]);
  });

  it("retourne un tableau vide pour une chaine vide", () => {
    expect(buildCandidates("")).toEqual([]);
    expect(buildCandidates("   ")).toEqual([]);
  });
});
