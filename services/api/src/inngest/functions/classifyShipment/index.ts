import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { insertShipmentLineItems } from "@/db/queries/insert/insertShipmentLineItems";
import { listShipmentDocuments } from "@/db/queries/select/many/listShipmentDocuments";
import { listShipmentLineItems } from "@/db/queries/select/many/listShipmentLineItems";
import { selectProduct } from "@/db/queries/select/one/selectProduct";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { incrementProductReuse } from "@/db/queries/update/incrementProductReuse";
import { updateProduct } from "@/db/queries/update/updateProduct";
import { updateShipment } from "@/db/queries/update/updateShipment";
import { updateShipmentLineItem } from "@/db/queries/update/updateShipmentLineItem";
import {
  type DocumentExtraction,
  LineItemStatus,
  ShipmentDocumentStatus,
  ShipmentStage,
  ShipmentStatus,
} from "@/db/schema";
import { recordProcessingFailure } from "@/inngest/lib/recordProcessingFailure";
import { langfuseSpanProcessor } from "@/instrumentation";
import { buildClassificationMemo } from "@/services/agents/classification/memo";
import { ClassificationAgentService } from "@/services/agents/classification/service";
import { indexProductClassification } from "@/services/external/pinecone/classificationRecord";
import { inngest } from "../../client";
import { matchOrCreateProduct } from "../ingestShipmentDocuments/utils";
import {
  buildLineAlternates,
  buildReviewPayload,
  type LineOutcome,
  type LineSlim,
} from "./utils";

export const SHIPMENT_CLASSIFY_REQUESTED_EVENT =
  "shipment/classify.requested" as const;

export type ShipmentClassifyRequestedEvent = {
  data: {
    organizationId: string;
    userId: string;
    shipmentId: string;
  };
};

/** Lines below this confidence go to broker review. */
const REVIEW_THRESHOLD = 0.95;
const REVIEW_DEADLINE_HOURS = 6;
/** Simultaneous per-line agent runs within one shipment. */
const LINE_CONCURRENCY = 3;

/**
 * Classifies each of a shipment's line items into its 10-digit HTS code with
 * an audit-ready reasoning chain. The PRODUCT is the unit of classification:
 * lines whose product already carries a trusted classification reuse it
 * without an agent run; fresh classifications update the product library.
 * Uncertain lines route the shipment to broker review.
 */
export const classifyShipment = () => {
  return inngest.createFunction(
    {
      id: "classify-shipment",
      retries: 1,
      concurrency: [{ key: "event.data.organizationId", limit: 2 }],
      triggers: [{ event: SHIPMENT_CLASSIFY_REQUESTED_EVENT }],
      // Retries exhausted — stop showing the shipment as processing and
      // land the failure on its timeline.
      onFailure: async ({ event, error, logger }) => {
        const { organizationId, userId, shipmentId } = event.data.event
          .data as ShipmentClassifyRequestedEvent["data"];
        logger.error(
          { shipmentId, err: error },
          "classification failed after retries — clearing processing state",
        );
        await recordProcessingFailure({
          organizationId,
          userId,
          shipmentId,
          type: "classification_failed",
          title: "Classification failed",
          error,
        });
      },
    },
    async ({ event, step, logger }) => {
      const { organizationId, userId, shipmentId } =
        event.data as ShipmentClassifyRequestedEvent["data"];

      logger.info(
        { shipmentId, organizationId, eventId: event.id },
        "classification run started",
      );

      const loaded = await step.run("load-shipment", async () => {
        const row = await selectShipment(shipmentId, organizationId);
        if (!row) return null;
        return {
          id: row.id,
          reference: row.reference,
          clientId: row.clientId,
          clientName: row.client?.name ?? null,
          originCountry: row.originCountry,
          valueCents: row.valueCents,
          summary: row.summary,
        };
      });
      if (!loaded) {
        logger.warn(
          { shipmentId },
          "shipment not found — skipping classification",
        );
        return { shipmentId, classified: false, reason: "shipment_not_found" };
      }
      // A pre-created shipment whose ingest never resolved a client cannot
      // be classified — the knowledge base and product library are
      // client-scoped.
      if (loaded.clientId === null) {
        logger.warn(
          { shipmentId },
          "shipment has no client — skipping classification",
        );
        await step.run("clear-state-no-client", () =>
          recordProcessingFailure({
            organizationId,
            userId,
            shipmentId,
            type: "classification_failed",
            title: "Classification could not run — no importer was resolved",
          }),
        );
        return { shipmentId, classified: false, reason: "no_client" };
      }
      const shipment = { ...loaded, clientId: loaded.clientId };

      const documents = await step.run("load-documents", async () => {
        const { data } = await listShipmentDocuments({
          organizationId,
          shipmentId,
          status: ShipmentDocumentStatus.Extracted,
        });
        return data.map((document) => ({
          fileName: document.fileName,
          category: document.category,
          extraction: document.extraction as unknown as DocumentExtraction,
        }));
      });
      if (documents.length === 0) {
        logger.warn(
          { shipmentId },
          "no extracted documents — skipping classification",
        );
        await step.run("clear-state-no-documents", () =>
          recordProcessingFailure({
            organizationId,
            userId,
            shipmentId,
            type: "classification_failed",
            title:
              "Classification could not run — no extracted documents on file",
          }),
        );
        return {
          shipmentId,
          classified: false,
          reason: "no_extracted_documents",
        };
      }

      // Every shipment flows the same per-line path — legacy shipments
      // without lines get one synthetic line linked to a product.
      const lines = await step.run(
        "load-line-items",
        async (): Promise<LineSlim[]> => {
          const { data } = await listShipmentLineItems({
            organizationId,
            shipmentId,
          });
          const toSlim = (row: (typeof data)[number]): LineSlim => ({
            id: row.id,
            lineNumber: row.lineNumber,
            description: row.description,
            sku: row.sku,
            quantity: row.quantity,
            unit: row.unit,
            totalValueCents: row.totalValueCents,
            originCountry: row.originCountry,
            declaredHts: row.declaredHts,
            productId: row.productId,
          });
          if (data.length > 0) return data.map(toSlim);

          const description = (
            (shipment.summary as { description?: string }).description ??
            shipment.reference
          ).slice(0, 300);
          const [row] = await insertShipmentLineItems([
            {
              organizationId,
              userId,
              shipmentId,
              lineNumber: 1,
              description,
              totalValueCents: shipment.valueCents,
              originCountry: shipment.originCountry,
              status: LineItemStatus.Pending,
            },
          ]);
          const match = await matchOrCreateProduct(
            {
              organizationId,
              userId,
              batchId: event.id ?? "classify",
              shipmentId,
            },
            shipment.clientId,
            {
              id: row.id,
              lineNumber: row.lineNumber,
              description: row.description,
              sku: null,
              quantity: null,
              unit: null,
              totalValueCents: row.totalValueCents,
              originCountry: row.originCountry,
              declaredHts: null,
            },
          );
          return [toSlim({ ...row, productId: match.productId })];
        },
      );

      logger.info(
        {
          shipmentId,
          reference: shipment.reference,
          lineCount: lines.length,
          documentCount: documents.length,
        },
        "dossier assembled — classifying per line",
      );

      const base = { organizationId, userId, shipmentId, actor: "ai" as const };

      await step.run("state-classifying", () =>
        updateShipment(shipmentId, organizationId, {
          processingState:
            lines.length === 1
              ? "Classifying 1 line item"
              : `Classifying ${lines.length} line items`,
        }),
      );

      /** One line's full pipeline: reuse-or-classify, apply, record. The
       * steps WITHIN a line stay ordered; lines run concurrently. */
      const classifyLine = async (line: LineSlim): Promise<LineOutcome> => {
        // 1. Product memory — a trusted existing classification is reused
        //    without an agent run.
        const reuse = await step.run(`reuse-${line.lineNumber}`, async () => {
          if (!line.productId) return null;
          const product = await selectProduct(line.productId, organizationId);
          if (!product?.htsCode) return null;
          const trusted =
            product.source === "broker" ||
            (product.confidence ?? 0) >= REVIEW_THRESHOLD;
          if (!trusted) return null;

          await updateShipmentLineItem(line.id, organizationId, {
            htsCode: product.htsCode,
            htsDescription: product.htsDescription,
            confidence: product.confidence,
            dutyRate: product.dutyRate,
            classificationRunId: product.classificationRunId,
            reusedFromProduct: true,
            status:
              product.source === "broker"
                ? LineItemStatus.Approved
                : LineItemStatus.Classified,
          });
          await incrementProductReuse(product.id, organizationId);
          return {
            htsCode: product.htsCode,
            htsDescription: product.htsDescription,
            confidence: product.confidence ?? 1,
            dutyRate: product.dutyRate as {
              effective?: string;
              effectivePct?: number | null;
            } | null,
            runId: product.classificationRunId,
            source: product.source,
          };
        });

        if (reuse) {
          await step.run(`record-reuse-${line.lineNumber}`, () =>
            insertShipmentEvent({
              ...base,
              type: "classification_reused",
              title: `Line ${line.lineNumber}: ${reuse.htsCode} reused from product memory`,
              payload: {
                lineNumber: line.lineNumber,
                value: reuse.htsCode,
                confidence: reuse.confidence,
                source: reuse.source,
                runId: reuse.runId,
              },
            }),
          );
          logger.info(
            {
              shipmentId,
              lineNumber: line.lineNumber,
              htsCode: reuse.htsCode,
              source: reuse.source,
            },
            "line classification reused from product memory",
          );
          return {
            lineItemId: line.id,
            lineNumber: line.lineNumber,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            valueCents: line.totalValueCents,
            htsCode: reuse.htsCode,
            htsDescription: reuse.htsDescription,
            confidence: reuse.confidence,
            effectivePct: reuse.dutyRate?.effectivePct ?? null,
            effective: reuse.dutyRate?.effective ?? null,
            reused: true,
            status:
              reuse.source === "broker"
                ? LineItemStatus.Approved
                : LineItemStatus.Classified,
            runId: reuse.runId,
            result: null,
          };
        }

        // 2. Fresh agent run for this product. One atomic step by design —
        //    the audit record fills in live as it works.
        const { result, runId } = await step.run(
          `classify-line-${line.lineNumber}`,
          () =>
            ClassificationAgentService.classify({
              organizationId,
              userId,
              shipment,
              lineItem: line,
              documents,
            }),
        );

        const flagged = result.confidence < REVIEW_THRESHOLD;
        await step.run(`apply-line-${line.lineNumber}`, async () => {
          const snapshot = {
            htsCode: result.htsCode,
            htsDescription: result.description,
            confidence: result.confidence,
            dutyRate: {
              general: result.dutyRate.general,
              effective: result.dutyRate.effective,
              effectivePct: result.dutyRate.effectivePct,
            },
            classificationRunId: runId,
          };
          await updateShipmentLineItem(line.id, organizationId, {
            ...snapshot,
            summary: result.summary,
            alternates: buildLineAlternates(result, line.totalValueCents),
            reusedFromProduct: false,
            status: flagged
              ? LineItemStatus.NeedsReview
              : LineItemStatus.Classified,
          });
          // The product snapshot updates now, but the verdict is NOT yet
          // indexed as knowledge-base precedent — that happens only when
          // the shipment clears review (autopilot below, or broker
          // approval in resolveReview).
          if (line.productId) {
            await updateProduct(line.productId, organizationId, {
              ...snapshot,
              classifiedAt: new Date(),
              source: "agent",
            });
          }
        });

        await Promise.all([
          step.run(`record-line-${line.lineNumber}`, () =>
            insertShipmentEvent({
              ...base,
              type: "classification_proposed",
              title: `Line ${line.lineNumber}: ${result.htsCode} at ${Math.round(result.confidence * 100)}% confidence`,
              payload: {
                lineNumber: line.lineNumber,
                value: result.htsCode,
                confidence: result.confidence,
                memo: true,
              },
            }),
          ),
          step.run(`record-memo-${line.lineNumber}`, () =>
            insertShipmentEvent({
              ...base,
              type: "classification_memo_drafted",
              title: `Rationale Memo — Line ${line.lineNumber}`,
              payload: {
                kind: "pdf",
                name: `Rationale Memo — Line ${line.lineNumber} · ${line.description.slice(0, 50)}`,
                meta: "Azali · classification",
                lines: [
                  { label: "Line", value: `#${line.lineNumber}` },
                  { label: "Classification", value: result.htsCode },
                  { label: "Confidence", value: result.confidence.toFixed(2) },
                  { label: "Duty", value: result.dutyRate.effective },
                ],
                draft: buildClassificationMemo(result, shipment),
              },
            }),
          ),
          step.run(`record-trace-${line.lineNumber}`, () =>
            insertShipmentEvent({
              ...base,
              type: "agent_trace",
              title: `Classification research trail — line ${line.lineNumber}`,
              payload: { runId, lineNumber: line.lineNumber },
            }),
          ),
        ]);

        logger.info(
          {
            shipmentId,
            lineNumber: line.lineNumber,
            runId,
            htsCode: result.htsCode,
            confidence: result.confidence,
            flagged,
          },
          "line classified",
        );

        return {
          lineItemId: line.id,
          lineNumber: line.lineNumber,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          valueCents: line.totalValueCents,
          htsCode: result.htsCode,
          htsDescription: result.description,
          confidence: result.confidence,
          effectivePct: result.dutyRate.effectivePct,
          effective: result.dutyRate.effective,
          reused: false,
          status: flagged
            ? LineItemStatus.NeedsReview
            : LineItemStatus.Classified,
          runId,
          result,
        };
      };

      // Lines classify CONCURRENTLY — a small worker pool caps simultaneous
      // agent runs so a many-line invoice doesn't slam the model API, while
      // 2-5 line shipments run fully parallel. Step ids are unique per line,
      // so Inngest replays stay deterministic regardless of interleaving.
      const queue = [...lines];
      const settled: LineOutcome[] = [];
      await Promise.all(
        Array.from(
          { length: Math.min(LINE_CONCURRENCY, queue.length) },
          async () => {
            for (;;) {
              const line = queue.shift();
              if (!line) return;
              settled.push(await classifyLine(line));
            }
          },
        ),
      );
      const outcomes = settled.sort((a, b) => a.lineNumber - b.lineNumber);

      // Aggregate — the lowest-confidence uncertain line headlines review.
      const flaggedLines = outcomes
        .filter(
          (outcome) => !outcome.reused && outcome.confidence < REVIEW_THRESHOLD,
        )
        .sort((a, b) => a.confidence - b.confidence);
      const headline = flaggedLines[0] ?? null;
      const needsReview = headline !== null;
      const deadlineAt = new Date(
        Date.now() + REVIEW_DEADLINE_HOURS * 3_600_000,
      ).toISOString();

      const dutyCents = outcomes.reduce((sum, outcome) => {
        if (outcome.effectivePct === null || outcome.valueCents === null) {
          return sum;
        }
        return (
          sum + Math.round((outcome.valueCents * outcome.effectivePct) / 100)
        );
      }, 0);

      logger.info(
        {
          shipmentId,
          lineCount: outcomes.length,
          reused: outcomes.filter((outcome) => outcome.reused).length,
          flagged: flaggedLines.length,
          dutyCents,
          needsReview,
        },
        "applying line classifications to shipment",
      );

      await step.run("apply-classification", async () => {
        const primary = headline ?? outcomes[0];
        await updateShipment(shipmentId, organizationId, {
          stage: ShipmentStage.Classification,
          dutyCents,
          processingState: null,
          ...(needsReview
            ? {
                status: ShipmentStatus.NeedsReview,
                reviewType: "classification",
                reviewDeadlineAt: new Date(deadlineAt),
              }
            : {}),
          summary: {
            ...shipment.summary,
            hts: primary?.htsCode,
            htsConfidence: primary?.confidence,
            htsDescription: primary?.htsDescription,
            dutyRate: primary?.effective,
            lineCount: outcomes.length,
            flaggedCount: flaggedLines.length,
          },
        });
      });

      // Fresh verdicts become searchable knowledge-base precedent ONLY once
      // the shipment moves on without human review — autopilot's approval.
      // Flagged shipments index nothing here; broker approval or correction
      // (resolveReview) is what publishes their lines to the knowledge base.
      if (!needsReview) {
        await step.run("index-approved-classifications", async () => {
          const productIds = new Set(
            outcomes
              .filter((outcome) => !outcome.reused)
              .map(
                (outcome) =>
                  lines.find((line) => line.id === outcome.lineItemId)
                    ?.productId,
              )
              .filter((id): id is string => id !== null && id !== undefined),
          );
          for (const productId of productIds) {
            const product = await selectProduct(productId, organizationId);
            await indexProductClassification(product);
          }
          return { indexed: productIds.size };
        });
      }

      if (headline?.result) {
        // Capture the narrowed result before the step closure — narrowing on
        // `headline.result` doesn't survive into the callback.
        const reviewHeadline = { ...headline, result: headline.result };
        await step.run("record-review", () =>
          insertShipmentEvent({
            ...base,
            type: "review_requested",
            title: `Line ${reviewHeadline.lineNumber} classification needs broker review`,
            payload: buildReviewPayload(
              reviewHeadline,
              outcomes,
              shipment,
              deadlineAt,
            ),
          }),
        );
      }

      await langfuseSpanProcessor?.forceFlush();

      logger.info(
        {
          shipmentId,
          lineCount: outcomes.length,
          reused: outcomes.filter((outcome) => outcome.reused).length,
          flagged: flaggedLines.length,
          needsReview,
          elapsedMs: event.ts ? Date.now() - event.ts : undefined,
        },
        "classification run complete",
      );

      return {
        shipmentId,
        classified: true,
        lineCount: outcomes.length,
        reused: outcomes.filter((outcome) => outcome.reused).length,
        flagged: flaggedLines.length,
        needsReview,
      };
    },
  );
};
