import type { SeoOnPageAudit } from "@/app/generated/prisma/client";

export function SeoContenuCard({ audit }: { audit: SeoOnPageAudit | null }) {
  if (!audit) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
        <h2 className="font-semibold text-neutral-700">SEO contenu</h2>
        <p>Pas de site web pour ce prospect.</p>
      </div>
    );
  }

  if (audit.errorMessage) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="font-semibold">SEO contenu</h2>
        <p className="text-red-600">Audit indisponible : {audit.errorMessage}</p>
      </div>
    );
  }

  const keywords: { term: string; count: number }[] = audit.topKeywordsJson
    ? JSON.parse(audit.topKeywordsJson)
    : [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">SEO contenu (audit on-page)</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          Score {audit.contentScore ?? "—"}/100
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-500">Balise title</dt>
        <dd>{audit.titleTag ? `${audit.titleTag} (${audit.titleLength} car.)` : "Absente"}</dd>
        <dt className="text-neutral-500">Meta description</dt>
        <dd>{audit.metaDescription ? `${audit.metaDescriptionLength} caractères` : "Absente"}</dd>
        <dt className="text-neutral-500">Structure</dt>
        <dd>{audit.h1Count ?? 0} H1, {audit.h2Count ?? 0} H2</dd>
        <dt className="text-neutral-500">Volume de contenu</dt>
        <dd>{audit.wordCount ?? 0} mots</dd>
        <dt className="text-neutral-500">Images avec alt</dt>
        <dd>{audit.altCoveragePct ?? 0}% ({audit.imagesWithAlt ?? 0}/{audit.imageCount ?? 0})</dd>
        <dt className="text-neutral-500">Données structurées</dt>
        <dd>{audit.hasStructuredData ? "Oui" : "Non"}</dd>
        <dt className="text-neutral-500">Autorité (OpenPageRank)</dt>
        <dd>{audit.openPageRank != null ? audit.openPageRank.toFixed(1) + "/10" : "—"}</dd>
      </dl>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.slice(0, 8).map((k) => (
            <span key={k.term} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {k.term} ({k.count})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
