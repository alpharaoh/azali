import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { updateShipment } from "@/db/queries/update/updateShipment";

/**
 * The single owner of the "pipeline stopped" invariant: the shipment must
 * stop showing as processing AND the reason must land on its timeline.
 * Used by both Inngest onFailure handlers and every early-exit path that
 * would otherwise strand the shipment silently.
 */
export async function recordProcessingFailure({
  organizationId,
  userId,
  shipmentId,
  type,
  title,
  error,
}: {
  organizationId: string;
  userId: string;
  shipmentId: string;
  type: "ingest_failed" | "classification_failed";
  title: string;
  error?: unknown;
}): Promise<void> {
  await updateShipment(shipmentId, organizationId, { processingState: null });
  await insertShipmentEvent({
    organizationId,
    userId,
    shipmentId,
    type,
    actor: "system",
    title,
    payload: {
      ...(error !== undefined
        ? { error: error instanceof Error ? error.message : String(error) }
        : {}),
    },
  });
}
