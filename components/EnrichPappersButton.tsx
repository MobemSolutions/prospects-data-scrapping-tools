"use client";

import { useState, useTransition } from "react";
import { enrichWithPappers } from "@/app/actions/leads";

export function EnrichPappersButton({
  campaignId,
  leadId,
  quotaRemaining,
}: {
  campaignId: string;
  leadId: string;
  quotaRemaining: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = isPending || quotaRemaining <= 0;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await enrichWithPappers(campaignId, leadId);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          });
        }}
        className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Enrichissement…" : `Enrichir via Pappers (${quotaRemaining} restants ce mois)`}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
