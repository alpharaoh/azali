import { createLogger } from "@/lib/logger";
import type { PdfWorkerResponse } from "./worker";

const log = createLogger("pdf-service");

/**
 * RPC client for the PDF worker (see worker.ts) — PDFium's WASM rendering
 * is CPU-bound and synchronous, so it must never run on the main thread.
 * One persistent worker; requests correlate by id; a crashed worker rejects
 * everything in flight and is respawned on the next call.
 */
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

/** Omit distributed over the request union (plain Omit collapses it). */
type PdfWorkerCall =
  | { op: "render"; data: Uint8Array; scale: number }
  | { op: "text"; data: Uint8Array };

function getWorker(): Worker {
  if (worker) return worker;
  // __dirname works under both Bun's ESM runtime and the CJS typecheck —
  // unlike import.meta, which the nest build target rejects.
  worker = new Worker(`${__dirname}/worker.ts`);
  worker.onmessage = (message: MessageEvent<PdfWorkerResponse>) => {
    const response = message.data;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) entry.resolve(response.result);
    else entry.reject(new Error(response.error));
  };
  worker.onerror = (event) => {
    log.error({ err: event.message }, "pdf worker crashed — respawning");
    for (const entry of pending.values()) {
      entry.reject(new Error(`pdf worker crashed: ${event.message}`));
    }
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function call<T>(request: PdfWorkerCall): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    // Transfer the document bytes — the caller never reuses them.
    getWorker().postMessage({ ...request, id }, [
      request.data.buffer as ArrayBuffer,
    ]);
  });
}

export class PdfPreviewService {
  /** Extract per-page text from a PDF. */
  static async text({ data }: { data: Uint8Array }): Promise<string[]> {
    return call<string[]>({ op: "text", data });
  }

  /** Render page 1 of a PDF as a PNG, and report the page count. */
  static async render({
    data,
    scale = 2,
  }: {
    data: Uint8Array;
    scale?: number;
  }): Promise<{ png: Uint8Array; pageCount: number }> {
    return call<{ png: Uint8Array; pageCount: number }>({
      op: "render",
      data,
      scale,
    });
  }
}
