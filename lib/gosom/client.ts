import Papa from "papaparse";
import { geocodeLocation } from "@/lib/geocoding/client";

// Contrat verifie contre le code source de gosom/google-maps-scraper
// (web/web.go, web/job.go, gmaps/entry.go) le 2026-07-01 :
// - POST /api/v1/jobs cree un job, body = { Name, ...JobData }
// - GET  /api/v1/jobs/{id} renvoie { ID, Name, Date, Status, Data }
//   avec Status in "pending" | "working" | "ok" | "failed"
// - GET  /api/v1/jobs/{id}/download renvoie le CSV des resultats
//   (uniquement disponible une fois Status === "ok")
// Pas de cle API en mode self-hosted (-web).

const GOSOM_API_URL = process.env.GOSOM_API_URL ?? "http://localhost:8080";

export type GosomJobStatus = "pending" | "working" | "ok" | "failed";

interface GosomJob {
  ID: string;
  Name: string;
  Date: string;
  Status: GosomJobStatus;
}

interface StartScrapeOptions {
  name: string;
  query: string;
  lang?: string;
  depth?: number;
  radiusMeters?: number;
  maxTimeSeconds?: number;
  // Coordonnees reelles du lieu recherche (cf. lib/geocoding/client.ts).
  // gosom integre systematiquement lat/lon dans le centre de la carte envoye
  // a Google Maps ; sans coordonnees reelles il retombe sur "0,0" (l'ocean
  // Atlantique), ce qui peut biaiser/filtrer les resultats par rapport a une
  // recherche manuelle correctement geolocalisee.
  lat?: number;
  lon?: number;
}

export async function startScrapeJob(opts: StartScrapeOptions): Promise<{ jobId: string }> {
  const body = {
    Name: opts.name,
    keywords: [opts.query],
    lang: opts.lang ?? "fr",
    zoom: 15,
    lat: String(opts.lat ?? 0),
    lon: String(opts.lon ?? 0),
    fast_mode: false,
    radius: opts.radiusMeters ?? 10000,
    depth: opts.depth ?? 20,
    email: false,
    extra_reviews: false,
    // l'API interne multiplie cette valeur par time.Second -> exprimee en secondes.
    // gosom exige un minimum de 3 minutes. 600s (10 min) de marge : une requete
    // dense (ex. "restaurant" en zone urbaine) peut faire remonter des dizaines
    // de resultats a scraper individuellement avant que "depth" ne les limite ;
    // un budget trop juste (teste a 240s) a deja produit un job "ok" avec un
    // CSV vide, coupe avant l'ecriture des resultats.
    max_time: opts.maxTimeSeconds ?? 600,
    proxies: [],
  };

  const res = await fetch(`${GOSOM_API_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`gosom: echec de creation du job (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return { jobId: data.id };
}

export async function getJobStatus(jobId: string): Promise<GosomJobStatus> {
  const res = await fetch(`${GOSOM_API_URL}/api/v1/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error(`gosom: echec de lecture du job ${jobId} (${res.status})`);
  }
  const job = (await res.json()) as GosomJob;
  return job.Status;
}

export async function waitForJobCompletion(
  jobId: string,
  { pollIntervalMs = 3000, timeoutMs = 15 * 60 * 1000 }: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const startedAt = Date.now();

  for (;;) {
    const status = await getJobStatus(jobId);

    if (status === "ok") return;
    if (status === "failed") throw new Error(`gosom: le job ${jobId} a echoue`);

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`gosom: timeout en attendant la fin du job ${jobId}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

// Sous-ensemble typé des 36 colonnes CSV exposees par gmaps.Entry.CsvHeaders().
// Les colonnes contenant des structures (open_hours, images, ...) sont
// serialisees en JSON par gosom et re-parsees ici.
export interface GosomResult {
  placeId: string;
  name: string;
  category: string;
  address: string;
  website: string | null;
  phone: string | null;
  reviewCount: number;
  rating: number | null;
  latitude: number | null;
  longitude: number | null;
  thumbnailUrl: string | null;
  imageCount: number;
  openingHoursJson: string | null;
  raw: Record<string, string>;
}

function toNumberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// gosom inclut systematiquement une vignette "Street View et 360°" (hebergee sur
// streetviewpixels-pa.googleapis.com) dans la colonne "images", au meme titre que
// les vraies photos deposees sur la fiche. Ce n'est pas une photo de l'etablissement :
// on l'exclut du comptage pour ne pas surestimer photoCount.
function countRealPhotos(value: string | undefined): number {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((entry) => {
      const image = typeof entry?.image === "string" ? entry.image : "";
      return !image.includes("streetviewpixels-pa.googleapis.com");
    }).length;
  } catch {
    return 0;
  }
}

export function parseResultsCsv(csvText: string): GosomResult[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .filter((row) => row.title)
    .map((row) => {
      const imagesLength = countRealPhotos(row.images);
      return {
        placeId: row.place_id || row.data_id || row.cid || row.input_id,
        name: row.title,
        category: row.category,
        address: row.address,
        website: row.website || null,
        phone: row.phone || null,
        reviewCount: toNumberOrNull(row.review_count) ?? 0,
        rating: toNumberOrNull(row.review_rating),
        latitude: toNumberOrNull(row.latitude),
        longitude: toNumberOrNull(row.longitude),
        thumbnailUrl: row.thumbnail || null,
        imageCount: imagesLength,
        openingHoursJson: row.open_hours || null,
        raw: row,
      } satisfies GosomResult;
    });
}

export async function fetchJobResults(jobId: string): Promise<GosomResult[]> {
  const res = await fetch(`${GOSOM_API_URL}/api/v1/jobs/${jobId}/download`);
  if (!res.ok) {
    throw new Error(`gosom: echec du telechargement des resultats du job ${jobId} (${res.status})`);
  }
  const csvText = await res.text();
  return parseResultsCsv(csvText);
}

export async function runQuery(query: string, name: string): Promise<GosomResult[]> {
  // Geocode la partie "lieu" de la requete (gratuit, api-adresse.data.gouv.fr)
  // pour donner a gosom un vrai centre de recherche au lieu de "0,0" par
  // defaut. Echec silencieux : on retombe sur le comportement precedent si
  // rien de fiable n'est trouve (voir lib/geocoding/client.ts).
  const geocoded = await geocodeLocation(query).catch(() => null);

  const { jobId } = await startScrapeJob({
    name,
    query,
    lat: geocoded?.lat,
    lon: geocoded?.lon,
  });
  await waitForJobCompletion(jobId);
  return fetchJobResults(jobId);
}
