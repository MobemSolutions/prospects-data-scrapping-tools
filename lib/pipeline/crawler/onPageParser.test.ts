import { describe, expect, it } from "vitest";
import { extractOnPageFacts, extractSchemaSignals, extractVisibleTextStats } from "./onPageParser";

describe("extractOnPageFacts", () => {
  it("extrait titre, meta, h1/h2, mots-cles et alt sur une page complete", () => {
    const html = `
      <html><head>
        <title>Plomberie Dupont - Depannage Paris 15</title>
        <meta name="description" content="Plombier a Paris 15, depannage urgent, devis gratuit, intervention rapide sur Paris.">
        <link rel="canonical" href="https://plomberie-dupont.fr/">
      </head><body>
        <h1>Plomberie Dupont</h1>
        <h2>Nos services</h2>
        <h2>Contact</h2>
        <p>Plomberie Dupont intervient rapidement pour tout depannage plomberie a Paris.</p>
        <img src="a.jpg" alt="Plombier au travail">
        <img src="b.jpg">
      </body></html>
    `;

    const facts = extractOnPageFacts(html);

    expect(facts.titleTag).toContain("Plomberie Dupont");
    expect(facts.h1Count).toBe(1);
    expect(facts.h2Count).toBe(2);
    expect(facts.metaDescription).toContain("depannage urgent");
    expect(facts.hasCanonical).toBe(true);
    expect(facts.imageCount).toBe(2);
    expect(facts.imagesWithAlt).toBe(1);
    expect(facts.altCoveragePct).toBe(50);
    expect(facts.wordCount).toBeGreaterThan(0);
    expect(facts.topKeywords.some((k) => k.term.includes("plomberie"))).toBe(true);
  });

  it("gere une page sans title, meta, h1 ni images", () => {
    const html = "<html><head></head><body><p></p></body></html>";
    const facts = extractOnPageFacts(html);

    expect(facts.titleTag).toBeNull();
    expect(facts.titleLength).toBe(0);
    expect(facts.metaDescription).toBeNull();
    expect(facts.h1Count).toBe(0);
    expect(facts.imageCount).toBe(0);
    expect(facts.altCoveragePct).toBe(0);
    expect(facts.hasCanonical).toBe(false);
  });

  it("ignore le contenu des balises script et style dans le comptage de mots", () => {
    const html = `<html><body><script>var x = "beaucoup de faux mots ici qui ne doivent pas compter";</script><style>.a{color:red}</style><p>Un seul vrai paragraphe.</p></body></html>`;
    const facts = extractOnPageFacts(html);
    expect(facts.wordCount).toBeLessThan(10);
  });
});

describe("extractSchemaSignals", () => {
  it("detecte LocalBusiness et sameAs", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"LocalBusiness","name":"Plomberie Dupont","sameAs":["https://facebook.com/dupont","https://instagram.com/dupont"]}
    </script></head><body></body></html>`;

    const signals = extractSchemaSignals(html);
    expect(signals.hasOrganizationOrLocalBusiness).toBe(true);
    expect(signals.hasFaqOrArticle).toBe(false);
    expect(signals.sameAsLinks).toHaveLength(2);
  });

  it("detecte FAQPage via @graph", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[{"@type":"FAQPage","mainEntity":[]}]}
    </script></head><body></body></html>`;

    const signals = extractSchemaSignals(html);
    expect(signals.hasFaqOrArticle).toBe(true);
    expect(signals.hasOrganizationOrLocalBusiness).toBe(false);
  });

  it("retourne des valeurs vides sans JSON-LD", () => {
    const signals = extractSchemaSignals("<html><body><p>rien ici</p></body></html>");
    expect(signals.schemaTypes).toEqual([]);
    expect(signals.hasOrganizationOrLocalBusiness).toBe(false);
    expect(signals.sameAsLinks).toEqual([]);
  });

  it("ignore un bloc JSON-LD malforme sans planter", () => {
    const html = `<html><head><script type="application/ld+json">{ not valid json </script></head><body></body></html>`;
    expect(() => extractSchemaSignals(html)).not.toThrow();
    expect(extractSchemaSignals(html).schemaTypes).toEqual([]);
  });
});

describe("extractVisibleTextStats", () => {
  it("detecte un ratio texte/html faible pour un shell JS quasi vide", () => {
    const html = `<html><body><div id="root"></div><script src="bundle.js"></script></body></html>`;
    const stats = extractVisibleTextStats(html);
    expect(stats.wordCount).toBeLessThan(10);
  });

  it("detecte un contenu texte riche pour une page statique", () => {
    const words = Array.from({ length: 400 }, (_, i) => `mot${i}`).join(" ");
    const html = `<html><body><p>${words}</p></body></html>`;
    const stats = extractVisibleTextStats(html);
    expect(stats.wordCount).toBeGreaterThanOrEqual(400);
    expect(stats.textToHtmlByteRatio).toBeGreaterThan(0.5);
  });
});
