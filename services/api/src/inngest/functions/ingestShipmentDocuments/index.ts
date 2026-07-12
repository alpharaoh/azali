import type { Logger } from "@nestjs/common";
import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import type { ShipmentDocumentCategory } from "@/db/schema";
import { KnowledgeBaseService } from "@/services/external/pinecone/service";
import { inngest } from "../../client";
import {
  attachDocument,
  createDocumentRow,
  createShipmentFromSynthesis,
  documentReceivedEvent,
  type ExtractedDocument,
  extractDocument,
  factsExtractedEvent,
  knowledgeRecord,
  markExtractionFailed,
  renderPreview,
  resolveClient,
  saveExtraction,
  savePreview,
  shipmentCreatedEvent,
  synthesizeShipmentFacts,
} from "./utils";

export const SHIPMENT_DOCUMENTS_UPLOADED_EVENT =
  "shipment/documents.uploaded" as const;

export type ShipmentDocumentsUploadedEvent = {
  data: {
    organizationId: string;
    userId: string;
    bucket: string;
    files: Array<{
      key: string;
      fileName: string;
      contentType: string;
      size: number;
      category: ShipmentDocumentCategory;
    }>;
  };
};

/**
 * Kickstarts the shipment process from a batch of uploaded documents:
 * extracts structured data from each file, renders a preview image, creates
 * the shipment the batch describes, and indexes everything for retrieval.
 *
 * Every await lives in its own step so a failure retries only that unit —
 * except downloads, which must share a step with their consumer because file
 * bytes cannot cross a step boundary. Documents are processed in parallel;
 * one bad file marks its own row and never sinks the batch.
 */
export const ingestShipmentDocuments = (dependencies: { logger: Logger }) => {
  return inngest.createFunction(
    {
      id: "ingest-shipment-documents",
      retries: 2,
      concurrency: [{ key: "event.data.organizationId", limit: 2 }],
      triggers: [{ event: SHIPMENT_DOCUMENTS_UPLOADED_EVENT }],
    },
    async ({ event, step }) => {
      const { organizationId, userId, files } =
        event.data as ShipmentDocumentsUploadedEvent["data"];
      const context = { organizationId, userId };

      // 1. One audit row per file, in parallel — rows exist even if
      //    extraction fails, and re-delivered events reuse them.
      const documents = await Promise.all(
        files.map((file, index) =>
          step.run(`document-row-${index}`, () =>
            createDocumentRow(context, file),
          ),
        ),
      );

      // 2. Extraction and previews for all documents run concurrently.
      const extractionsPromise = Promise.all(
        documents.map(async (document): Promise<ExtractedDocument | null> => {
          try {
            const extraction = await step.run(`extract-${document.id}`, () =>
              extractDocument(document),
            );
            await step.run(`save-extraction-${document.id}`, () =>
              saveExtraction(context, document.id, extraction),
            );
            return { ...document, extraction };
          } catch (error) {
            await step.run(`mark-failed-${document.id}`, () =>
              markExtractionFailed(context, document.id, error),
            );
            dependencies.logger.warn(
              `Extraction failed for document ${document.id} (${document.fileName})`,
            );
            return null;
          }
        }),
      );

      const previewsPromise = Promise.all(
        documents
          .filter((document) => document.contentType === "application/pdf")
          .map(async (document) => {
            try {
              const preview = await step.run(
                `render-preview-${document.id}`,
                () => renderPreview(document),
              );
              await step.run(`save-preview-${document.id}`, () =>
                savePreview(context, document.id, preview),
              );
            } catch {
              // A missing preview never blocks ingestion.
              dependencies.logger.warn(
                `Preview render failed for document ${document.id} (${document.fileName})`,
              );
            }
          }),
      );

      const [extractionResults] = await Promise.all([
        extractionsPromise,
        previewsPromise,
      ]);
      const extracted = extractionResults.filter((item) => item !== null);

      if (extracted.length === 0) {
        return { shipmentId: null, extracted: 0, failed: documents.length };
      }

      // 3. Derive the shipment: facts → client → shipment → attach documents.
      const synthesis = await step.run("synthesize-shipment", () =>
        synthesizeShipmentFacts(extracted),
      );
      const clientId = await step.run("resolve-client", () =>
        resolveClient(context, synthesis),
      );
      const shipment = await step.run("create-shipment", () =>
        createShipmentFromSynthesis(context, synthesis, clientId),
      );
      await Promise.all(
        documents.map((document) =>
          step.run(`attach-document-${document.id}`, () =>
            attachDocument(context, document.id, shipment.id),
          ),
        ),
      );

      // 4. Timeline events — the same shapes the review UI already renders.
      await Promise.all([
        ...extracted.map((item) =>
          step.run(`record-document-${item.id}`, () =>
            insertShipmentEvent(
              documentReceivedEvent(context, shipment.id, item),
            ),
          ),
        ),
        step.run("record-facts", () =>
          insertShipmentEvent(
            factsExtractedEvent(context, shipment.id, synthesis),
          ),
        ),
        step.run("record-activity", () =>
          insertShipmentEvent(
            shipmentCreatedEvent(
              context,
              shipment.id,
              synthesis,
              extracted.length,
            ),
          ),
        ),
      ]);

      // 5. Make every document retrievable by meaning.
      await step.run("ensure-knowledge-index", () =>
        KnowledgeBaseService.ensureIndex(),
      );
      await step.run("index-documents", () =>
        KnowledgeBaseService.upsert({
          organizationId,
          documents: extracted.map((item) =>
            knowledgeRecord(item, shipment.id),
          ),
        }),
      );

      return {
        shipmentId: shipment.id,
        extracted: extracted.length,
        failed: documents.length - extracted.length,
      };
    },
  );
};
