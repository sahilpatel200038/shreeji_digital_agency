import { cn } from "@/lib/utils";
import { Container, Row } from "@/components/ui/layout";
import { Icon } from "@/components/ui/icons";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading page">
      <div className="bg-forest-900 py-20">
        <Container>
          <Row>
            <Skeleton className="h-4 w-32 !bg-white/20" />
            <Skeleton className="mt-5 h-12 w-3/4 max-w-xl !bg-white/20" />
            <Skeleton className="mt-4 h-5 w-2/3 max-w-lg !bg-white/10" />
          </Row>
        </Container>
      </div>
      <Container className="py-14">
        <Row className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </Row>
      </Container>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-dashed border-forest-900/20 bg-white px-6 py-14 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-forest-50 text-forest-700">
        <Icon name="inbox" />
      </span>
      <h3 className="t-h3">{title}</h3>
      {text && <p className="mx-auto mt-2 max-w-md text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
