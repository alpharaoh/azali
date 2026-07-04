import { InngestHello } from "@/inngest/functions/hello";
import { EventSchemas, Inngest } from "inngest";

export type Events = {
  "job/hello.world": InngestHello;
};

export const inngest = new Inngest({
  id: "norium-inngest",
  schemas: new EventSchemas().fromRecord<Events>(),
});
