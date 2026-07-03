export function ProgressBar({
  processed,
  total,
  status,
  errorMessage,
}: {
  processed: number;
  total: number;
  status: string;
  errorMessage?: string | null;
}) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {status === "SCRAPING" && "Recherche des établissements en cours…"}
          {status === "ANALYZING" && `Analyse des prospects : ${processed}/${total}`}
          {status === "PENDING" && "En attente de démarrage…"}
          {status === "DONE" && "Campagne terminée"}
          {status === "ERROR" && "Erreur pendant la campagne"}
        </span>
        {total > 0 && <span className="text-neutral-500">{pct}%</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-neutral-900 transition-all"
          style={{ width: `${status === "SCRAPING" ? 10 : pct}%` }}
        />
      </div>
      {status === "ERROR" && errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
