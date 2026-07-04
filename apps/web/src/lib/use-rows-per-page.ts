import { useLocalStorage } from "usehooks-ts";

export const ROWS_PER_PAGE_OPTIONS = [25, 50, 100] as const;

/**
 * Rows-per-page preference, persisted to localStorage and shared by every
 * paginated table in the app.
 */
export function useRowsPerPage() {
	return useLocalStorage<number>("azali:rows-per-page", 25);
}
