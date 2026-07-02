import { startCampaign } from "@/app/actions/campaigns";

export function CampaignForm() {
  return (
    <form
      action={startCampaign}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="query" className="text-sm font-medium text-neutral-700">
          Requête Google Maps
        </label>
        <input
          id="query"
          name="query"
          type="text"
          required
          placeholder="ex : plombier Paris 15"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>
      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Lancer la campagne
      </button>
    </form>
  );
}
