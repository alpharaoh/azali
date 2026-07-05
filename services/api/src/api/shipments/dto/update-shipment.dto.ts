import { createZodDto } from "nestjs-zod";
import { createShipmentSchema } from "./create-shipment.dto";

export const updateShipmentSchema = createShipmentSchema.partial();

export class UpdateShipmentDto extends createZodDto(updateShipmentSchema) {}
