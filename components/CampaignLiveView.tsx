"use client";

import { useEffect, useState } from "react";
import { ProgressBar } from "@/components/ProgressBar";
import { LeadsTable, type LeadRow } from "@/components/LeadsTable";
import { ExportToNotionButton } from "@/components/ExportToNotionButton";
import { togglePriority } from "@/app/actions/leads";

interface CampaignSnapshot {
  status: string;
  totalLeads: number;
  processedLeads: number;
  errorMessage?: string | null;
  leads: LeadRow[];
}

const ACTIVE_STATUSES = new Set(["PENDING", "SCRAPING", "ANALYZING"]);

export function CampaignLiveView({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: CampaignSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [priorityOnly, setPriorityOnly] = useState(false);

  useEffect(() => {
    if (!ACTIVE_STATUSES.has(snapshot.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/progress`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as CampaignSnapshot;
        setSnapshot(data);
      } catch {
        // ignore les echecs de poll ponctuels, on reessaiera au prochain tick
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [campaignId, snapshot.status]);

  function toggleLead(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(snapshot.leads.map((l) => l.id)) : new Set());
  }

  function handleTogglePriority(leadId: string) {
    // Mise a jour optimiste immediate (au lieu d'attendre le prochain
    // polling toutes les 2s), l'action serveur s'execute en arriere-plan.
    setSnapshot((prev) => ({
      ...prev,
      leads: prev.leads.map((l) => (l.id === leadId ? { ...l, priorityFlag: !l.priorityFlag } : l)),
    }));
    togglePriority(campaignId, leadId).catch((error) => {
      console.error("Echec du changement de priorite", error);
    });
  }

  const visibleLeads = priorityOnly ? snapshot.leads.filter((l) => l.priorityFlag) : snapshot.leads;
  const priorityCount = snapshot.leads.filter((l) => l.priorityFlag).length;

  return (
    <div className="flex flex-col gap-4">
      <ProgressBar
        processed={snapshot.processedLeads}
        total={snapshot.totalLeads}
        status={snapshot.status}
        errorMessage={snapshot.errorMessage}
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={priorityOnly}
            onChange={(e) => setPriorityOnly(e.target.checked)}
          />
          Prioritaires uniquement ({priorityCount})
        </label>
        {selectedIds.size > 0 && (
          <ExportToNotionButton
            campaignId={campaignId}
            selectedIds={selectedIds}
            onExported={() => setSelectedIds(new Set())}
          />
        )}
      </div>
      {visibleLeads.length > 0 ? (
        <LeadsTable
          campaignId={campaignId}
          leads={visibleLeads}
          selectedIds={selectedIds}
          onToggleLead={toggleLead}
          onToggleAll={toggleAll}
          onTogglePriority={handleTogglePriority}
        />
      ) : (
        priorityOnly && (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
            Aucun prospect prioritaire dans cette campagne pour le moment.
          </p>
        )
      )}
    </div>
  );
}
