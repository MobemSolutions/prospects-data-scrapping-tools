export function ExportCsvButton({ campaignId }: { campaignId: string }) {
  return (
    <a
      href={`/api/campaigns/${campaignId}/export`}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
    >
      Exporter en CSV
    </a>
  );
}
