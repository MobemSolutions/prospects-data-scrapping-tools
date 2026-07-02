"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { NotionConflictDialog } from "@/components/NotionConflictDialog";
import {
  checkNotionExportConflicts,
  exportLeadsToNotion,
  type NotionConflictCheckResult,
  type NotionExportDecision,
  type NotionExportResult,
} from "@/app/actions/notion";

type State =
  | { step: "idle" }
  | { step: "checking" }
  | { step: "conflicts"; checks: NotionConflictCheckResult[] }
  | { step: "exporting" }
  | { step: "results"; results: NotionExportResult[] }
  | { step: "error"; message: string };

export function ExportToNotionButton({
  campaignId,
  selectedIds,
  onExported,
}: {
  campaignId: string;
  selectedIds: Set<string>;
  onExported: () => void;
}) {
  const [state, setState] = useState<State>({ step: "idle" });

  if (selectedIds.size === 0 && state.step === "idle") return null;

  async function startExport() {
    setState({ step: "checking" });
    try {
      const checks = await checkNotionExportConflicts(campaignId, [...selectedIds]);
      const hasConflicts = checks.some((c) => c.conflict);
      if (!hasConflicts) {
        await runExport(checks.map((c) => ({ leadId: c.leadId, action: "create" })));
        return;
      }
      setState({ step: "conflicts", checks });
    } catch (error) {
      setState({ step: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function runExport(decisions: NotionExportDecision[]) {
    setState({ step: "exporting" });
    try {
      const results = await exportLeadsToNotion(campaignId, decisions);
      setState({ step: "results", results });
      onExported();
    } catch (error) {
      setState({ step: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  function close() {
    setState({ step: "idle" });
  }

  return (
    <>
      <button
        type="button"
        disabled={selectedIds.size === 0 || state.step === "checking" || state.step === "exporting"}
        onClick={startExport}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state.step === "checking"
          ? "Vérification…"
          : state.step === "exporting"
            ? "Export en cours…"
            : `Exporter vers Notion (${selectedIds.size})`}
      </button>

      {state.step === "conflicts" && (
        <NotionConflictDialog checks={state.checks} onCancel={close} onConfirm={runExport} />
      )}

      {state.step === "results" && (
        <Modal onClose={close}>
          <h2 className="text-lg font-semibold">Résultat de l&apos;export</h2>
          {(() => {
            const created = state.results.filter((r) => r.status === "created").length;
            const updated = state.results.filter((r) => r.status === "updated").length;
            const failed = state.results.filter((r) => r.status === "failed").length;
            const succeeded = created + updated;
            return (
              <>
                {succeeded > 0 && (
                  <p className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
                    ✅ {succeeded} prospect{succeeded > 1 ? "s" : ""} transmis avec succès vers Notion
                  </p>
                )}
                <p className="mt-1 text-sm text-neutral-500">
                  {created} créé(s), {updated} mis à jour, {failed} échec(s).
                </p>
              </>
            );
          })()}
          <ul className="mt-4 flex flex-col gap-1.5 text-sm">
            {state.results.map((r) => (
              <li key={r.leadId} className="flex items-center justify-between gap-2">
                <span>{r.name}</span>
                {r.status === "failed" ? (
                  <span className="text-xs text-red-600" title={r.error}>
                    Échec
                  </span>
                ) : (
                  <a
                    href={r.notionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {r.status === "created" ? "Créée" : "Mise à jour"}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={close}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Fermer
            </button>
          </div>
        </Modal>
      )}

      {state.step === "error" && (
        <Modal onClose={close}>
          <h2 className="text-lg font-semibold text-red-700">Erreur d&apos;export</h2>
          <p className="mt-2 text-sm text-neutral-700">{state.message}</p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
            >
              Fermer
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
