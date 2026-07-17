import { randomUUID } from "node:crypto";
import { insertInboundEmail } from "@/db/queries/insert/insertInboundEmail";
import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { listInboundEmails } from "@/db/queries/select/many/listInboundEmails";
import { selectOrganization } from "@/db/queries/select/one/selectOrganization";
import { updateInboundEmail } from "@/db/queries/update/updateInboundEmail";
import { InboundEmailStatus, ShipmentSource } from "@/db/schema";
import { env } from "@/env";
import { recordProcessingFailure } from "@/inngest/lib/recordProcessingFailure";
import { langfuseSpanProcessor } from "@/instrumentation";
import { BlobStorageService } from "@/services/external/s3/service";
import type {
  NewEmailWebhook,
  UnipileAttachment,
} from "@/services/external/unipile/schema";
import { unipileAttachmentSchema } from "@/services/external/unipile/schema";
import { UnipileService } from "@/services/external/unipile/service";
import { extractInvoiceId } from "@/services/extraction/invoiceId";
import { inngest } from "../../client";
import { EMAIL_SHIPMENT_INTAKE_OPENED_EVENT } from "../finalizeEmailShipment";
import { SHIPMENT_DOCUMENTS_UPLOADED_EVENT } from "../ingestShipmentDocuments";
import { createPlaceholderShipment } from "../ingestShipmentDocuments/utils";
import {
  attachmentContentType,
  categoryFromFileName,
  findOpenEmailShipment,
  isDocumentAttachment,
  MAX_ATTACHMENT_BYTES,
  safeFileName,
} from "./utils";

export const INBOUND_EMAIL_RECEIVED_EVENT = "email/inbound.received" as const;

/** Stored body cap — enough for any real correspondence, bounds bloat. */
const MAX_BODY_CHARS = 100_000;

export type InboundEmailReceivedEvent = {
  data: {
    organizationId: string;
    /** The member who connected the inbox — the actor for everything the
     * email produces. */
    userId: string;
    emailAccountId: string;
    email: NewEmailWebhook;
  };
};

/**
 * Turns one received email into shipment documents: store the email
 * (deduplicated on redelivery), upload its document attachments to S3,
 * extract the invoice number it concerns, attribute it to an open
 * email-sourced shipment or open a new one with a fresh intake window,
 * and hand the documents to the regular ingest pipeline with
 * classification deferred to the window's close.
 */
export const processInboundEmail = () => {
  return inngest.createFunction(
    {
      id: "process-inbound-email",
      retries: 2,
      concurrency: [{ key: "event.data.organizationId", limit: 2 }],
      triggers: [{ event: INBOUND_EMAIL_RECEIVED_EVENT }],
      onFailure: async ({ event, error, logger }) => {
        const { organizationId, userId, emailAccountId, email } = event.data
          .event.data as InboundEmailReceivedEvent["data"];
        logger.error(
          { emailId: email.email_id, err: error },
          "inbound email processing failed after retries",
        );
        const {
          data: [row],
        } = await listInboundEmails({
          emailAccountId,
          unipileEmailId: email.email_id,
        });
        if (!row) return;
        await updateInboundEmail(row.id, organizationId, {
          status: InboundEmailStatus.Failed,
        });
        if (row.shipmentId) {
          await recordProcessingFailure({
            organizationId,
            userId,
            shipmentId: row.shipmentId,
            type: "ingest_failed",
            title: "An emailed document could not be processed",
            error,
          });
        }
      },
    },
    async ({ event, step, logger }) => {
      const { organizationId, userId, emailAccountId, email } =
        event.data as InboundEmailReceivedEvent["data"];
      const receivedAt = new Date(email.date);
      const fromAddress = email.from_attendee.identifier.toLowerCase();

      logger.info(
        {
          organizationId,
          emailAccountId,
          emailId: email.email_id,
          from: fromAddress,
          subject: email.subject,
        },
        "inbound email received",
      );

      // 1. Store the email. The unique (account, email) index makes this
      //    the authoritative dedup: a redelivered webhook inserts nothing.
      const inbound = await step.run("dedup-insert-email", () =>
        insertInboundEmail({
          organizationId,
          userId,
          emailAccountId,
          unipileEmailId: email.email_id,
          messageId: email.message_id ?? null,
          inReplyToMessageId: email.in_reply_to?.message_id ?? null,
          fromAddress,
          subject: email.subject ?? null,
          bodyPlain: email.body_plain?.slice(0, MAX_BODY_CHARS) || null,
          bodyHtml: email.body?.slice(0, MAX_BODY_CHARS) || null,
          receivedAt,
          attachmentCount: email.attachments.length,
          payload: {
            to: email.to_attendees.map((attendee) => attendee.identifier),
            cc: email.cc_attendees.map((attendee) => attendee.identifier),
            folders: email.folders,
            tracking_id: email.tracking_id,
            origin: email.origin,
          },
        }),
      );
      if (!inbound) {
        logger.info(
          { emailId: email.email_id },
          "duplicate webhook delivery — already recorded",
        );
        return { emailId: email.email_id, deduped: true };
      }

      // 2. Which attachments are shipment documents? Webhooks sometimes
      //    say has_attachments with an empty array — re-read the email.
      const documents = await step.run("resolve-attachments", async () => {
        let attachments: UnipileAttachment[] = email.attachments;
        if (attachments.length === 0 && email.has_attachments) {
          const full = await UnipileService.getEmail({
            emailId: email.email_id,
          });
          const parsed = unipileAttachmentSchema
            .array()
            .safeParse("attachments" in full ? full.attachments : []);
          attachments = parsed.success ? parsed.data : [];
        }
        return attachments.filter(isDocumentAttachment);
      });

      if (documents.length === 0) {
        await step.run("mark-ignored", () =>
          updateInboundEmail(inbound.id, organizationId, {
            status: InboundEmailStatus.Ignored,
          }),
        );
        logger.info(
          { emailId: email.email_id },
          "no document attachments — ignoring email",
        );
        return { emailId: email.email_id, ignored: true };
      }

      // 3. Attachments → S3, one step each; download + upload share the
      //    step because file bytes cannot cross a step boundary.
      const files = (
        await Promise.all(
          documents.map((attachment, index) =>
            step.run(`store-attachment-${index}`, async () => {
              const data = await UnipileService.getEmailAttachment({
                emailId: email.email_id,
                attachmentId: attachment.id,
              });
              if (data.byteLength > MAX_ATTACHMENT_BYTES) {
                logger.warn(
                  { name: attachment.name, size: data.byteLength },
                  "attachment exceeds size cap — skipped",
                );
                return null;
              }
              const fileName = attachment.name ?? `attachment-${index + 1}`;
              const contentType = attachmentContentType(attachment);
              const key = `organizations/${organizationId}/shipment-documents/${randomUUID()}/${safeFileName(fileName)}`;
              await BlobStorageService.putObject({
                key,
                body: data,
                contentType,
              });
              return {
                key,
                fileName,
                contentType,
                size: data.byteLength,
                category: categoryFromFileName(fileName),
              };
            }),
          ),
        )
      ).filter((file) => file !== null);

      if (files.length === 0) {
        await step.run("mark-ignored-oversized", () =>
          updateInboundEmail(inbound.id, organizationId, {
            status: InboundEmailStatus.Ignored,
          }),
        );
        return { emailId: email.email_id, ignored: true };
      }

      logger.info(
        {
          emailId: email.email_id,
          stored: files.length,
          files: files.map((file) => file.fileName),
        },
        "attachments stored",
      );

      // 4. The one fact grouping needs: which invoice is this about?
      const invoiceNumber = await step.run("extract-invoice-id", async () => {
        try {
          const readable = files.filter(
            (file) =>
              file.contentType === "application/pdf" ||
              file.contentType.startsWith("image/"),
          );
          const withBytes = await Promise.all(
            readable.map(async (file) => ({
              fileName: file.fileName,
              contentType: file.contentType,
              data: await BlobStorageService.getObject({ key: file.key }),
            })),
          );
          return await extractInvoiceId({
            subject: email.subject ?? null,
            body: email.body_plain || email.body || null,
            documents: withBytes,
          });
        } catch (error) {
          // Grouping degrades to thread matching; never fail the email.
          logger.warn(
            { emailId: email.email_id, err: error },
            "invoice-id extraction failed — grouping by thread only",
          );
          return null;
        }
      });
      logger.info(
        { emailId: email.email_id, invoiceNumber },
        invoiceNumber
          ? "invoice number extracted"
          : "no invoice number found in email",
      );

      // 5. An open shipment for this invoice/thread, or a new one.
      const attributedShipmentId = await step.run("attribute-shipment", () =>
        findOpenEmailShipment({
          organizationId,
          invoiceNumber,
          inReplyToMessageId: email.in_reply_to?.message_id ?? null,
        }),
      );

      let shipmentId: string;
      let openedWindow = false;
      if (attributedShipmentId) {
        shipmentId = attributedShipmentId;
        logger.info(
          { emailId: email.email_id, shipmentId, invoiceNumber },
          "email attributed to open shipment",
        );
      } else {
        const created = await step.run("create-email-shipment", async () => {
          // The intake window length is an organization setting; the env
          // value is the platform default.
          const organization = await selectOrganization(organizationId);
          const windowMs = organization?.emailIntakeWindowMinutes
            ? organization.emailIntakeWindowMinutes * 60_000
            : env.EMAIL_INTAKE_WINDOW_MS;
          const expiresAt = new Date(receivedAt.getTime() + windowMs);
          const shipment = await createPlaceholderShipment({
            organizationId,
            userId,
            fileCount: files.length,
            values: {
              source: ShipmentSource.Email,
              emailIntakeInvoiceNumber: invoiceNumber,
              emailIntakeExpiresAt: expiresAt,
              processingState: "Collecting email documents",
            },
          });
          return {
            shipmentId: shipment.id,
            finalizeAt: expiresAt.toISOString(),
          };
        });
        shipmentId = created.shipmentId;
        openedWindow = true;
        logger.info(
          {
            emailId: email.email_id,
            shipmentId,
            invoiceNumber,
            finalizeAt: created.finalizeAt,
          },
          "new email-sourced shipment opened",
        );
        await step.sendEvent("open-intake-window", {
          name: EMAIL_SHIPMENT_INTAKE_OPENED_EVENT,
          data: {
            organizationId,
            userId,
            shipmentId,
            finalizeAt: created.finalizeAt,
          },
        });
      }

      // 6. Tie the email to its shipment, then land it on the timeline.
      await step.run("link-email", () =>
        updateInboundEmail(inbound.id, organizationId, {
          shipmentId,
          invoiceNumber,
        }),
      );

      await step.run("record-email-event", () =>
        insertShipmentEvent({
          organizationId,
          userId,
          shipmentId,
          type: "email_received",
          actor: "system",
          title: email.subject
            ? `Email received: ${email.subject.slice(0, 120)}`
            : `Email received from ${fromAddress}`,
          payload: {
            from: fromAddress,
            subject: email.subject,
            attachments: files.map((file) => file.fileName),
            invoiceNumber,
            inboundEmailId: inbound.id,
          },
        }),
      );

      // 7. The regular ingest pipeline takes it from here — classification
      //    waits for the intake window to close.
      await step.sendEvent("ingest-documents", {
        name: SHIPMENT_DOCUMENTS_UPLOADED_EVENT,
        data: {
          organizationId,
          userId,
          shipmentId,
          bucket: env.AWS_S3_BUCKET,
          files,
          deferClassification: true,
        },
      });

      await step.run("mark-processed", () =>
        updateInboundEmail(inbound.id, organizationId, {
          status: InboundEmailStatus.Processed,
        }),
      );

      await langfuseSpanProcessor?.forceFlush();

      logger.info(
        {
          emailId: email.email_id,
          shipmentId,
          documents: files.length,
          invoiceNumber,
          openedWindow,
        },
        "inbound email processed",
      );

      return {
        emailId: email.email_id,
        shipmentId,
        documents: files.length,
        invoiceNumber,
        openedWindow,
      };
    },
  );
};
