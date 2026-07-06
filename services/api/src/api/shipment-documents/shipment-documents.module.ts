import { Module } from "@nestjs/common";
import { ShipmentDocumentsController } from "./shipment-documents.controller";
import { ShipmentDocumentsService } from "./shipment-documents.service";

@Module({
  controllers: [ShipmentDocumentsController],
  providers: [ShipmentDocumentsService],
})
export class ShipmentDocumentsModule {}
