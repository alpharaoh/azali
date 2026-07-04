import { Global, Module } from "@nestjs/common";
import { DeckEngineService } from "./service";

@Global()
@Module({
  providers: [DeckEngineService],
  exports: [DeckEngineService],
})
export class DeckEngineModule {}
