"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteCampaigns } from "@/app/actions/campaigns";

type Campaign = {
  id: string;
  query: string;
  status: string;
  totalLeads: number;
  processedLeads: number;
};

export function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const allSelected = selected.size > 0 && selected.size === campaigns.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === campaigns.length ? new Set() : new Set(campaigns.map((c) => c.id)),
    );
  }

  function handleDelete() {
    const count = selected.size;
    if (count === 0) return;
    const label =
      count === 1 ? "cette campagne" : `ces ${count} campagnes`;
    if (!window.confirm(`Supprimer définitivement ${label} et tous leurs leads ?`)) {
      return;
    }

    const ids = Array.from(selected);
    startTransition(async () => {
      await deleteCampaigns(ids);
      setSelected(new Set());
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-2">
          <span className="text-sm text-neutral-600">
            {selected.size} campagne{selected.size > 1 ? "s" : ""} sélectionnée
            {selected.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      )}

      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        <li className="flex items-center gap-3 px-4 py-2 text-sm text-neutral-500">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-neutral-300"
            aria-label="Tout sélectionner"
          />
          Tout sélectionner
        </li>
        {campaigns.map((campaign) => (
          <li key={campaign.id} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
            <input
              type="checkbox"
              checked={selected.has(campaign.id)}
              onChange={() => toggle(campaign.id)}
              className="h-4 w-4 rounded border-neutral-300"
              aria-label={`Sélectionner ${campaign.query}`}
            />
            <Link
              href={`/campaigns/${campaign.id}`}
              className="flex flex-1 items-center justify-between"
            >
              <span className="font-medium">{campaign.query}</span>
              <span className="flex items-center gap-3 text-sm text-neutral-500">
                <span>
                  {campaign.processedLeads}/{campaign.totalLeads} leads
                </span>
                <StatusBadge status={campaign.status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-neutral-100 text-neutral-600",
    SCRAPING: "bg-amber-100 text-amber-700",
    ANALYZING: "bg-amber-100 text-amber-700",
    DONE: "bg-emerald-100 text-emerald-700",
    ERROR: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-600"}`}
    >
      {status}
    </span>
  );
}
