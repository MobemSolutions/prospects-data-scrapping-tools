import type { CompanyData } from "@/app/generated/prisma/client";
import { EnrichPappersButton } from "@/components/EnrichPappersButton";

interface Dirigeant {
  nom?: string;
  prenom?: string;
  prenoms?: string;
  qualite?: string;
}

export function EntrepriseCard({
  campaignId,
  leadId,
  company,
  pappersQuotaRemaining,
  priorityFlag,
}: {
  campaignId: string;
  leadId: string;
  company: CompanyData | null;
  pappersQuotaRemaining: number;
  priorityFlag: boolean;
}) {
  if (!company || company.matchStatus === "UNMATCHED") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
        <h2 className="font-semibold text-neutral-700">Entreprise</h2>
        <p>Aucune correspondance trouvée sur l&apos;annuaire des entreprises (gouv.fr).</p>
      </div>
    );
  }

  const dirigeants: Dirigeant[] = company.dirigeantsJson ? JSON.parse(company.dirigeantsJson) : [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Entreprise</h2>
        {company.matchStatus === "LOW_CONFIDENCE" && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            À vérifier ({Math.round((company.matchConfidence ?? 0) * 100)}% de correspondance)
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-500">Raison sociale</dt>
        <dd>{company.legalName ?? "—"}</dd>
        <dt className="text-neutral-500">SIREN</dt>
        <dd>{company.siren ?? "—"}</dd>
        <dt className="text-neutral-500">Forme juridique</dt>
        <dd>{company.legalForm ?? "—"}</dd>
        <dt className="text-neutral-500">Code NAF</dt>
        <dd>{company.nafCode ?? "—"}</dd>
        <dt className="text-neutral-500">Date de création</dt>
        <dd>{company.creationDate ? new Date(company.creationDate).toLocaleDateString("fr-FR") : "—"}</dd>
        <dt className="text-neutral-500">Effectif</dt>
        <dd>{company.workforceRange ?? "—"}</dd>
      </dl>

      {company.pappersFetched ? (
        dirigeants.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">Dirigeants</p>
            <ul className="text-sm">
              {dirigeants.map((d, i) => (
                <li key={i}>
                  {d.nom} {d.prenom ?? d.prenoms} {d.qualite ? `— ${d.qualite}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Aucun dirigeant renseigné par Pappers.</p>
        )
      ) : priorityFlag ? (
        <EnrichPappersButton
          campaignId={campaignId}
          leadId={leadId}
          quotaRemaining={pappersQuotaRemaining}
        />
      ) : (
        <p className="text-xs text-neutral-500">
          Marquez ce prospect comme prioritaire (ci-dessus) pour l&apos;enrichir via Pappers — quota
          gratuit limité à {pappersQuotaRemaining} requêtes restantes ce mois-ci.
        </p>
      )}
    </div>
  );
}
