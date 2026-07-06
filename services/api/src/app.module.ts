import { Module, RequestMethod } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { LoggerModule } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";
import { ClientsModule } from "./api/clients/clients.module";
import { OrganizationModule } from "./api/organization/organization.module";
import { ShipmentDocumentsModule } from "./api/shipment-documents/shipment-documents.module";
import { ShipmentEventsModule } from "./api/shipment-events/shipment-events.module";
import { ShipmentsModule } from "./api/shipments/shipments.module";
import { UsersController } from "./api/users/users.controller";
import { UsersModule } from "./api/users/users.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { auth } from "./lib/auth";

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    LoggerModule.forRoot({
      forRoutes: [{ path: "*path", method: RequestMethod.ALL }],
    }),
    UsersModule,
    ClientsModule,
    OrganizationModule,
    ShipmentsModule,
    ShipmentEventsModule,
    ShipmentDocumentsModule,
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
