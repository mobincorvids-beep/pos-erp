export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted py-8 justify-center">
      <span className="h-3 w-3 rounded-full border-2 border-rule border-t-accent animate-spin" />
      {label}
    </div>
  );
}
