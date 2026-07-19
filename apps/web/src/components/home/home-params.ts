import type {
  ShipmentEventsControllerFindAllParams,
  ShipmentsControllerFindAllParams,
} from "#/generated/api";

/**
 * Query params shared between the /dashboard route loader (prefetch) and the
 * home components (hooks) — identical objects mean identical query keys, so
 * the loader's warm-up is actually reused.
 */

/** Reviews soonest-deadline first; the snippet shows the head, the
 * recommended-actions card counts the due-soon tail over the same page. */
export const HOME_REVIEWS_PARAMS = {
  status: ["needs_review"],
  sortBy: "reviewDeadlineAt",
  sortDir: "asc",
  limit: 50,
  offset: 0,
} satisfies ShipmentsControllerFindAllParams;

/** The broad in-flight page — feeds the P1 derivation and the activity
 * feed's event→shipment join. Same key as the Logs page's join query. */
export const HOME_SHIPMENTS_PARAMS = {
  limit: 100,
} satisfies ShipmentsControllerFindAllParams;

/** Latest arrivals for the "Latest shipments" card. */
export const HOME_LATEST_PARAMS = {
  sortBy: "createdAt",
  sortDir: "desc",
  limit: 5,
  offset: 0,
} satisfies ShipmentsControllerFindAllParams;

/** AI action feed — same key as the Logs page, deduped by React Query. */
export const HOME_EVENTS_PARAMS = {
  actor: ["ai"],
  limit: 200,
} satisfies ShipmentEventsControllerFindAllParams;
