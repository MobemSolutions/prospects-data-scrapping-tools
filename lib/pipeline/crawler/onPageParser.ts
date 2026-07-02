import * as cheerio from "cheerio";

const STOPWORDS_FR = new Set([
  // grammaire courante
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "au", "aux",
  "en", "dans", "sur", "pour", "par", "avec", "sans", "ce", "cet", "cette", "ces",
  "que", "qui", "quoi", "dont", "vous", "nous", "il", "elle", "ils", "elles",
  "est", "sont", "etre", "avoir", "plus", "tout", "tous", "toute", "toutes",
  "notre", "votre", "leur", "son", "sa", "ses", "nos", "vos", "leurs", "se",
  "ne", "pas", "mais", "donc", "or", "ni", "car", "si", "comme", "the", "and",
  "of", "to", "in", "for", "on", "with", "at", "by", "from", "is", "are",
  // bruit d'interface/navigation frequent (liens "en savoir plus", banniere
  // cookies, mentions legales...) qui n'a pas de valeur SEO/contenu
  "ouvre", "ouvrir", "fenetre", "cliquez", "cliquer", "ici", "accueil",
  "mentions", "legales", "legal", "politique", "confidentialite", "cookies",
  "cookie", "accepter", "refuser", "consentement", "lire", "suite", "retour",
  "haut", "bas", "menuprincipal", "your", "data", "site", "web", "https",
  "http", "www",
  // bruit de widgets tiers frequents (avis Google embarques via Trustindex
  // et similaires : "avis publie, verifie, source originale...")
  "google", "trustindex", "publie", "verifie", "verifiee", "originale",
]);

export interface OnPageFacts {
  titleTag: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1Count: number;
  h2Count: number;
  wordCount: number;
  topKeywords: { term: string; count: number }[];
  imageCount: number;
  imagesWithAlt: number;
  altCoveragePct: number;
  hasCanonical: boolean;
}

export function extractOnPageFacts(html: string): OnPageFacts {
  const $ = cheerio.load(html);

  const titleTag = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;

  const h1Count = $("h1").length;
  const h2Count = $("h2").length;

  const bodyText = $("body")
    .clone()
    .find("script, style, noscript")
    .remove()
    .end()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const words = bodyText.length > 0 ? bodyText.split(" ") : [];
  const wordCount = words.length;

  const freq = new Map<string, number>();
  for (const raw of words) {
    const term = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9-]/g, "");
    if (term.length < 4 || STOPWORDS_FR.has(term)) continue;
    freq.set(term, (freq.get(term) ?? 0) + 1);
  }
  const topKeywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count }));

  const images = $("img");
  const imageCount = images.length;
  let imagesWithAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt && alt.trim().length > 0) imagesWithAlt += 1;
  });
  const altCoveragePct = imageCount > 0 ? Math.round((imagesWithAlt / imageCount) * 100) : 0;

  const hasCanonical = $('link[rel="canonical"]').length > 0;

  return {
    titleTag,
    titleLength: titleTag?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    h1Count,
    h2Count,
    wordCount,
    topKeywords,
    imageCount,
    imagesWithAlt,
    altCoveragePct,
    hasCanonical,
  };
}

export interface SchemaSignals {
  schemaTypes: string[];
  hasOrganizationOrLocalBusiness: boolean;
  hasFaqOrArticle: boolean;
  sameAsLinks: string[];
}

const LOCAL_BUSINESS_TYPES = ["localbusiness", "organization"];
const CONTENT_TYPES = ["faqpage", "article", "newsarticle", "blogposting"];

function collectTypesAndSameAs(node: unknown, types: Set<string>, sameAs: Set<string>) {
  if (Array.isArray(node)) {
    for (const item of node) collectTypesAndSameAs(item, types, sameAs);
    return;
  }
  if (!node || typeof node !== "object") return;

  const obj = node as Record<string, unknown>;

  const type = obj["@type"];
  if (typeof type === "string") types.add(type);
  else if (Array.isArray(type)) {
    for (const t of type) if (typeof t === "string") types.add(t);
  }

  const sameAsValue = obj["sameAs"];
  if (typeof sameAsValue === "string") sameAs.add(sameAsValue);
  else if (Array.isArray(sameAsValue)) {
    for (const s of sameAsValue) if (typeof s === "string") sameAs.add(s);
  }

  if (Array.isArray(obj["@graph"])) {
    collectTypesAndSameAs(obj["@graph"], types, sameAs);
  }
}

// Reutilise le meme HTML deja recupere pour l'audit SEO on-page : pas de
// second fetch. Sert a la fois au flag generique "hasStructuredData" (SEO)
// et a la classification detaillee des types pertinents pour l'IA (GEO).
export function extractSchemaSignals(html: string): SchemaSignals {
  const $ = cheerio.load(html);
  const types = new Set<string>();
  const sameAs = new Set<string>();

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw?.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      collectTypesAndSameAs(parsed, types, sameAs);
    } catch {
      // JSON-LD malforme, on ignore ce bloc
    }
  });

  const lowerTypes = [...types].map((t) => t.toLowerCase());

  return {
    schemaTypes: [...types],
    hasOrganizationOrLocalBusiness: lowerTypes.some((t) =>
      LOCAL_BUSINESS_TYPES.some((known) => t.includes(known)),
    ),
    hasFaqOrArticle: lowerTypes.some((t) => CONTENT_TYPES.some((known) => t.includes(known))),
    sameAsLinks: [...sameAs],
  };
}

// Heuristique de citabilite : volume de texte visible dans le HTML brut
// (sans execution JS, comme la plupart des robots IA). Un site tres pauvre
// en texte brut est probablement un "JS shell" (SPA cote client).
export function extractVisibleTextStats(html: string): { wordCount: number; textToHtmlByteRatio: number } {
  const $ = cheerio.load(html);
  const text = $("body")
    .clone()
    .find("script, style, noscript")
    .remove()
    .end()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = text.length > 0 ? text.split(" ").length : 0;
  const htmlBytes = Buffer.byteLength(html, "utf8");
  const textBytes = Buffer.byteLength(text, "utf8");
  const textToHtmlByteRatio = htmlBytes > 0 ? textBytes / htmlBytes : 0;

  return { wordCount, textToHtmlByteRatio };
}
