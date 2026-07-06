import type { Logger } from "@nestjs/common";
import type { AppService } from "@/app.service";

import { hello } from "@/inngest/functions/hello";
import { ingestShipmentDocuments } from "@/inngest/functions/ingestShipmentDocuments";

export const getInngestFunctions = (dependencies: {
  appService: AppService;
  logger: Logger;
}) => {
  return [
    hello({
      appService: dependencies.appService,
      logger: dependencies.logger,
    }),
    ingestShipmentDocuments({ logger: dependencies.logger }),
  ];
};
