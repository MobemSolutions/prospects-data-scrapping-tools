// Geocodage gratuit et illimite via l'API officielle "Base Adresse Nationale"
// (api-adresse.data.gouv.fr, gouv.fr, sans cle). Sert a donner de vraies
// coordonnees a gosom pour ses recherches Google Maps : sans ca, le client
// gosom envoyait toujours lat=0/lon=0 (l'ocean Atlantique au large de
// l'Afrique) comme centre de recherche, ce qui biaise/filtre les resultats
// Google Maps par rapport a une recherche manuelle correctement geolocalisee.
//
// Constat verifie empiriquement le 2026-07-02 : geocoder la requete complete
// ("restaurant Chatou") donne un score tres bas (~0.3-0.5, mauvais lieu, le
// mot-clé metier pollue la recherche d'adresse), alors qu'isoler la partie
// lieu en fin de requete ("Chatou", "paris 15") donne un score eleve
// (~0.85-0.95, bon lieu). D'ou la strategie : essayer la requete complete,
// puis retirer progressivement les mots de tete jusqu'a trouver un score
// correct (nos requetes suivent le format "type de commerce + lieu").

const GEOCODE_URL = "https://api-adresse.data.gouv.fr/search/";
const MIN_ACCEPTABLE_SCORE = 0.6;

export interface GeocodeResult {
  lat: number;
  lon: number;
  label: string;
  score: number;
}

async function geocodeOnce(text: string): Promise<GeocodeResult | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(`${GEOCODE_URL}?q=${encodeURIComponent(trimmed)}&limit=1`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature) return null;

    const [lon, lat] = feature.geometry.coordinates;
    return {
      lat,
      lon,
      label: feature.properties.label,
      score: feature.properties.score ?? 0,
    };
  } catch {
    return null;
  }
}

// Genere les candidats a tester, du plus specifique (requete complete) au
// plus court (dernier mot seul) : requete entiere, puis on retire les mots
// de tete un a un.
// Fonction pure (hors I/O), testable independamment.
export function buildCandidates(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const candidates: string[] = [];
  for (let i = 0; i < words.length; i++) {
    candidates.push(words.slice(i).join(" "));
  }
  return candidates;
}

// Essaie de localiser la partie "lieu" d'une requete de type
// "plombier Paris 15" en testant plusieurs sous-chaines, retient le premier
// resultat dont le score depasse le seuil. Retourne null si rien de fiable
// n'est trouve (le tool retombe alors sur son comportement precedent).
export async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  for (const candidate of buildCandidates(query)) {
    const result = await geocodeOnce(candidate);
    if (result && result.score >= MIN_ACCEPTABLE_SCORE) return result;
  }
  return null;
}
