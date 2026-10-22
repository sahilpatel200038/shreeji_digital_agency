"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-[var(--radius-card)] border border-line bg-white p-8 text-center">
      <h1 className="text-2xl font-extrabold">This screen could not load</h1>
      <p className="mt-2 text-muted">There was a problem reading from the database or processing your request. Nothing has been changed.</p>
      <button onClick={reset} className="mt-6 min-h-11 rounded-[var(--radius-field)] bg-forest-900 px-6 font-semibold text-white hover:bg-forest-800">
        Try again
      </button>
      {error.digest && <p className="mt-4 text-xs text-muted">Reference: {error.digest}</p>}
    </div>
  );
}
