/**
 * Used for every dashboard section whose backend logic exists in
 * packages/core but has no HTTP route exposing it yet. This is
 * deliberate honesty, not a missing feature hidden behind a spinner:
 * the console must never imply data exists when it doesn't.
 */
export function NotWiredCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded border border-dashed border-base-600 bg-base-900/40 p-6">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-signal-idle" />
        <h3 className="font-display text-sm font-medium text-ink-300">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-ink-500">{detail}</p>
    </div>
  );
}
