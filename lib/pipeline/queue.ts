import PQueue from "p-queue";

// Une seule recherche Maps a la fois : gosom traite deja les requetes en
// interne, pas besoin d'en lancer plusieurs en parallele pour de petites campagnes.
export const scrapeQueue = new PQueue({ concurrency: 1 });

// Analyse par lead (site web, SEO, GEO, entreprise) : concurrence limitee
// pour rester raisonnable vis-a-vis des sites cibles et des API externes.
export const analysisQueue = new PQueue({ concurrency: 3 });

// File dediee aux requetes HTTP vers les sites des prospects (homepage,
// robots.txt, sitemap.xml, llms.txt...). Partagee par toutes les campagnes
// pour garder une charge raisonnable sur un site cible donne, independamment
// du nombre de leads traites en parallele par analysisQueue.
export const crawlQueue = new PQueue({ concurrency: 2 });
