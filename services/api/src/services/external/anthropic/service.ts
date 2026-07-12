import { generateObject } from "ai";
import { z } from "zod";
import type { DocumentExtraction } from "@/db/schema";
import { ShipmentDocumentCategory } from "@/db/schema";
import { anthropic } from "./client";

const EXTRACTION_MODEL = "claude-sonnet-4-6";

const extractionSchema = z.object({
  summary: z
    .string()
    .describe("A 2–3 sentence summary of the document's contents."),
  fields: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe(
      "Key-value pairs of the document's structured data, in the order they appear.",
    ),
});

/**
 * The standard fields a customs broker expects per document type. Guidance
 * lives in the prompt so every category shares one output shape.
 */
const CATEGORY_FIELD_GUIDANCE: Record<ShipmentDocumentCategory, string> = {
  [ShipmentDocumentCategory.CommercialInvoice]:
    "Seller, Buyer, Invoice Number, Invoice Date, Incoterms, Currency, Total Value, Country of Origin, Payment Terms, and one field per line item (description, quantity, unit price, amount).",
  [ShipmentDocumentCategory.PackingList]:
    "Shipper, Consignee, Packing List Number, Date, Package Count, Package Type, Net Weight, Gross Weight, Total Volume/Dimensions, Marks & Numbers.",
  [ShipmentDocumentCategory.BillOfLading]:
    "Shipper, Consignee, Notify Party, B/L Number, Carrier, Vessel/Voyage, Port of Loading, Port of Discharge, ETD, ETA, Container Numbers, Freight Terms.",
  [ShipmentDocumentCategory.ArrivalNotice]:
    "Carrier/Agent, Consignee, Arrival Date, Vessel/Voyage, Port of Entry, Container Numbers, B/L Reference, Charges Due, Free Time/Last Free Day.",
  [ShipmentDocumentCategory.Other]:
    "Whatever structured data the document contains: parties, reference numbers, dates, amounts, product details.",
};

const shipmentSynthesisSchema = z.object({
  clientName: z
    .string()
    .nullable()
    .describe("The importer/buyer the shipment belongs to."),
  reference: z
    .string()
    .nullable()
    .describe(
      "The primary shipment reference (booking, PO, or invoice number).",
    ),
  originCountry: z
    .string()
    .nullable()
    .describe("ISO 3166-1 alpha-2 country of origin, e.g. CN."),
  originPort: z.string().nullable(),
  portOfEntry: z.string().nullable().describe("US port of entry/discharge."),
  transportMode: z.enum(["ocean", "air", "truck", "rail"]).nullable(),
  conveyance: z.string().nullable().describe("Vessel/voyage or flight."),
  etaAt: z
    .string()
    .nullable()
    .describe("Estimated arrival as an ISO 8601 date, if stated."),
  valueUsd: z
    .number()
    .nullable()
    .describe("Total commercial value in US dollars."),
  incoterm: z.string().nullable().describe("E.g. FOB, CIF, DDP."),
  summary: z
    .string()
    .describe("One sentence describing the shipment (goods, route, parties)."),
});

export type ShipmentSynthesis = z.infer<typeof shipmentSynthesisSchema>;

export class DocumentExtractionService {
  /** Extract structured key-value pairs + a summary from one document. */
  static async extractDocument({
    data,
    contentType,
    category,
    fileName,
  }: {
    data: Uint8Array;
    contentType: string;
    category: ShipmentDocumentCategory;
    fileName: string;
  }): Promise<DocumentExtraction> {
    const prompt = [
      `You are a customs brokerage document processor. Extract the structured data from this ${category.replace(/_/g, " ")} ("${fileName}").`,
      `Standard fields to look for: ${CATEGORY_FIELD_GUIDANCE[category]}`,
      "Only include fields actually present on the document. Keep values verbatim (amounts with currency symbols, dates as printed). Flag any internal inconsistencies (e.g. totals that don't add up) as their own field.",
    ].join("\n\n");

    const filePart =
      contentType === "application/pdf"
        ? { type: "file" as const, data, mediaType: "application/pdf" }
        : contentType.startsWith("image/")
          ? { type: "image" as const, image: data }
          : null;

    if (!filePart) {
      throw new Error(`Unsupported content type for extraction: ${contentType}`);
    }

    const { object } = await generateObject({
      model: anthropic(EXTRACTION_MODEL),
      schema: extractionSchema,
      messages: [
        {
          role: "user",
          content: [filePart, { type: "text", text: prompt }],
        },
      ],
    });

    return object;
  }

  /** Derive the shipment facts from a batch of document extractions. */
  static async synthesizeShipment({
    extractions,
  }: {
    extractions: Array<{
      fileName: string;
      category: ShipmentDocumentCategory;
      extraction: DocumentExtraction;
    }>;
  }): Promise<ShipmentSynthesis> {
    const { object } = await generateObject({
      model: anthropic(EXTRACTION_MODEL),
      schema: shipmentSynthesisSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "You are a customs brokerage intake agent. The following documents were uploaded together for one inbound shipment. Derive the shipment facts from their extracted data.",
                "Use null for anything the documents don't state. Prefer the commercial invoice for parties and value, the bill of lading for routing.",
                JSON.stringify(extractions, null, 2),
              ].join("\n\n"),
            },
          ],
        },
      ],
    });

    return object;
  }
}
