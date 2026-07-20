import { classifyShipment } from "@/inngest/functions/classifyShipment";
import { finalizeEmailShipment } from "@/inngest/functions/finalizeEmailShipment";
import { ingestShipmentDocuments } from "@/inngest/functions/ingestShipmentDocuments";
import { processInboundEmail } from "@/inngest/functions/processInboundEmail";
import { screenShipmentPga } from "@/inngest/functions/screenShipmentPga";

// Handlers log through Inngest's ctx.logger (backed by the shared pino
// instance configured on the client).
export const getInngestFunctions = () => {
  return [
    ingestShipmentDocuments(),
    classifyShipment(),
    screenShipmentPga(),
    processInboundEmail(),
    finalizeEmailShipment(),
  ];
};
