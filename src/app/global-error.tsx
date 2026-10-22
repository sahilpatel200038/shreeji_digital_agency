"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fbf8f1", color: "#10261a", margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          <div>
            <h1 style={{ color: "#053620" }}>Something went wrong</h1>
            <p>Please try again in a moment.</p>
            <button onClick={reset} style={{ background: "#053620", color: "#fff", border: 0, padding: "12px 24px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
