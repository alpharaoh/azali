import { randomUUID } from "node:crypto";
import { propagateAttributes } from "@langfuse/tracing";
import { getOrganizationSlug } from "@/db/lib/getOrganizationSlug";
import { insertClient } from "@/db/queries/insert/insertClient";
import { insertProduct } from "@/db/queries/insert/insertProduct";
import { insertShipment } from "@/db/queries/insert/insertShipment";
import { insertShipmentDocument } from "@/db/queries/insert/insertShipmentDocument";
import { insertShipmentLineItems } from "@/db/queries/insert/insertShipmentLineItems";
import { listClients } from "@/db/queries/select/many/listClients";
import { listProducts } from "@/db/queries/select/many/listProducts";
import { updateShipmentDocument } from "@/db/queries/update/updateShipmentDocument";
import { updateShipmentLineItem } from "@/db/queries/update/updateShipmentLineItem";
import {
  type DocumentExtraction,
  type ExtractedLineItem,
  LineItemStatus,
  ShipmentDocumentCategory,
  ShipmentDocumentStatus,
  ShipmentStage,
  ShipmentStatus,
} from "@/db/schema";
import type { KnowledgeDocument } from "@/services/external/pinecone/service";
import { BlobStorageService } from "@/services/external/s3/service";
import {
  DocumentExtractionService,
  type ShipmentSynthesis,
} from "@/services/extraction/service";
import { PdfPreviewService } from "@/services/pdf/service";

export interface IngestContext {
  organizationId: string;
  userId: string;
  /** The ingestion run id — groups the batch's traces into one session. */
  batchId: string;
}

export interface UploadedFile {
  key: string;
  fileName: string;
  contentType: string;
  size: number;
  category: ShipmentDocumentCategory;
}

/** Slim projection of a document row — everything later steps need, and
 * small enough to travel between steps as JSON. */
export interface DocumentRow {
  id: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  category: ShipmentDocumentCategory;
}

export type ExtractedDocument = DocumentRow & {
  extraction: DocumentExtraction;
};

const CATEGORY_LABELS: Record<ShipmentDocumentCategory, string> = {
  [ShipmentDocumentCategory.CommercialInvoice]: "Commercial Invoice",
  [ShipmentDocumentCategory.PackingList]: "Packing List",
  [ShipmentDocumentCategory.BillOfLading]: "Bill of Lading",
  [ShipmentDocumentCategory.ArrivalNotice]: "Arrival Notice",
  [ShipmentDocumentCategory.Other]: "Document",
};

/** The preview PNG lives next to the original in the same key folder. */
const previewKeyFor = (storageKey: string) =>
  `${storageKey.split("/").slice(0, -1).join("/")}/preview.png`;

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Insert the audit row for one uploaded file (idempotent on storage key). */
export async function createDocumentRow(
  context: IngestContext,
  file: UploadedFile,
): Promise<DocumentRow> {
  const row = await insertShipmentDocument({
    organizationId: context.organizationId,
    userId: context.userId,
    fileName: file.fileName,
    status: ShipmentDocumentStatus.Pending,
    contentType: file.contentType,
    sizeBytes: file.size,
    category: file.category,
    storageKey: file.key,
  });

  return {
    id: row.id,
    storageKey: row.storageKey,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    category: row.category,
  };
}

/**
 * Download + extract in one unit: the file bytes must never cross a step
 * boundary, so this is the one intentionally compound operation.
 */
export async function extractDocument(
  context: IngestContext,
  doc: DocumentRow,
): Promise<DocumentExtraction> {
  const data = await BlobStorageService.getObject({
    key: doc.storageKey,
  });

  return propagateAttributes(
    {
      traceName: "document-extraction",
      userId: context.userId,
      sessionId: context.batchId,
      tags: ["document-ingestion"],
      metadata: {
        organizationId: context.organizationId,
        organizationSlug: await getOrganizationSlug(context.organizationId),
        documentId: doc.id,
        fileName: doc.fileName,
        category: doc.category,
      },
    },
    () =>
      DocumentExtractionService.extractDocument({
        data,
        contentType: doc.contentType,
        category: doc.category,
        fileName: doc.fileName,
      }),
  );
}

export async function saveExtraction(
  context: IngestContext,
  documentId: string,
  extraction: DocumentExtraction,
): Promise<void> {
  await updateShipmentDocument(documentId, context.organizationId, {
    status: ShipmentDocumentStatus.Extracted,
    extraction: extraction as unknown as Record<string, unknown>,
  });
}

export async function markExtractionFailed(
  context: IngestContext,
  documentId: string,
  error: unknown,
): Promise<void> {
  await updateShipmentDocument(documentId, context.organizationId, {
    status: ShipmentDocumentStatus.Failed,
    failureReason: errorMessage(error),
  });
}

/**
 * Download + render + upload in one unit — bytes stay inside the step; only
 * the resulting object key and page count come out.
 */
export async function renderPreview(
  document: DocumentRow,
): Promise<{ previewKey: string; pageCount: number }> {
  const data = await BlobStorageService.getObject({
    key: document.storageKey,
  });
  const { png, pageCount } = await PdfPreviewService.render({ data });
  const previewKey = previewKeyFor(document.storageKey);

  await BlobStorageService.putObject({
    key: previewKey,
    body: png,
    contentType: "image/png",
  });

  return { previewKey, pageCount };
}

export async function savePreview(
  context: IngestContext,
  documentId: string,
  preview: { previewKey: string; pageCount: number },
): Promise<void> {
  await updateShipmentDocument(documentId, context.organizationId, preview);
}

export async function synthesizeShipmentFacts(
  context: IngestContext,
  extracted: ExtractedDocument[],
): Promise<ShipmentSynthesis> {
  return propagateAttributes(
    {
      traceName: "shipment-synthesis",
      userId: context.userId,
      sessionId: context.batchId,
      tags: ["document-ingestion"],
      metadata: {
        organizationId: context.organizationId,
        organizationSlug: await getOrganizationSlug(context.organizationId),
        documentCount: String(extracted.length),
      },
    },
    () =>
      DocumentExtractionService.synthesizeShipment({
        extractions: extracted.map(({ fileName, category, extraction }) => ({
          fileName,
          category,
          extraction,
        })),
      }),
  );
}

/**
 * Match the synthesized importer to an existing client by name, or create a
 * placeholder. Self-healing on retry: a re-run finds the client it created.
 */
export async function resolveClient(
  context: IngestContext,
  synthesis: ShipmentSynthesis,
): Promise<{ clientId: string; created: boolean }> {
  if (synthesis.clientName) {
    const { data: candidates } = await listClients(
      { organizationId: context.organizationId, search: synthesis.clientName },
      undefined,
      5,
    );
    const exact = candidates.find(
      (candidate) =>
        candidate.name.toLowerCase() === synthesis.clientName?.toLowerCase(),
    );
    const match = exact ?? candidates[0];
    if (match) return { clientId: match.id, created: false };
  }

  const created = await insertClient({
    organizationId: context.organizationId,
    userId: context.userId,
    name: synthesis.clientName ?? "Unknown importer",
    iorNumber: "PENDING",
    bondNumber: "PENDING",
    primaryOrigin: synthesis.originCountry ?? "unknown",
    industry: "unknown",
  });

  return { clientId: created.id, created: true };
}

export async function createShipmentFromSynthesis(
  context: IngestContext,
  synthesis: ShipmentSynthesis,
  clientId: string,
): Promise<{ id: string; reference: string }> {
  const created = await insertShipment({
    organizationId: context.organizationId,
    userId: context.userId,
    clientId,
    reference:
      synthesis.reference ?? `SHP-${randomUUID().slice(0, 8).toUpperCase()}`,
    stage: ShipmentStage.Intake,
    status: ShipmentStatus.Autopilot,
    originCountry: synthesis.originCountry ?? "unknown",
    originPort: synthesis.originPort,
    portOfEntry: synthesis.portOfEntry ?? "unknown",
    transportMode: synthesis.transportMode ?? "ocean",
    conveyance: synthesis.conveyance,
    etaAt: synthesis.etaAt ? new Date(synthesis.etaAt) : null,
    valueCents: Math.round((synthesis.valueUsd ?? 0) * 100),
    incoterm: synthesis.incoterm,
    summary: { description: synthesis.summary },
  });
  if (!created) throw new Error("Shipment insert returned no row");

  return { id: created.id, reference: created.reference };
}

export async function attachDocument(
  context: IngestContext,
  documentId: string,
  shipmentId: string,
): Promise<void> {
  await updateShipmentDocument(documentId, context.organizationId, {
    shipmentId,
  });
}

/** Event payload in the exact shape the review UI renders. */
export function documentReceivedEvent(
  context: IngestContext,
  shipmentId: string,
  item: ExtractedDocument,
) {
  return {
    organizationId: context.organizationId,
    userId: context.userId,
    shipmentId,
    type: "document_received",
    actor: "ai",
    title: item.fileName,
    payload: {
      kind: "pdf",
      name: item.fileName,
      meta: `${CATEGORY_LABELS[item.category]} · ${Math.max(1, Math.round(item.sizeBytes / 1024))} KB`,
      lines: item.extraction.fields,
      summary: item.extraction.summary,
      documentId: item.id,
    },
  };
}

export function factsExtractedEvent(
  context: IngestContext,
  shipmentId: string,
  synthesis: ShipmentSynthesis,
) {
  return {
    organizationId: context.organizationId,
    userId: context.userId,
    shipmentId,
    type: "shipment_facts_extracted",
    actor: "ai",
    title: "Shipment facts extracted from documents",
    payload: {
      facts: {
        originCountry: synthesis.originCountry,
        originPort: synthesis.originPort,
        portOfEntry: synthesis.portOfEntry,
        transportMode: synthesis.transportMode,
        conveyance: synthesis.conveyance,
        incoterm: synthesis.incoterm,
        entryType: null,
      },
    },
  };
}

export function shipmentCreatedEvent(
  context: IngestContext,
  shipmentId: string,
  synthesis: ShipmentSynthesis,
  documentCount: number,
) {
  return {
    organizationId: context.organizationId,
    userId: context.userId,
    shipmentId,
    type: "activity",
    actor: "ai",
    title: `Shipment created from ${documentCount} document${documentCount === 1 ? "" : "s"}`,
    payload: { detail: synthesis.summary },
  };
}

/** One knowledge-base record per extracted document. */
export function knowledgeRecord(
  item: ExtractedDocument,
  shipmentId: string,
): KnowledgeDocument {
  return {
    id: item.id,
    text: [
      item.extraction.summary,
      ...item.extraction.fields.map(
        (field) => `${field.label}: ${field.value}`,
      ),
    ].join("\n"),
    metadata: {
      shipmentId,
      category: item.category,
      fileName: item.fileName,
      source: "shipment_document",
    },
  };
}

/** Slim line projection that travels between steps. */
export interface LineItemRow {
  id: string;
  lineNumber: number;
  description: string;
  sku: string | null;
  quantity: number | null;
  unit: string | null;
  totalValueCents: number | null;
  originCountry: string | null;
  declaredHts: string | null;
}

const toCents = (usd: number | null | undefined) =>
  usd === null || usd === undefined ? null : Math.round(usd * 100);

/**
 * The commercial invoice is the canonical line source; the packing list is
 * the fallback. Shipments with neither get ONE synthetic line so every
 * shipment flows the same classification path.
 */
export async function createLineItems(
  context: IngestContext,
  shipmentId: string,
  extracted: ExtractedDocument[],
  synthesis: ShipmentSynthesis,
  shipmentValueCents: number,
): Promise<LineItemRow[]> {
  const bySource = (category: ShipmentDocumentCategory) =>
    extracted.find(
      (document) =>
        document.category === category &&
        (document.extraction.lineItems?.length ?? 0) > 0,
    )?.extraction.lineItems;

  const sourceLines: ExtractedLineItem[] = bySource(
    ShipmentDocumentCategory.CommercialInvoice,
  ) ??
    bySource(ShipmentDocumentCategory.PackingList) ?? [
      {
        description: synthesis.summary.slice(0, 300),
        sku: null,
        quantity: null,
        unit: null,
        unitValueUsd: null,
        totalValueUsd: shipmentValueCents / 100,
        originCountry: synthesis.originCountry,
        declaredHts: null,
      },
    ];

  const rows = await insertShipmentLineItems(
    sourceLines.map((line, index) => ({
      organizationId: context.organizationId,
      userId: context.userId,
      shipmentId,
      lineNumber: index + 1,
      description: line.description,
      sku: line.sku,
      quantity: line.quantity,
      unit: line.unit,
      unitValueCents: toCents(line.unitValueUsd),
      totalValueCents: toCents(line.totalValueUsd),
      originCountry: line.originCountry ?? synthesis.originCountry,
      declaredHts: line.declaredHts,
      status: LineItemStatus.Pending,
    })),
  );

  return rows.map((row) => ({
    id: row.id,
    lineNumber: row.lineNumber,
    description: row.description,
    sku: row.sku,
    quantity: row.quantity,
    unit: row.unit,
    totalValueCents: row.totalValueCents,
    originCountry: row.originCountry,
    declaredHts: row.declaredHts,
  }));
}

/**
 * Link the line to the importer's product library — exact SKU, else exact
 * name — creating the product on first sight. The product is the durable
 * unit of classification.
 */
export async function matchOrCreateProduct(
  context: IngestContext,
  clientId: string,
  line: LineItemRow,
): Promise<{ productId: string; created: boolean }> {
  // Exact SKU is the strong identifier; case-insensitive name is the
  // fallback. Semantic matching can layer on later.
  const bySku = line.sku
    ? (
        await listProducts(
          { organizationId: context.organizationId, clientId, sku: line.sku },
          undefined,
          1,
        )
      ).data[0]
    : undefined;
  const existing =
    bySku ??
    (
      await listProducts(
        {
          organizationId: context.organizationId,
          clientId,
          nameEquals: line.description,
        },
        undefined,
        1,
      )
    ).data[0];

  if (existing) {
    await updateShipmentLineItem(line.id, context.organizationId, {
      productId: existing.id,
    });
    return { productId: existing.id, created: false };
  }

  const product = await insertProduct({
    organizationId: context.organizationId,
    userId: context.userId,
    clientId,
    name: line.description.slice(0, 300),
    sku: line.sku,
    attributes: {
      ...(line.unit ? { unit: line.unit } : {}),
      ...(line.originCountry ? { originCountry: line.originCountry } : {}),
      ...(line.declaredHts ? { declaredHts: line.declaredHts } : {}),
    },
  });
  await updateShipmentLineItem(line.id, context.organizationId, {
    productId: product.id,
  });

  return { productId: product.id, created: true };
}
