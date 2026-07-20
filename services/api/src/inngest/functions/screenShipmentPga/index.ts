import { insertLineItemPgaDeterminations } from "@/db/queries/insert/insertLineItemPgaDeterminations";
import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { listShipmentDocuments } from "@/db/queries/select/many/listShipmentDocuments";
import { listShipmentLineItems } from "@/db/queries/select/many/listShipmentLineItems";
import { selectProduct } from "@/db/queries/select/one/selectProduct";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { updateShipment } from "@/db/queries/update/updateShipment";
import {
  type DocumentExtraction,
  PgaDeterminationKind,
  PgaDeterminationStatus,
  PgaFlagSource,
  ShipmentDocumentStatus,
  ShipmentStage,
  ShipmentStatus,
} from "@/db/schema";
import { recordProcessingFailure } from "@/inngest/lib/recordProcessingFailure";
import { langfuseSpanProcessor } from "@/instrumentation";
import {
  type PgaFlagLookupSnapshot,
  PgaAgentService,
} from "@/services/agents/pga/service";
import { lookupPgaFlags } from "@/services/pga/flagLookup";
import { inngest } from "../../client";
import {
  buildPgaReviewPayload,
  buildPgaSummary,
  describeLineScreening,
  type PgaLineOutcome,
  type PgaLineSlim,
  triageUnflaggedLine,
} from "./utils";

export const SHIPMENT_PGA_SCREEN_REQUESTED_EVENT =
  "shipment/pga-screen.requested" as const;

export type ShipmentPgaScreenRequestedEvent = {
  data: {
    organizationId: string;
    userId: string;
    shipmentId: string;
  };
};

/** Determinations below this confidence go to broker review — the same
 * threshold classification uses, so one calibration language governs. */
const REVIEW_THRESHOLD = 0.95;
const REVIEW_DEADLINE_HOURS = 6;
/** Simultaneous per-line agent runs within one shipment. */
const LINE_CONCURRENCY = 3;

/**
 * PGA screening — the compliance stage. For each CLASSIFIED line: a
 * deterministic lookup against the versioned ACE flag table decides which
 * agencies are flagged, then the screening agent decides per agency whether
 * data must be filed, is formally disclaimed, or does not apply — from THIS
 * shipment's origin, intended use, and documents. PGA is per-shipment by
 * nature (unlike classification, which is per-product and reusable): a
 * reused classification still gets a fresh screening here.
 */
export const screenShipmentPga = () => {
  return inngest.createFunction(
    {
      id: "screen-shipment-pga",
      retries: 1,
      concurrency: [{ key: "event.data.organizationId", limit: 2 }],
      triggers: [{ event: SHIPMENT_PGA_SCREEN_REQUESTED_EVENT }],
      onFailure: async ({ event, error, logger }) => {
        const { organizationId, userId, shipmentId } = event.data.event
          .data as ShipmentPgaScreenRequestedEvent["data"];
        logger.error(
          { shipmentId, err: error },
          "pga screening failed after retries — clearing processing state",
        );
        await recordProcessingFailure({
          organizationId,
          userId,
          shipmentId,
          type: "pga_screening_failed",
          title: "PGA screening failed",
          error,
        });
      },
    },
    async ({ event, step, logger }) => {
      const { organizationId, userId, shipmentId } =
        event.data as ShipmentPgaScreenRequestedEvent["data"];

      logger.info(
        { shipmentId, organizationId, eventId: event.id },
        "pga screening run started",
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
        logger.warn({ shipmentId }, "shipment not found — skipping screening");
        return { shipmentId, screened: false, reason: "shipment_not_found" };
      }
      if (loaded.clientId === null) {
        logger.warn(
          { shipmentId },
          "shipment has no client — skipping screening",
        );
        await step.run("clear-state-no-client", () =>
          recordProcessingFailure({
            organizationId,
            userId,
            shipmentId,
            type: "pga_screening_failed",
            title: "PGA screening could not run — no importer was resolved",
          }),
        );
        return { shipmentId, screened: false, reason: "no_client" };
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

      // Only classified lines can be screened — screening keys off the HTS
      // code. Unclassified stragglers are warned about, never fatal.
      const lines = await step.run(
        "load-line-items",
        async (): Promise<PgaLineSlim[]> => {
          const { data } = await listShipmentLineItems({
            organizationId,
            shipmentId,
          });
          const unclassified = data.filter((row) => !row.htsCode);
          if (unclassified.length > 0) {
            await insertShipmentEvent({
              organizationId,
              userId,
              shipmentId,
              type: "pga_screening_skipped",
              actor: "system",
              title: `${unclassified.length} unclassified line${unclassified.length === 1 ? "" : "s"} skipped by PGA screening`,
              payload: {
                lineNumbers: unclassified.map((row) => row.lineNumber),
              },
            });
          }
          return data
            .filter(
              (row): row is typeof row & { htsCode: string } =>
                row.htsCode !== null,
            )
            .map((row) => ({
              id: row.id,
              lineNumber: row.lineNumber,
              description: row.description,
              sku: row.sku,
              quantity: row.quantity,
              unit: row.unit,
              totalValueCents: row.totalValueCents,
              originCountry: row.originCountry,
              htsCode: row.htsCode,
              htsDescription: row.htsDescription,
              classificationSummary: row.summary,
              productId: row.productId,
            }));
        },
      );
      if (lines.length === 0) {
        logger.warn(
          { shipmentId },
          "no classified lines — skipping pga screening",
        );
        await step.run("clear-state-no-lines", () =>
          recordProcessingFailure({
            organizationId,
            userId,
            shipmentId,
            type: "pga_screening_failed",
            title: "PGA screening could not run — no classified line items",
          }),
        );
        return { shipmentId, screened: false, reason: "no_classified_lines" };
      }

      const base = { organizationId, userId, shipmentId, actor: "ai" as const };

      await step.run("state-screening", () =>
        updateShipment(shipmentId, organizationId, {
          stage: ShipmentStage.Compliance,
          processingState:
            lines.length === 1
              ? "Screening 1 line for agency requirements"
              : `Screening ${lines.length} lines for agency requirements`,
        }),
      );

      /** The flag-table version cited by this run — set by the first lookup. */
      let flagVersion: PgaFlagLookupSnapshot["version"] | null = null;

      /** One line's full pipeline: lookup, triage-or-screen, apply, record.
       * Steps WITHIN a line stay ordered; lines run concurrently. */
      const screenLine = async (line: PgaLineSlim): Promise<PgaLineOutcome> => {
        // 1. Deterministic flag lookup — code, never the model.
        const lookup = await step.run(
          `flags-${line.lineNumber}`,
          async (): Promise<PgaFlagLookupSnapshot> => {
            const result = await lookupPgaFlags(line.htsCode);
            return {
              version: {
                id: result.version.id,
                pubNumber: result.version.pubNumber,
                publishedAt: result.version.publishedAt.toISOString(),
                source: result.version.source,
              },
              flags: result.flags,
            };
          },
        );
        flagVersion ??= lookup.version;

        // 2. Unflagged lines get a cheap jurisdiction triage instead of a
        //    full agent run — flags are a prior, not ground truth, but a box
        //    of screwdrivers shouldn't pay for a research loop.
        let triageNote: string | null = null;
        if (lookup.flags.length === 0) {
          const triage = await step.run(`triage-${line.lineNumber}`, () =>
            triageUnflaggedLine(line, shipment, documents),
          );
          if (triage.clean) {
            await step.run(`record-clean-${line.lineNumber}`, () =>
              insertShipmentEvent({
                ...base,
                type: "pga_screened",
                title: `Line ${line.lineNumber}: no PGA requirements — clean jurisdiction screen`,
                payload: {
                  lineNumber: line.lineNumber,
                  agencies: [],
                  triage: triage.rationale,
                  flagVersion: lookup.version.pubNumber,
                },
              }),
            );
            logger.info(
              { shipmentId, lineNumber: line.lineNumber },
              "line triaged clean — no flags, no plausible jurisdiction",
            );
            return {
              lineItemId: line.id,
              lineNumber: line.lineNumber,
              description: line.description,
              htsCode: line.htsCode,
              determinations: [],
              clarifyingQuestions: [],
              jurisdictionSweep: triage.rationale,
              summary: null,
              runId: null,
              triagedClean: true,
            };
          }
          triageNote = `No flags fired, but a jurisdiction triage flagged plausible agency scope — investigate these specifically: ${triage.plausibleAgencies
            .map((suspicion) => `${suspicion.agency} (${suspicion.reason})`)
            .join("; ")}`;
        }

        // 3. Product attributes accumulated at ingest feed the dossier.
        const productAttributes = await step.run(
          `attributes-${line.lineNumber}`,
          async () => {
            if (!line.productId) return null;
            const product = await selectProduct(line.productId, organizationId);
            return (product?.attributes ?? null) as Record<
              string,
              unknown
            > | null;
          },
        );

        // 4. The screening agent — one atomic step by design; the audit
        //    record fills in live as it works.
        const { result, runId } = await step.run(
          `screen-line-${line.lineNumber}`,
          () =>
            PgaAgentService.screen({
              organizationId,
              userId,
              shipment,
              lineItem: {
                id: line.id,
                lineNumber: line.lineNumber,
                description: line.description,
                sku: line.sku,
                quantity: line.quantity,
                unit: line.unit,
                totalValueCents: line.totalValueCents,
                originCountry: line.originCountry,
                htsCode: line.htsCode,
                htsDescription: line.htsDescription,
                classificationSummary: line.classificationSummary,
                productAttributes,
              },
              documents,
              flagLookup: lookup,
              triageNote,
            }),
        );

        // 5. Persist determinations — one row per agency call.
        const determinationIds = await step.run(
          `apply-pga-${line.lineNumber}`,
          async () => {
            const rows = await insertLineItemPgaDeterminations(
              result.determinations.map((determination) => ({
                organizationId,
                userId,
                shipmentId,
                lineItemId: line.id,
                agencyCode: determination.agencyCode,
                agencyName: determination.agencyName,
                programCode: determination.programCode,
                flagCode: determination.flagCode,
                flagSource:
                  determination.flagSource === "flag_table"
                    ? PgaFlagSource.FlagTable
                    : PgaFlagSource.JurisdictionalAnalysis,
                requirement: determination.requirement,
                determination:
                  determination.determination === "required"
                    ? PgaDeterminationKind.Required
                    : determination.determination === "disclaim"
                      ? PgaDeterminationKind.Disclaim
                      : PgaDeterminationKind.NotApplicable,
                disclaimCode: determination.disclaimCode,
                rationale: determination.rationale,
                dataElements: determination.dataElements,
                citations: determination.citations,
                confidence: determination.confidence,
                screeningRunId: runId,
                flagVersionId: lookup.version.id,
                status: PgaDeterminationStatus.Proposed,
              })),
            );
            return rows.map((row) => row.id);
          },
        );

        await Promise.all([
          step.run(`record-screened-${line.lineNumber}`, () =>
            insertShipmentEvent({
              ...base,
              type: "pga_screened",
              title: `Line ${line.lineNumber}: ${describeLineScreening(result)}`,
              payload: {
                lineNumber: line.lineNumber,
                agencies: result.determinations.map((determination) => ({
                  agencyCode: determination.agencyCode,
                  flagCode: determination.flagCode,
                  determination: determination.determination,
                  disclaimCode: determination.disclaimCode,
                  confidence: determination.confidence,
                })),
                runId,
                flagVersion: lookup.version.pubNumber,
              },
            }),
          ),
          step.run(`record-trace-${line.lineNumber}`, () =>
            insertShipmentEvent({
              ...base,
              type: "agent_trace",
              title: `PGA screening research trail — line ${line.lineNumber}`,
              payload: { runId, lineNumber: line.lineNumber },
            }),
          ),
        ]);

        logger.info(
          {
            shipmentId,
            lineNumber: line.lineNumber,
            runId,
            determinations: result.determinations.map(
              (determination) =>
                `${determination.agencyCode}:${determination.determination}`,
            ),
          },
          "line screened",
        );

        return {
          lineItemId: line.id,
          lineNumber: line.lineNumber,
          description: line.description,
          htsCode: line.htsCode,
          determinations: result.determinations.map((determination, index) => ({
            ...determination,
            determinationId: determinationIds[index] ?? null,
          })),
          clarifyingQuestions: result.clarifyingQuestions,
          jurisdictionSweep: result.jurisdictionSweep,
          summary: result.summary,
          runId,
          triagedClean: false,
        };
      };

      // Lines screen CONCURRENTLY — same worker-pool pattern as
      // classification; unique step ids keep Inngest replays deterministic.
      const queue = [...lines];
      const settled: PgaLineOutcome[] = [];
      await Promise.all(
        Array.from(
          { length: Math.min(LINE_CONCURRENCY, queue.length) },
          async () => {
            for (;;) {
              const line = queue.shift();
              if (!line) return;
              settled.push(await screenLine(line));
            }
          },
        ),
      );
      const outcomes = settled.sort((a, b) => a.lineNumber - b.lineNumber);

      // Review routing: hard rules first (required with missing data, open
      // questions), then the shared confidence threshold. High-confidence
      // disclaims ride autopilot — recorded, cited, and on the timeline.
      const determinations = outcomes.flatMap(
        (outcome) => outcome.determinations,
      );
      const missingData = determinations.some(
        (determination) =>
          determination.determination === "required" &&
          determination.dataElements.some((element) => !element.present),
      );
      const openQuestions = outcomes.some(
        (outcome) => outcome.clarifyingQuestions.length > 0,
      );
      const lowConfidence = determinations.some(
        (determination) => determination.confidence < REVIEW_THRESHOLD,
      );
      const needsReview = missingData || openQuestions || lowConfidence;
      const deadlineAt = new Date(
        Date.now() + REVIEW_DEADLINE_HOURS * 3_600_000,
      ).toISOString();

      logger.info(
        {
          shipmentId,
          lineCount: outcomes.length,
          triagedClean: outcomes.filter((outcome) => outcome.triagedClean)
            .length,
          determinations: determinations.length,
          missingData,
          openQuestions,
          lowConfidence,
          needsReview,
        },
        "applying pga screening to shipment",
      );

      await step.run("apply-screening", () =>
        updateShipment(shipmentId, organizationId, {
          stage: ShipmentStage.Compliance,
          processingState: null,
          ...(needsReview
            ? {
                status: ShipmentStatus.NeedsReview,
                reviewType: "pga",
                reviewDeadlineAt: new Date(deadlineAt),
              }
            : {}),
          summary: {
            ...shipment.summary,
            pga: buildPgaSummary(outcomes),
          },
        }),
      );

      if (needsReview && flagVersion) {
        const version = flagVersion;
        await step.run("record-review", () =>
          insertShipmentEvent({
            ...base,
            type: "review_requested",
            title: "PGA screening needs broker review",
            payload: buildPgaReviewPayload(
              outcomes,
              shipment,
              {
                pubNumber: version.pubNumber,
                publishedAt: version.publishedAt,
              },
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
          determinations: determinations.length,
          needsReview,
          elapsedMs: event.ts ? Date.now() - event.ts : undefined,
        },
        "pga screening run complete",
      );

      return {
        shipmentId,
        screened: true,
        lineCount: outcomes.length,
        determinations: determinations.length,
        needsReview,
      };
    },
  );
};
