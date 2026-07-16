/**
 * PDF CPU work (PDFium WASM rendering + text extraction) runs HERE, in a
 * dedicated worker thread. On the main thread a single page-1 render at 2×
 * scale blocks the event loop for hundreds of milliseconds to seconds —
 * during an ingest batch that froze every HTTP response and websocket ping
 * the API owed. The main thread talks to this worker via pdf/service.ts.
 */
import { PDFiumLibrary } from "@hyzyla/pdfium";
import { encode } from "fast-png";

declare const self: Worker;

let libraryPromise: Promise<PDFiumLibrary> | null = null;
const getLibrary = () => {
  libraryPromise ??= PDFiumLibrary.init();
  return libraryPromise;
};

export type PdfWorkerRequest = {
  id: number;
  data: Uint8Array;
} & ({ op: "render"; scale: number } | { op: "text" });

export type PdfWorkerResponse = {
  id: number;
} & (
  | { ok: true; result: { png: Uint8Array; pageCount: number } | string[] }
  | { ok: false; error: string }
);

async function render(data: Uint8Array, scale: number) {
  const library = await getLibrary();
  const doc = await library.loadDocument(data);
  try {
    const pageCount = doc.getPageCount();
    const bitmap = await doc.getPage(0).render({ scale, render: "bitmap" });

    // PDFium emits BGRA; PNG wants RGBA — swap the channels in place.
    const pixels = bitmap.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const blue = pixels[i];
      pixels[i] = pixels[i + 2] as number;
      pixels[i + 2] = blue as number;
    }

    const png = encode({
      width: bitmap.width,
      height: bitmap.height,
      data: pixels,
      channels: 4,
    });
    return { png, pageCount };
  } finally {
    doc.destroy();
  }
}

async function text(data: Uint8Array) {
  const library = await getLibrary();
  const doc = await library.loadDocument(data);
  try {
    const pages: string[] = [];
    for (let i = 0; i < doc.getPageCount(); i++) {
      pages.push(doc.getPage(i).getText());
    }
    return pages;
  } finally {
    doc.destroy();
  }
}

self.onmessage = async (message: MessageEvent<PdfWorkerRequest>) => {
  const request = message.data;
  try {
    const result =
      request.op === "render"
        ? await render(request.data, request.scale)
        : await text(request.data);
    const response: PdfWorkerResponse = { id: request.id, ok: true, result };
    const transfer =
      "png" in (result as { png?: Uint8Array })
        ? [(result as { png: Uint8Array }).png.buffer as ArrayBuffer]
        : [];
    self.postMessage(response, transfer);
  } catch (error) {
    const response: PdfWorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
