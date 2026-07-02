import robotsParser, { type Robot } from "robots-parser";
import { crawlQueue } from "@/lib/pipeline/queue";

const USER_AGENT = "ProspectionBot/1.0 (+contact: arnaud.clv44@gmail.com)";
const FETCH_TIMEOUT_MS = 8000;

async function politeGet(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function politeHead(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface SiteArtifacts {
  baseUrl: string;
  html: string | null;
  robotsTxtBody: string | null;
  robots: Robot | null;
  sitemapReachable: boolean;
  llmsTxt: string | null;
  llmsFullTxt: string | null;
  disallowedByRobots: boolean;
}

// Un seul passage HTTP par site et par campagne (homepage, robots.txt,
// sitemap.xml, llms.txt, llms-full.txt = 5 requetes max), partage entre
// l'audit SEO on-page et l'audit GEO pour ne pas solliciter deux fois le
// meme site. Respecte robots.txt avant de recuperer la page d'accueil.
export async function fetchSiteArtifacts(baseUrl: string): Promise<SiteArtifacts> {
  return crawlQueue.add(async () => {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const robotsTxtBody = await politeGet(robotsUrl);
    const robots = robotsTxtBody ? robotsParser(robotsUrl, robotsTxtBody) : null;

    const disallowedByRobots = robots ? robots.isAllowed(baseUrl, USER_AGENT) === false : false;

    const [html, sitemapReachable, llmsTxt, llmsFullTxt] = await Promise.all([
      disallowedByRobots ? Promise.resolve(null) : politeGet(baseUrl),
      politeHead(new URL("/sitemap.xml", baseUrl).toString()),
      politeGet(new URL("/llms.txt", baseUrl).toString()),
      politeGet(new URL("/llms-full.txt", baseUrl).toString()),
    ]);

    return {
      baseUrl,
      html,
      robotsTxtBody,
      robots,
      sitemapReachable,
      llmsTxt,
      llmsFullTxt,
      disallowedByRobots,
    } satisfies SiteArtifacts;
  }) as Promise<SiteArtifacts>;
}
