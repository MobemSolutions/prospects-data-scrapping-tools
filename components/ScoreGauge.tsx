export function ScoreGauge({ label, value }: { label: string; value: number | null }) {
  const color =
    value == null
      ? "bg-neutral-200 text-neutral-500"
      : value >= 90
        ? "bg-emerald-100 text-emerald-700"
        : value >= 50
          ? "bg-amber-100 text-amber-700"
          : "bg-red-100 text-red-700";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold ${color}`}>
        {value ?? "—"}
      </div>
      <span className="text-center text-xs text-neutral-500">{label}</span>
    </div>
  );
}
