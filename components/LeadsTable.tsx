"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

export interface LeadRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  status: string;
  errorMessage: string | null;
  opportunityScore: number | null;
  priorityFlag: boolean;
  gmbData: { hasPhotos: boolean; photoCount: number | null } | null;
  companyData: { matchStatus: string } | null;
}

const columnHelper = createColumnHelper<LeadRow>();

export function LeadsTable({
  campaignId,
  leads,
  selectedIds,
  onToggleLead,
  onToggleAll,
  onTogglePriority,
}: {
  campaignId: string;
  leads: LeadRow[];
  selectedIds: Set<string>;
  onToggleLead: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onTogglePriority: (id: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: () => {
          const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
          const someSelected = selectedIds.size > 0 && !allSelected;
          return (
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => onToggleAll(e.target.checked)}
              aria-label="Tout sélectionner"
            />
          );
        },
        cell: (info) => (
          <input
            type="checkbox"
            checked={selectedIds.has(info.row.original.id)}
            onChange={() => onToggleLead(info.row.original.id)}
          />
        ),
      }),
      columnHelper.accessor("name", {
        header: "Nom",
        cell: (info) => (
          <span className="inline-flex items-center gap-1.5">
            <PriorityStarButton
              active={info.row.original.priorityFlag}
              onClick={() => onTogglePriority(info.row.original.id)}
            />
            <Link
              href={`/campaigns/${campaignId}/leads/${info.row.original.id}`}
              className="font-medium hover:underline"
            >
              {info.getValue()}
            </Link>
            <CompanyRegistryBadge matchStatus={info.row.original.companyData?.matchStatus ?? null} />
          </span>
        ),
      }),
      columnHelper.accessor("address", {
        header: "Adresse",
        cell: (info) => <span className="text-neutral-500">{info.getValue() ?? "—"}</span>,
      }),
      columnHelper.accessor("website", {
        header: "Site web",
        cell: (info) =>
          info.getValue() ? (
            <span className="text-emerald-600">Oui</span>
          ) : (
            <span className="font-medium text-red-600">Non</span>
          ),
      }),
      columnHelper.accessor((row) => row.gmbData?.photoCount ?? (row.gmbData?.hasPhotos ? 0 : null), {
        id: "photoCount",
        header: "Photos GMB",
        cell: (info) => {
          const value = info.getValue();
          if (value === null) return <span className="text-neutral-400">—</span>;
          return value > 0 ? (
            <span className="text-emerald-600">{value}</span>
          ) : (
            <span className="text-red-600">0</span>
          );
        },
      }),
      columnHelper.accessor("rating", {
        header: "Note",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("reviewCount", {
        header: "Avis",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("opportunityScore", {
        header: "Score opportunité",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("status", {
        header: "Statut",
        cell: (info) => <StatusBadge status={info.getValue()} error={info.row.original.errorMessage} />,
      }),
    ],
    [campaignId, leads, selectedIds, onToggleLead, onToggleAll, onTogglePriority],
  );

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="cursor-pointer select-none px-3 py-2 font-medium text-neutral-600"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-neutral-100 last:border-0 ${
                row.original.priorityFlag ? "bg-yellow-50" : ""
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Etoile cliquable pour marquer/demarquer un prospect comme prioritaire,
// directement depuis le tableau (meme action que sur la fiche prospect).
// Exportee : reutilisee par PriorityLeadsTable (vue globale des prioritaires).
export function PriorityStarButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={active ? "Retirer la priorité" : "Marquer comme prioritaire"}
      className={`shrink-0 text-lg leading-none ${active ? "text-amber-500" : "text-neutral-400 hover:text-amber-500"}`}
    >
      ★
    </button>
  );
}

// Petite indication visuelle : l'entreprise a une correspondance sur
// l'annuaire des entreprises (gouv.fr) — vert si fiable, ambre si a
// verifier, rien si aucune correspondance (garde le tableau lisible).
export function CompanyRegistryBadge({ matchStatus }: { matchStatus: string | null }) {
  if (matchStatus === "MATCHED") {
    return (
      <span
        title="Référencé sur l'annuaire des entreprises (gouv.fr)"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-700"
      >
        🏢
      </span>
    );
  }
  if (matchStatus === "LOW_CONFIDENCE") {
    return (
      <span
        title="Correspondance possible sur l'annuaire des entreprises (à vérifier)"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[10px] text-amber-700"
      >
        🏢
      </span>
    );
  }
  return null;
}

export function StatusBadge({ status, error }: { status: string; error: string | null }) {
  const styles: Record<string, string> = {
    PENDING: "bg-neutral-100 text-neutral-600",
    SCRAPED: "bg-neutral-100 text-neutral-600",
    ANALYZING: "bg-amber-100 text-amber-700",
    DONE: "bg-emerald-100 text-emerald-700",
    ERROR: "bg-red-100 text-red-700",
  };

  return (
    <span
      title={error ?? undefined}
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-600"}`}
    >
      {status}
    </span>
  );
}
