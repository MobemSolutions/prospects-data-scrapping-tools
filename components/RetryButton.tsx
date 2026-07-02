"use client";

import { useState, useTransition } from "react";
import { retryLeadAnalysis } from "@/app/actions/leads";

export function RetryButton({ campaignId, leadId }: { campaignId: string; leadId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await retryLeadAnalysis(campaignId, leadId);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          });
        }}
        className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        {isPending ? "Nouvelle tentative…" : "↻ Réessayer l'analyse"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
