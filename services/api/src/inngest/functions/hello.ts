import { Logger } from "@nestjs/common";
import { inngest } from "../../inngest/client";
import { AppService } from "../../app.service";

export type InngestHello = {
  data: {
    [key: string]: any;
  };
};

/**
 *
 * @param dependencies dependencies to be injected in the function
 * @returns inngest function that will be supplied to serve middleware
 */
export const hello = (dependencies: {
  appService: AppService;
  logger: Logger;
}) => {
  return inngest.createFunction(
    { id: "hello-world" },
    { event: "job/hello.world" },
    async ({ step }) => {
      return await step.run("start-single-jobs", () => {
        dependencies.logger.log(`Initiating Job`);
        return dependencies.appService.getHello();
      });
    },
  );
};
