/** Shared UI primitives — §14: clean, warm, readable. Display only. */

export function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-300";
  if (score >= 65) return "text-amber-300";
  return "text-red-300";
}

export function Panel({
  title,
  hint,
  className = "",
  children,
}: {
  title?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset] ${className}`}
    >
      {title && (
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          {title}
          {hint && (
            <span className="ml-2 font-normal normal-case tracking-normal text-zinc-500">
              {hint}
            </span>
          )}
        </h2>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = "text-zinc-100",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export function Meter({
  label,
  value,
  tone,
  labelWidth = "w-24",
}: {
  label: string;
  value: number;
  tone: string;
  labelWidth?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`${labelWidth} capitalize text-zinc-500`}>{label}</span>
      <div className="h-1.5 flex-1 rounded bg-zinc-800">
        <div
          className={`h-1.5 rounded transition-[width] duration-500 ${tone}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-8 text-right tabular-nums text-zinc-400">{Math.round(value)}</span>
    </div>
  );
}

export function PrimaryButton({
  onClick,
  disabled,
  className = "",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md bg-amber-400 px-5 py-2 font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  onClick,
  disabled,
  className = "",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
