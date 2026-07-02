"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import type { NotionConflictCheckResult, NotionExportDecision } from "@/app/actions/notion";

type ConflictChoice = "overwrite" | "duplicate";

export function NotionConflictDialog({
  checks,
  onCancel,
  onConfirm,
}: {
  checks: NotionConflictCheckResult[];
  onCancel: () => void;
  onConfirm: (decisions: NotionExportDecision[]) => void;
}) {
  const conflicts = checks.filter((c) => c.conflict);
  const nonConflicts = checks.filter((c) => !c.conflict);

  // Par defaut : "Créer une copie" (non destructif) pour chaque conflit.
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>(() =>
    Object.fromEntries(conflicts.map((c) => [c.leadId, "duplicate" as ConflictChoice])),
  );

  function confirm() {
    const decisions: NotionExportDecision[] = [
      ...nonConflicts.map((c) => ({ leadId: c.leadId, action: "create" as const })),
      ...conflicts.map((c) => ({ leadId: c.leadId, action: choices[c.leadId] })),
    ];
    onConfirm(decisions);
  }

  return (
    <Modal onClose={onCancel}>
      <h2 className="text-lg font-semibold">Prospects déjà présents dans Notion</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {conflicts.length} prospect{conflicts.length > 1 ? "s" : ""} sur {checks.length} existe
        {conflicts.length > 1 ? "nt" : ""} déjà (page Notion trouvée avec le même nom). Choisissez, pour
        chacun, écraser la page existante ou en créer une copie.
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {conflicts.map((c) => (
          <li key={c.leadId} className="rounded-md border border-neutral-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{c.name}</span>
              {c.existingPageUrl && (
                <a
                  href={c.existingPageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Voir la page existante
                </a>
              )}
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setChoices((prev) => ({ ...prev, [c.leadId]: "overwrite" }))}
                className={`rounded-full px-3 py-1 font-medium ${
                  choices[c.leadId] === "overwrite"
                    ? "bg-red-100 text-red-700"
                    : "border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Écraser
              </button>
              <button
                type="button"
                onClick={() => setChoices((prev) => ({ ...prev, [c.leadId]: "duplicate" }))}
                className={`rounded-full px-3 py-1 font-medium ${
                  choices[c.leadId] === "duplicate"
                    ? "bg-emerald-100 text-emerald-700"
                    : "border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Créer une copie
              </button>
            </div>
          </li>
        ))}
      </ul>

      {nonConflicts.length > 0 && (
        <p className="mt-4 text-xs text-neutral-500">
          {nonConflicts.length} autre{nonConflicts.length > 1 ? "s" : ""} prospect
          {nonConflicts.length > 1 ? "s" : ""} sans conflit sera{nonConflicts.length > 1 ? "ont" : ""} créé
          {nonConflicts.length > 1 ? "s" : ""} normalement.
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={confirm}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Confirmer l&apos;export
        </button>
      </div>
    </Modal>
  );
}
