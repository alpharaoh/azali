import { Skeleton } from "@heroui/react";
import type { ReactNode } from "react";

const CELL_WIDTHS = ["w-40", "w-24", "w-32", "w-20", "w-28", "w-16"];

/** Skeleton table for a first load, before any data is cached. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      aria-label="Loading table"
      aria-busy="true"
      className="border-border overflow-hidden rounded-xl border"
      role="status"
    >
      <div className="bg-surface-secondary border-border flex items-center gap-6 border-b px-4 py-3">
        {CELL_WIDTHS.map((width, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
          <Skeleton key={index} className={`h-3 rounded ${width}`} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <div
          key={rowIndex}
          className="border-border flex items-center gap-6 border-b px-4 py-3 last:border-b-0"
        >
          <div className="flex w-40 items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-full rounded" />
          </div>
          {CELL_WIDTHS.slice(1).map((width, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
            <Skeleton key={index} className={`h-4 rounded ${width}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Keeps stale rows rendered during a refetch, dimmed and inert; when the new
 * page arrives the rows swap in place. Beats unmounting the table for a
 * spinner on every filter change.
 */
export function TableFetchingState({
  children,
  isFetching,
}: {
  children: ReactNode;
  isFetching: boolean;
}) {
  return (
    <div
      aria-busy={isFetching}
      inert={isFetching}
      className={`transition-opacity duration-150 ${
        isFetching ? "pointer-events-none opacity-50 select-none" : ""
      }`}
    >
      {children}
    </div>
  );
}
