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
import { PriorityStarButton, CompanyRegistryBadge, StatusBadge } from "@/components/LeadsTable";
import { togglePriority } from "@/app/actions/leads";

export interface PriorityLeadRow {
  id: string;
  campaignId: string;
  campaignQuery: string;
  name: string;
  address: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  status: string;
  errorMessage: string | null;
  opportunityScore: number | null;
  companyData: { matchStatus: string } | null;
}

const columnHelper = createColumnHelper<PriorityLeadRow>();

export function PriorityLeadsTable({ initialLeads }: { initialLeads: PriorityLeadRow[] }) {
  // Cette vue n'a pas de polling (contrairement au tableau de campagne) :
  // un prospect demarque ici est retire localement de la liste des le clic,
  // pas besoin d'attendre un rechargement.
  const [leads, setLeads] = useState(initialLeads);
  const [sorting, setSorting] = useState<SortingState>([{ id: "campaignQuery", desc: false }]);

  function handleUnprioritize(campaignId: string, leadId: string) {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    togglePriority(campaignId, leadId).catch((error) => {
      console.error("Echec du changement de priorite", error);
    });
  }

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "star",
        header: "",
        cell: (info) => (
          <PriorityStarButton
            active
            onClick={() => handleUnprioritize(info.row.original.campaignId, info.row.original.id)}
          />
        ),
      }),
      columnHelper.accessor("name", {
        header: "Nom",
        cell: (info) => (
          <span className="inline-flex items-center gap-1.5">
            <Link
              href={`/campaigns/${info.row.original.campaignId}/leads/${info.row.original.id}`}
              className="font-medium hover:underline"
            >
              {info.getValue()}
            </Link>
            <CompanyRegistryBadge matchStatus={info.row.original.companyData?.matchStatus ?? null} />
          </span>
        ),
      }),
      // "Mot-clé" = la requête Google Maps de la campagne d'origine — permet
      // de trier/regrouper les prioritaires par recherche quand ils viennent
      // de campagnes differentes.
      columnHelper.accessor("campaignQuery", {
        header: "Recherche d'origine",
        cell: (info) => (
          <Link
            href={`/campaigns/${info.row.original.campaignId}`}
            className="text-neutral-500 hover:underline"
          >
            {info.getValue()}
          </Link>
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
    [],
  );

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (leads.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        Aucun prospect prioritaire pour le moment. Marquez des prospects depuis une campagne (étoile ★) pour
        les retrouver ici.
      </p>
    );
  }

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
            <tr key={row.id} className="border-b border-neutral-100 bg-yellow-50 last:border-0">
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
