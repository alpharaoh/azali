import { classifyShipment } from "@/inngest/functions/classifyShipment";
import { ingestShipmentDocuments } from "@/inngest/functions/ingestShipmentDocuments";

// Handlers log through Inngest's ctx.logger (backed by the shared pino
// instance configured on the client).
export const getInngestFunctions = () => {
  return [ingestShipmentDocuments(), classifyShipment()];
};
