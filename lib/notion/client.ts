import { Client, isFullDatabase, isFullPage } from "@notionhq/client";
import type { BlockObjectRequest, CreatePageParameters, PageObjectResponse } from "@notionhq/client";
import { notionQueue } from "@/lib/notion/queue";

type NotionPageProperties = NonNullable<CreatePageParameters["properties"]>;

// L'API Notion (version 2025-09-03, celle par defaut du SDK @notionhq/client)
// introduit une couche "data source" entre la base ("database") et ses pages :
// une base ne contient plus directement de "properties", elle reference une ou
// plusieurs data sources (en pratique une seule pour une base classique), et
// c'est la data source qui porte le schema des proprietes et qui est
// interrogeable via dataSources.query. Verifie contre les types du SDK
// (node_modules/@notionhq/client/build/src/api-endpoints/{databases,data-sources}.d.ts)
// le 2026-07-02.

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error("NOTION_API_KEY non configuree dans .env.local");
  _client = new Client({ auth: apiKey });
  return _client;
}

function getDatabaseId(): string {
  const id = process.env.NOTION_DATABASE_ID;
  if (!id) throw new Error("NOTION_DATABASE_ID non configuree dans .env.local");
  return id;
}

export interface NotionDbSchema {
  dataSourceId: string;
  titlePropertyName: string;
  properties: Record<string, { type: string }>;
}

let _schemaCache: NotionDbSchema | null = null;

// Recupere (et met en cache) le schema reel de la base Notion cible : id de
// la data source, nom de la propriete "title" (peut s'appeler n'importe
// quoi), et la liste des proprietes disponibles avec leur type. C'est ce qui
// permet de mapper nos donnees sans deviner a l'avance les noms/types exacts.
export async function getDatabaseSchema(forceRefresh = false): Promise<NotionDbSchema> {
  if (_schemaCache && !forceRefresh) return _schemaCache;

  const database = await notionQueue.add(() =>
    getClient().databases.retrieve({ database_id: getDatabaseId() }),
  );

  if (!isFullDatabase(database)) {
    throw new Error("Reponse Notion incomplete lors de la lecture de la base (permissions insuffisantes ?).");
  }

  const dataSourceRef = database.data_sources[0];
  if (!dataSourceRef) {
    throw new Error("Aucune data source trouvee pour cette base Notion (base vide ou inaccessible).");
  }

  const dataSource = await notionQueue.add(() =>
    getClient().dataSources.retrieve({ data_source_id: dataSourceRef.id }),
  );

  const properties: Record<string, { type: string }> = {};
  let titlePropertyName: string | null = null;
  for (const [name, prop] of Object.entries(dataSource.properties)) {
    properties[name] = { type: prop.type };
    if (prop.type === "title") titlePropertyName = name;
  }
  if (!titlePropertyName) {
    throw new Error("Aucune propriete de type 'title' trouvee dans la base Notion cible.");
  }

  _schemaCache = { dataSourceId: dataSourceRef.id, titlePropertyName, properties };
  return _schemaCache;
}

function extractTitleText(page: PageObjectResponse, titlePropertyName: string): string | null {
  const prop = page.properties[titlePropertyName];
  if (!prop || prop.type !== "title") return null;
  return prop.title.map((t) => t.plain_text).join("");
}

// Recherche une page existante par titre exact - c'est la verification de
// doublon contre la VRAIE base Notion (pas seulement Lead.notionPageId), pour
// detecter aussi les pages creees manuellement par l'utilisateur.
export async function findExistingPageByName(name: string): Promise<{ id: string; url: string } | null> {
  const schema = await getDatabaseSchema();
  const res = await notionQueue.add(() =>
    getClient().dataSources.query({
      data_source_id: schema.dataSourceId,
      filter: { property: schema.titlePropertyName, title: { equals: name } },
      page_size: 1,
    }),
  );
  const page = res.results[0];
  if (!page || !isFullPage(page)) return null;
  return { id: page.id, url: page.url };
}

// Fonction pure, testable sans Notion : calcule le premier nom libre parmi
// baseName, "baseName (1)", "baseName (2)", ...
export function computeNextFreeSuffixedName(baseName: string, existingTitles: string[]): string {
  const used = new Set(existingTitles);
  if (!used.has(baseName)) return baseName;
  let n = 1;
  while (used.has(`${baseName} (${n})`)) n++;
  return `${baseName} (${n})`;
}

// Une seule requete paginee (starts_with) plutot qu'une requete par candidat.
export async function findAvailableSuffixedName(baseName: string): Promise<string> {
  const schema = await getDatabaseSchema();
  const titles: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await notionQueue.add(() =>
      getClient().dataSources.query({
        data_source_id: schema.dataSourceId,
        filter: { property: schema.titlePropertyName, title: { starts_with: baseName } },
        start_cursor: cursor,
        page_size: 100,
      }),
    );
    for (const p of res.results) {
      if (isFullPage(p)) {
        const t = extractTitleText(p, schema.titlePropertyName);
        if (t) titles.push(t);
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return computeNextFreeSuffixedName(baseName, titles);
}

export interface LeadForNotion {
  name: string;
  phone: string | null;
  website: string | null;
  category: string | null;
}

interface PropertyMapping {
  propertyName: string;
  expectedTypes: string[];
  build: (lead: LeadForNotion, type: string) => unknown | null; // null = pas de donnee -> on ignore
}

// Mapping defensif : les noms de proprietes ci-dessous suivent la capture
// d'ecran fournie par l'utilisateur (base "Prospects"). Chaque propriete
// n'est incluse dans le payload que si elle existe reellement dans le schema
// ET que son type correspond - sinon on l'ignore silencieusement plutot que
// de planter tout l'export pour un champ renomme/absent.
const CANDIDATE_MAPPINGS: PropertyMapping[] = [
  {
    propertyName: "Téléphone",
    expectedTypes: ["phone_number"],
    build: (lead) => (lead.phone ? { phone_number: lead.phone } : null),
  },
  {
    propertyName: "Secteur d'activité",
    expectedTypes: ["select"],
    build: (lead) => (lead.category ? { select: { name: lead.category } } : null),
  },
  {
    propertyName: "URL site",
    expectedTypes: ["url", "rich_text"],
    build: (lead, type) => {
      if (!lead.website) return null;
      return type === "url" ? { url: lead.website } : { rich_text: [{ text: { content: lead.website } }] };
    },
  },
  {
    propertyName: "Statut",
    expectedTypes: ["select"],
    build: () => ({ select: { name: "Nouveau" } }),
  },
  {
    propertyName: "Méthode",
    expectedTypes: ["select"],
    build: () => ({ select: { name: "Outbound" } }),
  },
];

// Fonction pure, testable sans Notion. Le mapping etant construit
// dynamiquement (proprietes decouvertes a l'execution), on type le resultat
// en Record<string, unknown> en interne puis on le confie tel quel au SDK
// (cast vers NotionPageProperties) : l'union stricte generee par le SDK pour
// "properties" n'est pas exprimable statiquement pour un mapping dynamique.
export function buildPropertiesPayload(
  lead: LeadForNotion,
  schema: NotionDbSchema,
  titleOverride?: string,
): NotionPageProperties {
  const properties: Record<string, unknown> = {
    [schema.titlePropertyName]: { title: [{ text: { content: titleOverride ?? lead.name } }] },
  };

  for (const mapping of CANDIDATE_MAPPINGS) {
    const propSchema = schema.properties[mapping.propertyName];
    if (!propSchema) continue;
    if (!mapping.expectedTypes.includes(propSchema.type)) continue;
    const value = mapping.build(lead, propSchema.type);
    if (value !== null) properties[mapping.propertyName] = value;
  }

  return properties as NotionPageProperties;
}

// --- Synthese (corps de page) ---

export interface LeadForSynthesis {
  opportunityScore: number | null;
  scoreBreakdownJson: string | null;
  gmbData: {
    rating: number;
    reviewCount: number;
    hasPhotos: boolean;
    photoCount: number | null;
    hasWebsite: boolean;
  } | null;
  websiteAudit: {
    mobilePerformance: number | null;
    mobileAccessibility: number | null;
    mobileSeo: number | null;
  } | null;
  seoAudit: {
    contentScore: number | null;
    openPageRank: number | null;
    topKeywordsJson: string | null;
  } | null;
  geoAudit: {
    geoScore: number | null;
    aiBotsBlockedCount: number | null;
    aiBotsTotalChecked: number | null;
    llmsTxtFound: boolean | null;
  } | null;
  companyData: {
    siren: string | null;
    legalName: string | null;
    legalForm: string | null;
    pappersFetched: boolean;
    dirigeantsJson: string | null;
  } | null;
}

const RICH_TEXT_MAX_LENGTH = 1900; // marge sous la limite Notion de 2000 caracteres

function truncate(text: string): string {
  return text.length > RICH_TEXT_MAX_LENGTH ? text.slice(0, RICH_TEXT_MAX_LENGTH) + "…" : text;
}

function heading2(text: string): BlockObjectRequest {
  return { type: "heading_2", heading_2: { rich_text: [{ text: { content: truncate(text) } }] } };
}

function paragraph(text: string): BlockObjectRequest {
  return { type: "paragraph", paragraph: { rich_text: [{ text: { content: truncate(text) } }] } };
}

function bullet(text: string): BlockObjectRequest {
  return {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [{ text: { content: truncate(text) } }] },
  };
}

interface KeywordEntry {
  term: string;
  count: number;
}

function parseTopKeywordsJson(json: string | null): KeywordEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface Dirigeant {
  nom?: string;
  prenom?: string;
  prenoms?: string;
  qualite?: string;
}

function summarizeDirigeants(json: string | null): string {
  if (!json) return "";
  try {
    const parsed = JSON.parse(json) as Dirigeant[];
    if (!Array.isArray(parsed) || parsed.length === 0) return "";
    return parsed
      .map((d) => `${d.nom ?? ""} ${d.prenom ?? d.prenoms ?? ""}${d.qualite ? ` (${d.qualite})` : ""}`.trim())
      .join(", ");
  } catch {
    return "";
  }
}

export function buildSynthesisBlocks(lead: LeadForSynthesis): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  blocks.push(heading2("Score d'opportunité"));
  if (lead.opportunityScore != null) {
    blocks.push(paragraph(`Score global : ${lead.opportunityScore}/100`));
    if (lead.scoreBreakdownJson) {
      try {
        const b = JSON.parse(lead.scoreBreakdownJson);
        blocks.push(
          bullet(
            `Écarts — GMB: ${Math.round(b.gmbGap)}, Site technique: ${Math.round(b.techGap)}, SEO contenu: ${Math.round(b.seoGap)}, Visibilité IA: ${Math.round(b.geoGap)}`,
          ),
        );
      } catch {
        // JSON malforme, on ignore le detail
      }
    }
  } else {
    blocks.push(paragraph("Aucune donnée disponible."));
  }

  blocks.push(heading2("Fiche Google My Business"));
  if (lead.gmbData) {
    blocks.push(
      bullet(`Note : ${lead.gmbData.rating.toFixed(1)}/5 (${lead.gmbData.reviewCount} avis)`),
      bullet(
        lead.gmbData.hasPhotos && lead.gmbData.photoCount
          ? `Photos : ${lead.gmbData.photoCount} visibles`
          : "Photos : aucune",
      ),
      bullet(`Site web renseigné sur la fiche : ${lead.gmbData.hasWebsite ? "oui" : "non"}`),
    );
  } else {
    blocks.push(paragraph("Aucune donnée disponible."));
  }

  blocks.push(heading2("Site technique (PageSpeed Insights)"));
  if (lead.websiteAudit) {
    blocks.push(
      bullet(
        `Performance : ${lead.websiteAudit.mobilePerformance ?? "—"}/100, Accessibilité : ${lead.websiteAudit.mobileAccessibility ?? "—"}/100, SEO technique : ${lead.websiteAudit.mobileSeo ?? "—"}/100`,
      ),
    );
  } else {
    blocks.push(paragraph("Aucune donnée disponible (pas de site web)."));
  }

  blocks.push(heading2("SEO contenu"));
  if (lead.seoAudit) {
    const keywords = parseTopKeywordsJson(lead.seoAudit.topKeywordsJson);
    blocks.push(bullet(`Score contenu : ${lead.seoAudit.contentScore ?? "—"}/100`));
    if (lead.seoAudit.openPageRank != null) {
      blocks.push(bullet(`OpenPageRank : ${lead.seoAudit.openPageRank.toFixed(1)}/10`));
    }
    if (keywords.length > 0) {
      blocks.push(bullet(`Mots-clés principaux : ${keywords.map((k) => k.term).join(", ")}`));
    }
  } else {
    blocks.push(paragraph("Aucune donnée disponible (pas de site web)."));
  }

  blocks.push(heading2("Visibilité IA (GEO)"));
  if (lead.geoAudit) {
    blocks.push(
      bullet(`Score GEO : ${lead.geoAudit.geoScore ?? "—"}/100`),
      bullet(
        `Robots IA bloqués : ${lead.geoAudit.aiBotsBlockedCount ?? 0}/${lead.geoAudit.aiBotsTotalChecked ?? 0}`,
      ),
      bullet(`llms.txt : ${lead.geoAudit.llmsTxtFound ? "présent" : "absent"}`),
    );
  } else {
    blocks.push(paragraph("Aucune donnée disponible (pas de site web)."));
  }

  blocks.push(heading2("Données entreprise"));
  if (lead.companyData?.siren) {
    blocks.push(
      bullet(`${lead.companyData.legalName ?? "—"} (SIREN ${lead.companyData.siren})`),
      bullet(`Forme juridique : ${lead.companyData.legalForm ?? "—"}`),
    );
    if (lead.companyData.pappersFetched) {
      const dirigeants = summarizeDirigeants(lead.companyData.dirigeantsJson);
      blocks.push(bullet(`Dirigeant(s) : ${dirigeants || "non renseigné"}`));
    }
  } else {
    blocks.push(paragraph("Aucune correspondance trouvée sur l'annuaire des entreprises."));
  }

  return blocks;
}

type LeadForExport = LeadForNotion & LeadForSynthesis;

export async function createProspectPage(
  lead: LeadForExport,
  titleOverride?: string,
): Promise<{ id: string; url: string }> {
  const schema = await getDatabaseSchema();
  const properties = buildPropertiesPayload(lead, schema, titleOverride);
  const children = buildSynthesisBlocks(lead);

  const page = await notionQueue.add(() =>
    getClient().pages.create({
      parent: { data_source_id: schema.dataSourceId },
      properties,
      children,
    }),
  );
  if (!isFullPage(page)) throw new Error("Réponse Notion incomplète lors de la création de la page.");
  return { id: page.id, url: page.url };
}

export async function overwriteProspectPage(
  pageId: string,
  lead: LeadForExport,
): Promise<{ id: string; url: string }> {
  const schema = await getDatabaseSchema();
  const properties = buildPropertiesPayload(lead, schema);

  await notionQueue.add(() => getClient().pages.update({ page_id: pageId, properties }));

  // Pas d'endpoint Notion pour "remplacer" le contenu d'une page : on liste
  // (paginé), supprime chaque bloc existant, puis ajoute la nouvelle synthese.
  const existingBlockIds: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await notionQueue.add(() =>
      getClient().blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 }),
    );
    existingBlockIds.push(...res.results.map((b) => b.id));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  for (const blockId of existingBlockIds) {
    await notionQueue.add(() => getClient().blocks.delete({ block_id: blockId }));
  }

  await notionQueue.add(() =>
    getClient().blocks.children.append({ block_id: pageId, children: buildSynthesisBlocks(lead) }),
  );

  const page = await notionQueue.add(() => getClient().pages.retrieve({ page_id: pageId }));
  if (!isFullPage(page)) throw new Error("Réponse Notion incomplète lors de la mise à jour de la page.");
  return { id: page.id, url: page.url };
}
