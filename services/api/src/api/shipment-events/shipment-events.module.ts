import { Module } from "@nestjs/common";
import { ShipmentEventsController } from "./shipment-events.controller";
import { ShipmentEventsService } from "./shipment-events.service";

@Module({
  controllers: [ShipmentEventsController],
  providers: [ShipmentEventsService],
  exports: [ShipmentEventsService],
})
export class ShipmentEventsModule {}
