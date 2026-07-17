import { listInboundEmails } from "@/db/queries/select/many/listInboundEmails";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { ShipmentDocumentCategory, ShipmentSource } from "@/db/schema";
import type { UnipileAttachment } from "@/services/external/unipile/schema";

/** Mime types / extensions that count as shipment documents. */
const DOCUMENT_MIME_PREFIXES = ["application/pdf", "image/"];
const DOCUMENT_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);
const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "tiff",
  "xlsx",
  "xls",
  "csv",
]);

/** Attachments beyond this are skipped (typical provider cap is 25MB). */
export const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024;

function extensionOf(attachment: UnipileAttachment): string {
  const fromField = attachment.extension?.replace(/^\./, "").toLowerCase();
  if (fromField) return fromField;
  return attachment.name?.split(".").pop()?.toLowerCase() ?? "";
}

/** Whether an attachment looks like a shipment document (vs a signature
 * logo, calendar invite, etc). Mime wins; extension is the fallback. */
export function isDocumentAttachment(attachment: UnipileAttachment): boolean {
  const mime = attachment.mime?.toLowerCase();
  if (mime) {
    return (
      DOCUMENT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) ||
      DOCUMENT_MIMES.has(mime)
    );
  }
  return DOCUMENT_EXTENSIONS.has(extensionOf(attachment));
}

const EXTENSION_MIMES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  tiff: "image/tiff",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
};

export function attachmentContentType(attachment: UnipileAttachment): string {
  return (
    attachment.mime ??
    EXTENSION_MIMES[extensionOf(attachment)] ??
    "application/octet-stream"
  );
}

/** Best-effort category from the filename so the ingest pipeline can rank
 * line-item sources (commercial invoice first); "other" when ambiguous. */
export function categoryFromFileName(
  fileName: string,
): ShipmentDocumentCategory {
  const name = fileName.toLowerCase();
  if (name.includes("invoice")) {
    return ShipmentDocumentCategory.CommercialInvoice;
  }
  if (name.includes("packing")) return ShipmentDocumentCategory.PackingList;
  if (name.includes("lading") || /\bbol\b/.test(name)) {
    return ShipmentDocumentCategory.BillOfLading;
  }
  if (name.includes("arrival")) return ShipmentDocumentCategory.ArrivalNotice;
  return ShipmentDocumentCategory.Other;
}

export function safeFileName(fileName: string): string {
  return (
    fileName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "") || "document"
  );
}

/**
 * The open email-sourced shipment a new inbound email belongs to, if any.
 * Candidates come from previously linked emails — the invoice number first
 * (the grouping key), then the reply thread. A candidate only wins while
 * its shipment's intake window is still open; a late email for the same
 * invoice starts a fresh shipment by design.
 */
export async function findOpenEmailShipment({
  organizationId,
  invoiceNumber,
  inReplyToMessageId,
}: {
  organizationId: string;
  invoiceNumber: string | null;
  inReplyToMessageId: string | null;
}): Promise<string | null> {
  const candidateIds: string[] = [];

  if (invoiceNumber) {
    const { data } = await listInboundEmails({
      organizationId,
      invoiceNumber,
    });
    candidateIds.push(
      ...data
        .map((email) => email.shipmentId)
        .filter((id): id is string => id !== null),
    );
  }
  if (inReplyToMessageId) {
    const { data } = await listInboundEmails({
      organizationId,
      messageId: inReplyToMessageId,
    });
    candidateIds.push(
      ...data
        .map((email) => email.shipmentId)
        .filter((id): id is string => id !== null),
    );
  }

  const now = new Date();
  for (const shipmentId of new Set(candidateIds)) {
    const shipment = await selectShipment(shipmentId, organizationId);
    if (
      shipment?.source === ShipmentSource.Email &&
      shipment.emailIntakeExpiresAt &&
      shipment.emailIntakeExpiresAt > now
    ) {
      return shipmentId;
    }
  }
  return null;
}
