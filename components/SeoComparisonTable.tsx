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

export interface ComparisonRow {
  id: string;
  name: string;
  website: string;
  mobilePerformance: number | null;
  mobileAccessibility: number | null;
  mobileBestPractices: number | null;
  mobileSeo: number | null;
  contentScore: number | null;
  wordCount: number | null;
  altCoveragePct: number | null;
  hasStructuredData: boolean | null;
  openPageRank: number | null;
  geoScore: number | null;
  aiBotsAllowedCount: number | null;
  aiBotsTotalChecked: number | null;
  llmsTxtFound: boolean | null;
}

const columnHelper = createColumnHelper<ComparisonRow>();

export function SeoComparisonTable({ campaignId, rows }: { campaignId: string; rows: ComparisonRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "contentScore", desc: true }]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Prospect",
        cell: (info) => (
          <Link
            href={`/campaigns/${campaignId}/leads/${info.row.original.id}`}
            className="font-medium hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("mobilePerformance", {
        header: "Perf. (PSI)",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("mobileAccessibility", {
        header: "Access. (PSI)",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("mobileSeo", {
        header: "SEO technique (PSI)",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("contentScore", {
        header: "Score contenu SEO",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("wordCount", {
        header: "Mots",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("altCoveragePct", {
        header: "Images avec alt",
        cell: (info) => (info.getValue() != null ? `${info.getValue()}%` : "—"),
      }),
      columnHelper.accessor("hasStructuredData", {
        header: "Données structurées",
        cell: (info) => (info.getValue() == null ? "—" : info.getValue() ? "Oui" : "Non"),
      }),
      columnHelper.accessor("openPageRank", {
        header: "OpenPageRank",
        cell: (info) => (info.getValue() != null ? info.getValue()!.toFixed(1) : "—"),
      }),
      columnHelper.accessor("geoScore", {
        header: "Score GEO",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.display({
        id: "aiBots",
        header: "Bots IA autorisés",
        cell: (info) => {
          const { aiBotsAllowedCount, aiBotsTotalChecked } = info.row.original;
          return aiBotsTotalChecked != null ? `${aiBotsAllowedCount}/${aiBotsTotalChecked}` : "—";
        },
      }),
      columnHelper.accessor("llmsTxtFound", {
        header: "llms.txt",
        cell: (info) => (info.getValue() == null ? "—" : info.getValue() ? "Oui" : "Non"),
      }),
    ],
    [campaignId],
  );

  const table = useReactTable({
    data: rows,
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
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium text-neutral-600"
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
            <tr key={row.id} className="border-b border-neutral-100 last:border-0">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-3 py-2">
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
