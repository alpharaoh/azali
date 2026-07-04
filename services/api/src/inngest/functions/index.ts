import { Logger } from "@nestjs/common";
import { AppService } from "@/app.service";

import { hello } from "@/inngest/functions/hello";

export const getInngestFunctions = (dependencies: {
  appService: AppService;
  logger: Logger;
}) => {
  return [
    hello({
      appService: dependencies.appService,
      logger: dependencies.logger,
    }),
  ];
};
