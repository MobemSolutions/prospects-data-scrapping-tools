"use client";

import { useState } from "react";
import type { WebsiteAudit } from "@/app/generated/prisma/client";
import { ScoreGauge } from "@/components/ScoreGauge";

type Strategy = "mobile" | "desktop";

export function SiteTechniqueCard({ audit }: { audit: WebsiteAudit | null }) {
  const [strategy, setStrategy] = useState<Strategy>("mobile");

  if (!audit) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
        <h2 className="font-semibold text-neutral-700">Site technique</h2>
        <p>Pas de site web pour ce prospect.</p>
      </div>
    );
  }

  if (audit.errorMessage) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="font-semibold">Site technique</h2>
        <p className="text-red-600">Audit indisponible : {audit.errorMessage}</p>
      </div>
    );
  }

  const scores =
    strategy === "mobile"
      ? {
          performance: audit.mobilePerformance,
          accessibility: audit.mobileAccessibility,
          bestPractices: audit.mobileBestPractices,
          seo: audit.mobileSeo,
        }
      : {
          performance: audit.desktopPerformance,
          accessibility: audit.desktopAccessibility,
          bestPractices: audit.desktopBestPractices,
          seo: audit.desktopSeo,
        };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Site technique (PageSpeed Insights)</h2>
        <div className="flex rounded-md border border-neutral-200 p-0.5 text-sm">
          {(["mobile", "desktop"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStrategy(tab)}
              className={`rounded px-3 py-1 font-medium capitalize transition-colors ${
                strategy === tab ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              {tab === "mobile" ? "Mobile" : "Desktop"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-around">
        <ScoreGauge label="Performance" value={scores.performance} />
        <ScoreGauge label="Accessibilité" value={scores.accessibility} />
        <ScoreGauge label="Bonnes pratiques" value={scores.bestPractices} />
        <ScoreGauge label="SEO technique" value={scores.seo} />
      </div>
      {(audit.lcpMs != null || audit.cls != null) && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-600">
          {audit.lcpMs != null && (
            <>
              <dt>LCP (mobile)</dt>
              <dd>{Math.round(audit.lcpMs)} ms</dd>
            </>
          )}
          {audit.cls != null && (
            <>
              <dt>CLS (mobile)</dt>
              <dd>{audit.cls.toFixed(2)}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
