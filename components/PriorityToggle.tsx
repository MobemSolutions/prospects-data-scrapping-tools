"use client";

import { useTransition } from "react";
import { togglePriority } from "@/app/actions/leads";

export function PriorityToggle({
  campaignId,
  leadId,
  priorityFlag,
}: {
  campaignId: string;
  leadId: string;
  priorityFlag: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => togglePriority(campaignId, leadId))}
      className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${
        priorityFlag
          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
          : "border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {priorityFlag ? "★ Prospect prioritaire" : "☆ Marquer prioritaire"}
    </button>
  );
}
