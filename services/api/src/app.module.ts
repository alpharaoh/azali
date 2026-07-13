import { Module, RequestMethod } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { LoggerModule } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";
import { AgentRunsModule } from "./api/agent-runs/agent-runs.module";
import { ClientsModule } from "./api/clients/clients.module";
import { OrganizationModule } from "./api/organization/organization.module";
import { ProductsModule } from "./api/products/products.module";
import { ShipmentDocumentsModule } from "./api/shipment-documents/shipment-documents.module";
import { ShipmentEventsModule } from "./api/shipment-events/shipment-events.module";
import { ShipmentsModule } from "./api/shipments/shipments.module";
import { UsersController } from "./api/users/users.controller";
import { UsersModule } from "./api/users/users.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { env } from "./env";
import { auth } from "./lib/auth";

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    LoggerModule.forRoot({
      forRoutes: [{ path: "*path", method: RequestMethod.ALL }],
      pinoHttp: {
        // Pretty, colourised logs locally; JSON in production for aggregation.
        transport:
          env.NODE_ENV === "development"
            ? {
                target: "pino-pretty",
                options: {
                  singleLine: true,
                  translateTime: "HH:MM:ss",
                  ignore: "pid,hostname",
                },
              }
            : undefined,
        redact: {
          paths: [
            "req.headers.cookie",
            "req.headers.authorization",
            'res.headers["set-cookie"]',
          ],
          remove: true,
        },
        // The Inngest dev server syncs and executes against this route
        // constantly; its own dashboard covers observability there.
        autoLogging: {
          ignore: (req) => {
            // Nest mounts this middleware via middie, which rewrites req.url
            // to the unmatched suffix; originalUrl keeps the full path.
            const url =
              (req as { originalUrl?: string }).originalUrl ?? req.url;
            return url?.split("?")[0] === "/v1/inngest";
          },
        },
      },
    }),
    UsersModule,
    ClientsModule,
    OrganizationModule,
    ShipmentsModule,
    ShipmentEventsModule,
    ShipmentDocumentsModule,
    AgentRunsModule,
    ProductsModule,
  ],
  controllers: [AppController, UsersController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
