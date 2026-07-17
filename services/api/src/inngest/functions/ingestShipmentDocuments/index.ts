import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { updateShipment } from "@/db/queries/update/updateShipment";
import type { ShipmentDocumentCategory } from "@/db/schema";
import { recordProcessingFailure } from "@/inngest/lib/recordProcessingFailure";
import { langfuseSpanProcessor } from "@/instrumentation";
import { KnowledgeBaseService } from "@/services/external/pinecone/service";
import { inngest } from "../../client";
import { SHIPMENT_CLASSIFY_REQUESTED_EVENT } from "../classifyShipment";
import {
  createDocumentRow,
  createLineItems,
  documentReceivedEvent,
  type ExtractedDocument,
  extractDocument,
  factsExtractedEvent,
  knowledgeRecord,
  loadAllExtractedDocuments,
  markExtractionFailed,
  matchOrCreateProduct,
  renderPreview,
  resolveClient,
  saveExtraction,
  savePreview,
  shipmentCreatedEvent,
  synthesizeShipmentFacts,
  updateShipmentFromSynthesis,
} from "./utils";

export const SHIPMENT_DOCUMENTS_UPLOADED_EVENT =
  "shipment/documents.uploaded" as const;

export type ShipmentDocumentsUploadedEvent = {
  data: {
    organizationId: string;
    userId: string;
    /** The shipment pre-created at upload time that this batch fills in. */
    shipmentId: string;
    bucket: string;
    files: Array<{
      key: string;
      fileName: string;
      contentType: string;
      size: number;
      category: ShipmentDocumentCategory;
    }>;
    /**
     * Skip the classification kick-off at the end of ingestion. Email-
     * sourced shipments set this — their intake window (finalize-email-
     * shipment) triggers classification once follow-up emails stop.
     */
    deferClassification?: boolean;
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
      concurrency: [
        { key: "event.data.organizationId", limit: 2 },
        // Follow-up email batches for one shipment must not interleave —
        // synthesis and line replacement assume exclusive access.
        { key: "event.data.shipmentId", limit: 1 },
      ],
      triggers: [{ event: SHIPMENT_DOCUMENTS_UPLOADED_EVENT }],
      // Retries exhausted — the shipment must not look like it is still
      // processing, and the failure must land on its timeline.
      onFailure: async ({ event, error, logger }) => {
        const { organizationId, userId, shipmentId } = event.data.event
          .data as ShipmentDocumentsUploadedEvent["data"];
        logger.error(
          { shipmentId, err: error },
          "ingestion failed after retries — clearing processing state",
        );
        await recordProcessingFailure({
          organizationId,
          userId,
          shipmentId,
          type: "ingest_failed",
          title: "Document processing failed",
          error,
        });
      },
    },
    async ({ event, step, logger }) => {
      const { organizationId, userId, shipmentId, files, deferClassification } =
        event.data as ShipmentDocumentsUploadedEvent["data"];
      const context = {
        organizationId,
        userId,
        batchId: event.id ?? "unbatched",
        shipmentId,
      };

      logger.info(
        {
          organizationId,
          batchId: context.batchId,
          fileCount: files.length,
          files: files.map((file) => file.fileName),
        },
        "ingestion run started",
      );

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
            logger.info(
              {
                documentId: document.id,
                fileName: document.fileName,
                category: document.category,
                fieldCount: extraction.fields.length,
              },
              "document extracted",
            );
            return { ...document, extraction };
          } catch (error) {
            await step.run(`mark-failed-${document.id}`, () =>
              markExtractionFailed(context, document.id, error),
            );
            logger.warn(
              {
                err: error,
                documentId: document.id,
                fileName: document.fileName,
              },
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
              logger.debug(
                { documentId: document.id, pageCount: preview.pageCount },
                "preview rendered",
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

      logger.info(
        {
          batchId: context.batchId,
          extracted: extracted.length,
          failed: documents.length - extracted.length,
        },
        "extraction phase complete",
      );

      if (extracted.length === 0) {
        logger.warn(
          { batchId: context.batchId, fileCount: files.length },
          "no documents extracted — marking the shipment failed",
        );
        await step.run("mark-ingest-failed", () =>
          recordProcessingFailure({
            organizationId,
            userId,
            shipmentId,
            type: "ingest_failed",
            title:
              "Document processing failed — nothing could be extracted from the uploaded files",
            error: `${documents.length} document(s) failed extraction`,
          }),
        );
        return { shipmentId, extracted: 0, failed: documents.length };
      }

      // Synthesis and line items derive from EVERY extracted document on
      // the shipment, not just this batch — follow-up email batches refine
      // the shipment rather than clobber it. For a first batch the union
      // is the batch, so manual uploads behave exactly as before.
      const allExtracted = await step.run("load-all-extracted", () =>
        loadAllExtractedDocuments(context),
      );

      // 3. Derive the shipment: facts → client → shipment → attach documents.
      const synthesis = await step.run("synthesize-shipment", () =>
        synthesizeShipmentFacts(context, allExtracted),
      );
      logger.info(
        {
          clientName: synthesis.clientName,
          reference: synthesis.reference,
          originCountry: synthesis.originCountry,
          portOfEntry: synthesis.portOfEntry,
          transportMode: synthesis.transportMode,
          valueUsd: synthesis.valueUsd,
        },
        "shipment facts synthesized",
      );

      const client = await step.run("resolve-client", () =>
        resolveClient(context, synthesis),
      );
      logger.info(
        {
          clientId: client.clientId,
          clientName: synthesis.clientName,
          created: client.created,
        },
        client.created
          ? "no matching client — placeholder created"
          : "client matched",
      );

      const shipment = await step.run("update-shipment-from-synthesis", () =>
        updateShipmentFromSynthesis(context, synthesis, client.clientId),
      );
      logger.info(
        { shipmentId: shipment.id, reference: shipment.reference },
        "shipment facts applied",
      );

      // Entry lines from the invoice (or packing list, or one synthetic
      // line) — each linked to the importer's product library.
      const lineItems = await step.run("create-line-items", () =>
        createLineItems(
          context,
          shipment.id,
          allExtracted,
          synthesis,
          Math.round((synthesis.valueUsd ?? 0) * 100),
        ),
      );
      logger.info(
        {
          shipmentId: shipment.id,
          lineCount: lineItems.length,
          lines: lineItems.map((line) => line.description.slice(0, 60)),
        },
        "line items created",
      );

      for (const line of lineItems) {
        const match = await step.run(`match-product-${line.lineNumber}`, () =>
          matchOrCreateProduct(context, client.clientId, line),
        );
        logger.info(
          {
            lineNumber: line.lineNumber,
            productId: match.productId,
            sku: line.sku,
          },
          match.created ? "product created" : "product matched",
        );
      }
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

      logger.debug(
        { shipmentId: shipment.id, documentEvents: extracted.length },
        "timeline events recorded",
      );

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

      logger.info(
        { shipmentId: shipment.id, indexed: extracted.length },
        "documents indexed into the knowledge base",
      );

      // Classification picks up from here as its own run — unless this is
      // an email-sourced batch, where the intake window fires it instead.
      if (deferClassification) {
        await step.run("mark-awaiting-window", () =>
          updateShipment(shipment.id, organizationId, {
            processingState: "Waiting for related emails",
          }),
        );
        logger.info(
          { shipmentId: shipment.id },
          "classification deferred to the email intake window",
        );
      } else {
        await step.sendEvent("request-classification", {
          name: SHIPMENT_CLASSIFY_REQUESTED_EVENT,
          data: { organizationId, userId, shipmentId: shipment.id },
        });
        logger.info(
          { shipmentId: shipment.id },
          "classification run requested",
        );
      }

      // Push any buffered trace spans out before the run completes.
      await langfuseSpanProcessor?.forceFlush();

      logger.info(
        {
          shipmentId: shipment.id,
          batchId: context.batchId,
          extracted: extracted.length,
          failed: documents.length - extracted.length,
          elapsedMs: event.ts ? Date.now() - event.ts : undefined,
        },
        "ingestion run complete",
      );

      return {
        shipmentId: shipment.id,
        extracted: extracted.length,
        failed: documents.length - extracted.length,
      };
    },
  );
};
