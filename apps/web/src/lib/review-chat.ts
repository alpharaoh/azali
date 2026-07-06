import { useSyncExternalStore } from "react";

/**
 * Session-local "Ask the agent" chat store. Broker notes are persisted as
 * shipment events; this store only holds the mock AI conversation until the
 * real agent chat lands.
 */
export interface ThreadMessage {
  id: string;
  author: "ai" | "broker";
  body: string;
  kind: "chat" | "note";
  /** Reference into the item's citations — AI answers cite their source. */
  citationRef?: string;
}

let threads: ReadonlyMap<string, readonly ThreadMessage[]> = new Map();
const threadListeners = new Set<() => void>();

function threadSubscribe(listener: () => void) {
  threadListeners.add(listener);

  return () => {
    threadListeners.delete(listener);
  };
}

function threadSnapshot() {
  return threads;
}

export function addThreadMessage(itemId: string, message: ThreadMessage) {
  const next = new Map(threads);

  next.set(itemId, [...(next.get(itemId) ?? []), message]);
  threads = next;
  for (const listener of threadListeners) listener();
}

export function useReviewThreads() {
  return useSyncExternalStore(threadSubscribe, threadSnapshot, threadSnapshot);
}
