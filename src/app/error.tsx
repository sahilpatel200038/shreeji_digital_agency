"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("route_error", error.digest);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center bg-paper px-4 py-20 text-center">
      <div className="max-w-md">
        <p className="font-display text-sm font-bold tracking-[0.2em] text-bronze-700 uppercase">Something went wrong</p>
        <h1 className="t-h2 mt-3">We hit a problem loading this page</h1>
        <p className="mt-3 text-muted">This is usually temporary. Please try again, or contact us if it keeps happening.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="outline">
            Go home
          </ButtonLink>
        </div>
        {error.digest && <p className="mt-6 text-xs text-muted">Reference: {error.digest}</p>}
      </div>
    </main>
  );
}
