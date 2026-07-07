/** 進捗バー。pct は 0〜100。 */
export function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-sky-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-main to-sky-400 transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label && (
        <p className="mt-1.5 flex justify-between text-xs font-bold text-slate-500">
          <span>{label}</span>
          <span className="tabular-nums text-main">{clamped}%</span>
        </p>
      )}
    </div>
  );
}
