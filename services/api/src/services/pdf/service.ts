import { PDFiumLibrary } from "@hyzyla/pdfium";
import { encode } from "fast-png";

// The WASM module is loaded once per process and reused across renders.
let libraryPromise: Promise<PDFiumLibrary> | null = null;
const getLibrary = () => {
  libraryPromise ??= PDFiumLibrary.init();
  return libraryPromise;
};

export class PdfPreviewService {
  /** Render page 1 of a PDF as a PNG, and report the page count. */
  static async render({
    data,
    scale = 2,
  }: {
    data: Uint8Array;
    scale?: number;
  }): Promise<{ png: Uint8Array; pageCount: number }> {
    const library = await getLibrary();
    const document = await library.loadDocument(data);

    try {
      const pageCount = document.getPageCount();
      const bitmap = await document.getPage(0).render({
        scale,
        render: "bitmap",
      });

      // PDFium emits BGRA; PNG wants RGBA — swap the channels in place.
      const pixels = bitmap.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const blue = pixels[i];
        pixels[i] = pixels[i + 2];
        pixels[i + 2] = blue;
      }

      const png = encode({
        width: bitmap.width,
        height: bitmap.height,
        data: pixels,
        channels: 4,
      });

      return { png, pageCount };
    } finally {
      document.destroy();
    }
  }
}
