import type { GmbData, Lead } from "@/app/generated/prisma/client";

export function GmbCard({ lead, gmbData }: { lead: Lead; gmbData: GmbData | null }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="font-semibold">Fiche Google My Business</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-500">Adresse</dt>
        <dd>{lead.address ?? "—"}</dd>
        <dt className="text-neutral-500">Téléphone</dt>
        <dd>{lead.phone ?? "—"}</dd>
        <dt className="text-neutral-500">Site web</dt>
        <dd>
          {lead.website ? (
            <a href={lead.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              {lead.website}
            </a>
          ) : (
            <span className="font-medium text-red-600">Aucun</span>
          )}
        </dd>
        <dt className="text-neutral-500">Note / Avis</dt>
        <dd>
          {gmbData ? `${gmbData.rating.toFixed(1)} ★ (${gmbData.reviewCount} avis)` : "—"}
        </dd>
        <dt className="text-neutral-500">Photos GMB</dt>
        <dd>
          {gmbData ? (
            gmbData.hasPhotos && gmbData.photoCount ? (
              <span className="text-emerald-600">
                {gmbData.photoCount} photo{gmbData.photoCount > 1 ? "s" : ""} visible
                {gmbData.photoCount > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-red-600">Aucune</span>
            )
          ) : (
            "—"
          )}
        </dd>
      </dl>
    </div>
  );
}
