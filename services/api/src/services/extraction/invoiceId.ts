import { type FilePart, generateText, type ImagePart, Output } from "ai";
import { z } from "zod";
import { anthropic } from "@/services/external/anthropic/client";
import { resolvePrompt } from "@/services/external/langfuse/prompts";

/** Invoice-ID extraction is a one-field read — the cheapest model wins. */
const INVOICE_ID_MODEL = "claude-haiku-4-5-20251001";

export const INVOICE_ID_PROMPT_NAME = "email-invoice-id-prompt";
export const INVOICE_ID_PROMPT_FALLBACK = `You are a customs brokerage intake processor. An email arrived on an importer's inbox with shipping documents attached. Identify the commercial invoice number this correspondence concerns.

Email subject: {{subject}}

Email body:
{{body}}

Look in the attached documents first (a commercial invoice's own number is authoritative), then the subject and body. Return the invoice number verbatim as printed. If no invoice number is stated anywhere, return null — do not guess or fabricate one, and do not substitute a PO number, bill of lading number, or container number.`;

const invoiceIdSchema = z.object({
  invoiceNumber: z
    .string()
    .nullable()
    .describe(
      "The commercial invoice number/ID this correspondence concerns, verbatim; null if none is stated.",
    ),
});

/** Uppercase + strip everything non-alphanumeric so "Inv #A-102 33" and
 * "INV A10233" group together. Returns null for empty results. */
export function normalizeInvoiceNumber(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.length > 0 ? normalized : null;
}

/**
 * Extract the (normalized) invoice number an inbound email concerns, from
 * its subject/body and document attachments. Only PDF and image documents
 * can be shown to the model; others are identified by subject/body alone.
 */
export async function extractInvoiceId({
  subject,
  body,
  documents,
}: {
  subject: string | null;
  body: string | null;
  documents: Array<{
    fileName: string;
    contentType: string;
    data: Uint8Array;
  }>;
}): Promise<string | null> {
  const { text: prompt } = await resolvePrompt(
    INVOICE_ID_PROMPT_NAME,
    INVOICE_ID_PROMPT_FALLBACK,
    {
      subject: subject?.slice(0, 300) ?? "(none)",
      body: body?.slice(0, 4000) ?? "(none)",
    },
  );

  const fileParts = documents.flatMap(
    (document): Array<FilePart | ImagePart> =>
      document.contentType === "application/pdf"
        ? [
            {
              type: "file",
              data: document.data,
              mediaType: "application/pdf",
            },
          ]
        : document.contentType.startsWith("image/")
          ? [{ type: "image", image: document.data }]
          : [],
  );

  const { output } = await generateText({
    model: anthropic(INVOICE_ID_MODEL),
    output: Output.object({ schema: invoiceIdSchema }),
    telemetry: { functionId: "email-invoice-id" },
    messages: [
      { role: "user", content: [...fileParts, { type: "text", text: prompt }] },
    ],
  });

  return normalizeInvoiceNumber(output.invoiceNumber);
}
