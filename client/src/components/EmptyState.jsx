/** An empty screen is an invitation to act, not just an absence notice. */
export function EmptyState({ title, description, action }) {
  return (
    <div className="text-center py-16 px-6">
      <p className="font-display text-lg text-ink mb-1">{title}</p>
      {description && <p className="text-sm text-ink-muted mb-4 max-w-sm mx-auto">{description}</p>}
      {action}
    </div>
  );
}
