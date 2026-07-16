import { useEffect, useState } from "react";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Search-input state mirrored into the URL: typing is debounced into the
 * URL's `q` param (the server does the searching), and URL changes
 * (back/forward, shared links) flow back into the input.
 *
 * `commit` must be referentially stable (wrap it in useCallback) — it is a
 * dependency of the debounce effect, and an unstable identity restarts the
 * timer every render.
 */
export function useDebouncedUrlSearch(
  urlQuery: string | undefined,
  commit: (q: string | undefined) => void,
) {
  const [searchInput, setSearchInput] = useState(urlQuery ?? "");

  // Keep the input in sync with the URL (back/forward, shared links).
  useEffect(() => {
    setSearchInput(urlQuery ?? "");
  }, [urlQuery]);

  // Debounce typing into the URL.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((urlQuery ?? "") !== searchInput) {
        commit(searchInput || undefined);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput, urlQuery, commit]);

  return [searchInput, setSearchInput] as const;
}
