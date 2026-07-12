import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import type { ShipmentDocumentCategory } from "@/db/schema";
import { langfuseSpanProcessor } from "@/instrumentation";
import { KnowledgeBaseService } from "@/services/external/pinecone/service";
import { inngest } from "../../client";
import { SHIPMENT_CLASSIFY_REQUESTED_EVENT } from "../classifyShipment";
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
export const ingestShipmentDocuments = () => {
  return inngest.createFunction(
    {
      id: "ingest-shipment-documents",
      retries: 2,
      concurrency: [{ key: "event.data.organizationId", limit: 2 }],
      triggers: [{ event: SHIPMENT_DOCUMENTS_UPLOADED_EVENT }],
    },
    async ({ event, step, logger }) => {
      const { organizationId, userId, files } =
        event.data as ShipmentDocumentsUploadedEvent["data"];
      const context = {
        organizationId,
        userId,
        batchId: event.id ?? "unbatched",
      };

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
              extractDocument(context, document),
            );
            await step.run(`save-extraction-${document.id}`, () =>
              saveExtraction(context, document.id, extraction),
            );
            return { ...document, extraction };
          } catch (error) {
            await step.run(`mark-failed-${document.id}`, () =>
              markExtractionFailed(context, document.id, error),
            );
            logger.warn(
              { documentId: document.id, fileName: document.fileName },
              "document extraction failed",
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
              logger.warn(
                { documentId: document.id, fileName: document.fileName },
                "preview render failed",
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
        synthesizeShipmentFacts(context, extracted),
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

      // Classification picks up from here as its own run.
      await step.sendEvent("request-classification", {
        name: SHIPMENT_CLASSIFY_REQUESTED_EVENT,
        data: { organizationId, userId, shipmentId: shipment.id },
      });

      // Push any buffered trace spans out before the run completes.
      await langfuseSpanProcessor?.forceFlush();

      return {
        shipmentId: shipment.id,
        extracted: extracted.length,
        failed: documents.length - extracted.length,
      };
    },
  );
};
