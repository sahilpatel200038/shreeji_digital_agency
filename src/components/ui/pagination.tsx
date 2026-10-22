import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pages,
  makeHref,
}: {
  page: number;
  pages: number;
  makeHref: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  const item = "grid min-h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-semibold";
  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={makeHref(page - 1)} rel="prev" className={cn(item, "border border-line bg-white hover:border-bronze-300")}>
          Previous
        </Link>
      )}
      {nums.map((n, i) => (
        <span key={n} className="contents">
          {i > 0 && n - nums[i - 1] > 1 && <span aria-hidden="true">…</span>}
          <Link
            href={makeHref(n)}
            aria-current={n === page ? "page" : undefined}
            className={cn(item, n === page ? "bg-forest-900 text-white" : "border border-line bg-white hover:border-bronze-300")}
          >
            {n}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={makeHref(page + 1)} rel="next" className={cn(item, "border border-line bg-white hover:border-bronze-300")}>
          Next
        </Link>
      )}
    </nav>
  );
}
