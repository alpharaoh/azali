import { useLocalStorage } from "usehooks-ts";

export const ROWS_PER_PAGE_OPTIONS = [25, 50, 100] as const;

const STORAGE_KEY = "azali:rows-per-page";
const DEFAULT_ROWS_PER_PAGE = 25;

/**
 * Rows-per-page preference, persisted to localStorage and shared by every
 * paginated table in the app.
 */
export function useRowsPerPage() {
  return useLocalStorage<number>(STORAGE_KEY, DEFAULT_ROWS_PER_PAGE);
}

/**
 * Non-hook accessor for route loaders, so prefetched list queries use the
 * same page size (and therefore the same query key) as the rendered table.
 */
export function getStoredRowsPerPage(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw ? Number(JSON.parse(raw)) : DEFAULT_ROWS_PER_PAGE;
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_ROWS_PER_PAGE;
  } catch {
    return DEFAULT_ROWS_PER_PAGE;
  }
}
