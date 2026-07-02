import { ScoreGauge } from "@/components/ScoreGauge";
import type { MarketAnalysis } from "@/lib/pipeline/marketAnalysis";

export function MarketAnalysisPanel({ analysis }: { analysis: MarketAnalysis }) {
  if (analysis.sitesAnalyzed === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div>
          <h2 className="font-semibold">Benchmark technique du marché</h2>
          <p className="text-sm text-neutral-500">
            Moyenne des {analysis.sitesAnalyzed} sites analysés dans cette campagne.
          </p>
        </div>
        <div className="flex flex-wrap justify-around gap-4">
          <ScoreGauge label="Performance (PSI)" value={analysis.technicalBenchmark.avgPerformance} />
          <ScoreGauge label="Accessibilité (PSI)" value={analysis.technicalBenchmark.avgAccessibility} />
          <ScoreGauge label="SEO technique (PSI)" value={analysis.technicalBenchmark.avgSeoTechnique} />
          <ScoreGauge label="Score contenu SEO" value={analysis.technicalBenchmark.avgContentScore} />
          <ScoreGauge label="Score GEO" value={analysis.technicalBenchmark.avgGeoScore} />
        </div>
        {analysis.technicalBenchmark.avgOpenPageRank != null && (
          <div className="flex flex-col items-center gap-1 border-t border-neutral-100 pt-3">
            <p className="text-sm text-neutral-500">
              Autorité par les liens entrants (OpenPageRank), échelle 0 à 10 — mesure les backlinks
              reçus, pas la qualité du contenu.{" "}
              <span className="font-medium text-neutral-900">
                Moyenne du marché : {analysis.technicalBenchmark.avgOpenPageRank.toFixed(1)}/10
              </span>
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div>
          <h2 className="font-semibold">Paysage des mots-clés du marché</h2>
          <p className="text-sm text-neutral-500">
            Mots-clés les plus présents dans le contenu des sites concurrents de cette recherche —
            reflète le champ lexical du marché observé, pas un volume de recherche Google (aucune
            donnée gratuite fiable n&apos;existe pour ça). Plus un mot-clé est utilisé par de
            nombreux sites, plus il fait partie du vocabulaire commun du secteur ; il est donc peu
            différenciant pris isolément.
          </p>
        </div>
        {analysis.sharedKeywords.length === 0 ? (
          <p className="text-sm text-neutral-500">Pas assez de contenu analysé pour dégager un paysage de mots-clés.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2 font-medium text-neutral-600">Mot-clé</th>
                  <th className="px-3 py-2 font-medium text-neutral-600">Sites concernés</th>
                  <th className="px-3 py-2 font-medium text-neutral-600">Occurrences totales</th>
                  <th className="px-3 py-2 font-medium text-neutral-600">Utilisé par</th>
                </tr>
              </thead>
              <tbody>
                {analysis.sharedKeywords.map((kw) => (
                  <tr key={kw.term} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2 font-medium">{kw.term}</td>
                    <td className="px-3 py-2">
                      {kw.siteCount}/{analysis.sitesAnalyzed}
                    </td>
                    <td className="px-3 py-2">{kw.totalOccurrences}</td>
                    <td className="px-3 py-2 text-neutral-500">{kw.sites.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {analysis.uniqueKeywordsBySite.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div>
            <h2 className="font-semibold">Mots-clés différenciants par site</h2>
            <p className="text-sm text-neutral-500">
              Mots-clés présents dans le top contenu d&apos;un seul site parmi les concurrents
              analysés — des pistes de différenciation ou de niche déjà occupées, à évaluer au cas
              par cas.
            </p>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {analysis.uniqueKeywordsBySite.map((s) => (
              <li key={s.leadId} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.name} :</span>
                {s.keywords.map((k) => (
                  <span key={k} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    {k}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div>
          <h2 className="font-semibold">Adoption GEO (visibilité IA) du marché</h2>
          <p className="text-sm text-neutral-500">
            Sur {analysis.geoMarket.sitesWithGeoAudit} site
            {analysis.geoMarket.sitesWithGeoAudit > 1 ? "s" : ""} audité
            {analysis.geoMarket.sitesWithGeoAudit > 1 ? "s" : ""} pour la visibilité IA.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-md bg-neutral-50 p-3">
            <p className="text-2xl font-semibold">{analysis.geoMarket.llmsTxtAdoptionPct}%</p>
            <p className="text-neutral-500">ont un fichier llms.txt</p>
          </div>
          <div className="rounded-md bg-neutral-50 p-3">
            <p className="text-2xl font-semibold">{analysis.geoMarket.structuredDataAdoptionPct}%</p>
            <p className="text-neutral-500">ont des données structurées pertinentes pour l&apos;IA</p>
          </div>
        </div>
        {analysis.geoMarket.botBlockRates.length > 0 && (
          <div>
            {analysis.geoMarket.botBlockRates.every((b) => b.blockedPct === 0) ? (
              <p className="text-sm text-neutral-500">
                Aucun site de cette campagne ne bloque les robots IA — c&apos;est la norme (bloquer
                un robot IA demande une action technique volontaire que la plupart des sites
                n&apos;ont jamais faite). Ce point ne différencie donc pas les concurrents ici.
              </p>
            ) : (
              <>
                <p className="mb-1 text-sm text-neutral-500">
                  La plupart des sites autorisent tous les robots IA par défaut — les exceptions
                  ci-dessous sont donc le signal le plus utile de cette section :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.geoMarket.botBlockRates
                    .filter((b) => b.blockedPct > 0)
                    .map((b) => (
                      <span
                        key={b.bot}
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                        title={`${b.blockedCount}/${b.totalChecked} sites bloquent ce robot`}
                      >
                        {b.bot} : {b.blockedPct}% bloqué
                      </span>
                    ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
