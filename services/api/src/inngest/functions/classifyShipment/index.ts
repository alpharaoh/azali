import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { listShipmentDocuments } from "@/db/queries/select/many/listShipmentDocuments";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { updateShipment } from "@/db/queries/update/updateShipment";
import {
  type DocumentExtraction,
  ShipmentDocumentStatus,
  ShipmentStage,
  ShipmentStatus,
} from "@/db/schema";
import { langfuseSpanProcessor } from "@/instrumentation";
import { buildClassificationMemo } from "@/services/agents/classification/memo";
import { ClassificationAgentService } from "@/services/agents/classification/service";
import { inngest } from "../../client";
import { buildReviewPayload } from "./utils";

export const SHIPMENT_CLASSIFY_REQUESTED_EVENT =
  "shipment/classify.requested" as const;

export type ShipmentClassifyRequestedEvent = {
  data: {
    organizationId: string;
    userId: string;
    shipmentId: string;
  };
};

/** Classifications below this confidence go to broker review. */
const REVIEW_THRESHOLD = 0.95;
const REVIEW_DEADLINE_HOURS = 6;

/**
 * Classifies a shipment's goods into a 10-digit HTS code with an audit-ready
 * reasoning chain: GRI-ordered analysis over the live tariff schedule and its
 * binding notes, CROSS precedent, and the importer's own record. Confident
 * results apply automatically; uncertain ones are routed to broker review.
 */
export const classifyShipment = () => {
  return inngest.createFunction(
    {
      id: "classify-shipment",
      retries: 1,
      concurrency: [{ key: "event.data.organizationId", limit: 2 }],
      triggers: [{ event: SHIPMENT_CLASSIFY_REQUESTED_EVENT }],
    },
    async ({ event, step, logger }) => {
      const { organizationId, userId, shipmentId } =
        event.data as ShipmentClassifyRequestedEvent["data"];

      logger.info(
        { shipmentId, organizationId, eventId: event.id },
        "classification run started",
      );

      const shipment = await step.run("load-shipment", async () => {
        const row = await selectShipment(shipmentId, organizationId);
        if (!row) return null;
        return {
          id: row.id,
          reference: row.reference,
          clientName: row.client?.name ?? null,
          originCountry: row.originCountry,
          valueCents: row.valueCents,
          summary: row.summary,
        };
      });
      if (!shipment) {
        logger.warn(
          { shipmentId },
          "shipment not found — skipping classification",
        );
        return { shipmentId, classified: false, reason: "shipment_not_found" };
      }

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
        return {
          shipmentId,
          classified: false,
          reason: "no_extracted_documents",
        };
      }

      logger.info(
        {
          shipmentId,
          reference: shipment.reference,
          clientName: shipment.clientName,
          documentCount: documents.length,
        },
        "dossier assembled — starting agent",
      );

      // The agent loop is a single atomic reasoning unit — one step by design.
      // Its full audit record lands in agent_runs/agent_run_items as it works.
      const { result, runId } = await step.run("classify", () =>
        ClassificationAgentService.classify({
          organizationId,
          userId,
          shipment,
          documents,
        }),
      );

      const needsReview = result.confidence < REVIEW_THRESHOLD;
      const deadlineAt = new Date(
        Date.now() + REVIEW_DEADLINE_HOURS * 3_600_000,
      ).toISOString();

      logger.info(
        {
          shipmentId,
          runId,
          htsCode: result.htsCode,
          confidence: result.confidence,
          alternates: result.alternates.length,
          citations: result.citations.length,
          clarifyingQuestions: result.clarifyingQuestions.length,
          needsReview,
        },
        "agent returned a classification",
      );

      logger.info(
        {
          shipmentId,
          stage: "classification",
          status: needsReview ? "needs_review" : "unchanged",
          reviewDeadlineAt: needsReview ? deadlineAt : null,
        },
        "applying classification to shipment",
      );
      await step.run("apply-classification", async () => {
        await updateShipment(shipmentId, organizationId, {
          stage: ShipmentStage.Classification,
          ...(needsReview
            ? {
                status: ShipmentStatus.NeedsReview,
                reviewType: "classification",
                reviewDeadlineAt: new Date(deadlineAt),
              }
            : {}),
          summary: {
            ...shipment.summary,
            hts: result.htsCode,
            htsConfidence: result.confidence,
            htsDescription: result.description,
            dutyRate: result.dutyRate.effective,
          },
        });
      });

      const base = { organizationId, userId, shipmentId, actor: "ai" as const };
      await Promise.all([
        step.run("record-classification", () =>
          insertShipmentEvent({
            ...base,
            type: "classification_proposed",
            title: `Classified ${result.htsCode} at ${Math.round(result.confidence * 100)}% confidence`,
            payload: {
              value: result.htsCode,
              confidence: result.confidence,
              memo: true,
            },
          }),
        ),
        step.run("record-trace", () =>
          insertShipmentEvent({
            ...base,
            type: "agent_trace",
            title: "Classification research trail",
            // The UI renders the trace from the canonical audit record.
            payload: { runId },
          }),
        ),
        step.run("record-memo", () =>
          insertShipmentEvent({
            ...base,
            type: "classification_memo_drafted",
            title: `Rationale Memo — ${shipment.reference}`,
            payload: {
              kind: "pdf",
              name: `Rationale Memo — ${shipment.reference}`,
              meta: "Azali · classification",
              lines: [
                { label: "Classification", value: result.htsCode },
                { label: "Confidence", value: result.confidence.toFixed(2) },
                { label: "Duty", value: result.dutyRate.effective },
              ],
              draft: buildClassificationMemo(result, shipment),
            },
          }),
        ),
        ...(needsReview
          ? [
              step.run("record-review", () =>
                insertShipmentEvent({
                  ...base,
                  type: "review_requested",
                  title: "Classification needs broker review",
                  payload: buildReviewPayload(result, shipment, deadlineAt),
                }),
              ),
            ]
          : []),
      ]);

      await langfuseSpanProcessor?.forceFlush();

      logger.info(
        {
          shipmentId,
          runId,
          htsCode: result.htsCode,
          confidence: result.confidence,
          needsReview,
          elapsedMs: event.ts ? Date.now() - event.ts : undefined,
        },
        "classification run complete",
      );

      return {
        shipmentId,
        classified: true,
        htsCode: result.htsCode,
        confidence: result.confidence,
        needsReview,
      };
    },
  );
};
