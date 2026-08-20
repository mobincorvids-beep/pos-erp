export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="chip-danger !inline-block w-full !rounded px-3 py-2 mb-3 text-sm">
      {message}
    </div>
  );
}
