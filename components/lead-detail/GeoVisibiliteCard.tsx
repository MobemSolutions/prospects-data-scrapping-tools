import type { GeoAudit } from "@/app/generated/prisma/client";

interface BotResult {
  bot: string;
  allowed: boolean;
  specified: boolean;
}

export function GeoVisibiliteCard({ audit }: { audit: GeoAudit | null }) {
  if (!audit) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
        <h2 className="font-semibold text-neutral-700">Visibilité IA (GEO)</h2>
        <p>Pas de site web pour ce prospect.</p>
      </div>
    );
  }

  if (audit.errorMessage) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="font-semibold">Visibilité IA (GEO)</h2>
        <p className="text-red-600">Audit indisponible : {audit.errorMessage}</p>
      </div>
    );
  }

  const bots: BotResult[] = audit.aiBotsJson ? JSON.parse(audit.aiBotsJson) : [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Visibilité IA (GEO)</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          Score {audit.geoScore ?? "—"}/100
        </span>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-neutral-500">
          Accès des robots IA ({audit.aiBotsAllowedCount ?? 0}/{audit.aiBotsTotalChecked ?? 0} autorisés)
        </p>
        {audit.aiBotsAllowedCount === audit.aiBotsTotalChecked ? (
          <p className="mb-1.5 text-xs text-neutral-500">
            Tous autorisés — c&apos;est le cas de la quasi-totalité des sites (bloquer un robot IA
            demande une action technique volontaire, rare en pratique). Ce point seul ne
            différencie donc pas beaucoup ce prospect des autres.
          </p>
        ) : (
          <p className="mb-1.5 text-xs text-amber-700">
            Au moins un robot IA est bloqué ici — c&apos;est rare (la plupart des sites autorisent
            tout par défaut), donc un signal notable en soi.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {bots.map((b) => (
            <span
              key={b.bot}
              className={`rounded-full px-2 py-0.5 text-xs ${
                b.allowed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
              title={b.specified ? "Mentionné explicitement dans robots.txt" : "Non mentionné (autorisé par défaut)"}
            >
              {b.bot}
            </span>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-500">llms.txt</dt>
        <dd>
          {audit.llmsTxtFound ? (
            <span className="text-emerald-600">Présent{audit.llmsTxtValid ? "" : " (structure incomplète)"}</span>
          ) : (
            <span className="text-neutral-500">Non détecté — norme émergente, opportunité de différenciation</span>
          )}
        </dd>
        <dt className="text-neutral-500">llms-full.txt</dt>
        <dd>{audit.llmsFullTxtFound ? "Présent" : "Absent"}</dd>
        <dt className="text-neutral-500">Données structurées IA</dt>
        <dd>
          {audit.hasOrganizationOrLocalBusinessSchema ? "Organization/LocalBusiness " : ""}
          {audit.hasFaqOrArticleSchema ? "FAQ/Article " : ""}
          {audit.hasSameAsLinks ? `sameAs (${audit.sameAsCount ?? 0})` : ""}
          {!audit.hasOrganizationOrLocalBusinessSchema && !audit.hasFaqOrArticleSchema && !audit.hasSameAsLinks && "Aucune"}
        </dd>
        <dt className="text-neutral-500">Contenu accessible sans JS</dt>
        <dd>
          {audit.likelyJsShell ? (
            <span className="text-red-600">Probablement invisible pour les robots IA (rendu JS côté client)</span>
          ) : (
            <span className="text-emerald-600">Contenu détecté dans le HTML brut</span>
          )}
        </dd>
      </dl>
    </div>
  );
}
