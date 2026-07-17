import { listInboundEmails } from "@/db/queries/select/many/listInboundEmails";
import { listShipmentDocuments } from "@/db/queries/select/many/listShipmentDocuments";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { InboundEmailStatus, ShipmentDocumentStatus } from "@/db/schema";
import { recordProcessingFailure } from "@/inngest/lib/recordProcessingFailure";
import { inngest } from "../../client";
import { SHIPMENT_CLASSIFY_REQUESTED_EVENT } from "../classifyShipment";

export const EMAIL_SHIPMENT_INTAKE_OPENED_EVENT =
  "shipment/email-intake.opened" as const;

/** A broker fast-forwards the intake window — all related emails are in. */
export const EMAIL_INTAKE_SKIP_REQUESTED_EVENT =
  "shipment/email-intake.skip-requested" as const;

export type EmailIntakeSkipRequestedEvent = {
  data: {
    organizationId: string;
    userId: string;
    shipmentId: string;
  };
};

export type EmailShipmentIntakeOpenedEvent = {
  data: {
    organizationId: string;
    userId: string;
    shipmentId: string;
    /** ISO instant the intake window closes — first email + window. */
    finalizeAt: string;
  };
};

/** How many one-minute grace waits to give an in-flight follow-up ingest
 * before classifying anyway. */
const GRACE_CHECKS = 5; // minutes

/**
 * Closes an email-sourced shipment's intake window: sleep until 2 hours
 * after the FIRST email, give any follow-up email still mid-ingest a short
 * grace period, then kick off classification. The window is anchored to
 * the first email by design — a steady drip of follow-ups must not stall
 * classification forever.
 */
export const finalizeEmailShipment = () => {
  return inngest.createFunction(
    {
      id: "finalize-email-shipment",
      retries: 2,
      // One finalize per shipment even if the opened-event is redelivered.
      idempotency: "event.data.shipmentId",
      triggers: [{ event: EMAIL_SHIPMENT_INTAKE_OPENED_EVENT }],
      onFailure: async ({ event, error, logger }) => {
        const { organizationId, userId, shipmentId } = event.data.event
          .data as EmailShipmentIntakeOpenedEvent["data"];
        logger.error(
          { shipmentId, err: error },
          "email shipment finalize failed after retries",
        );
        await recordProcessingFailure({
          organizationId,
          userId,
          shipmentId,
          type: "classification_failed",
          title: "Email intake could not be finalized",
          error,
        });
      },
    },
    async ({ event, step, logger }) => {
      const { organizationId, userId, shipmentId, finalizeAt } =
        event.data as EmailShipmentIntakeOpenedEvent["data"];

      logger.info(
        { shipmentId, finalizeAt },
        "email intake window opened — waiting to finalize",
      );

      // Wait out the window OR a broker's skip request, whichever comes
      // first. waitForEvent's timeout is captured on first execution, so
      // the Date.now() here is replay-safe.
      const waitMs = new Date(finalizeAt).getTime() - Date.now();
      if (waitMs > 0) {
        const skip = await step.waitForEvent("wait-intake-window", {
          event: EMAIL_INTAKE_SKIP_REQUESTED_EVENT,
          timeout: `${Math.ceil(waitMs / 1000)}s`,
          match: "data.shipmentId",
        });
        if (skip) {
          logger.info(
            { shipmentId, skippedBy: skip.data.userId },
            "intake window skipped by broker — finalizing now",
          );
        }
      }

      // A follow-up that arrived near the deadline may still be mid-ingest;
      // give it a short grace period instead of classifying half a shipment.
      for (let attempt = 0; attempt < GRACE_CHECKS; attempt++) {
        const pending = await step.run(
          `check-inflight-${attempt}`,
          async () => {
            const { count } = await listInboundEmails({
              organizationId,
              shipmentId,
              status: InboundEmailStatus.Received,
            });
            return count;
          },
        );
        if (pending === 0) break;
        logger.info(
          { shipmentId, pending, attempt },
          "follow-up emails still processing — grace wait",
        );
        await step.sleep(`grace-${attempt}`, "60s");
      }

      const ready = await step.run("check-shipment", async () => {
        const shipment = await selectShipment(shipmentId, organizationId);
        if (!shipment) return false;
        const { data } = await listShipmentDocuments({
          organizationId,
          shipmentId,
          status: ShipmentDocumentStatus.Extracted,
        });
        return data.length > 0;
      });

      if (!ready) {
        logger.warn(
          { shipmentId },
          "intake window closed with nothing extracted — not classifying",
        );
        await step.run("mark-empty", () =>
          recordProcessingFailure({
            organizationId,
            userId,
            shipmentId,
            type: "ingest_failed",
            title:
              "Email intake closed — no documents could be extracted from the received emails",
          }),
        );
        return { shipmentId, classified: false };
      }

      await step.sendEvent("request-classification", {
        name: SHIPMENT_CLASSIFY_REQUESTED_EVENT,
        data: { organizationId, userId, shipmentId },
      });

      logger.info(
        { shipmentId },
        "email intake window closed — classification requested",
      );

      return { shipmentId, classified: true };
    },
  );
};
