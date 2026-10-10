/** Loading, error and empty states - every data card uses these three. */

export function Skeleton({ className = "h-40" }) {
  return <div className={`skeleton ${className}`} role="status" aria-label="Loading" />;
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      <div className="skeleton h-8 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

const HINTS = {
  network: "Start the backend:  cd backend && uvicorn app.main:app --reload",
  data_not_ready: "Run the ML pipeline first:  cd ml && python run_pipeline.py",
  coin_not_found: "Pick BTC, ETH or SOL from the selector above.",
};

export function ErrorState({ error, onRetry, compact = false }) {
  const hint = HINTS[error?.code];
  return (
    <div
      role="alert"
      className={`rounded-xl border border-rose-400/20 bg-rose-500/[0.06] text-sm ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-bad">⚠</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">Couldn't load this section</p>
          <p className="mt-0.5 break-words text-ink2">{error?.message}</p>
          {hint && <code className="mt-2 block break-words rounded-lg bg-black/30 px-2 py-1.5 font-mono text-[11px] text-ink2">{hint}</code>}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-line bg-white/5 px-3 py-1.5 text-xs font-medium text-ink hover:bg-white/10"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-black/10 p-5 text-sm">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-ink2">{children}</div>}
    </div>
  );
}

/** Renders loading / error / content for a useApi() result. */
export function Async({ q, skeleton, children, compactError }) {
  if (q.loading && !q.data) return skeleton ?? <CardSkeleton />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} compact={compactError} />;
  if (!q.data) return null;
  return children(q.data);
}
