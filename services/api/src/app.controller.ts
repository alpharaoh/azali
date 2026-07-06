import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { AppService } from "./app.service";

@ApiTags("Health")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Unauthenticated liveness probe. */
  @Get()
  @AllowAnonymous()
  @ApiOperation({
    summary: "Health check",
    description:
      "Unauthenticated liveness probe. Returns a static greeting when the API is up.",
  })
  @ApiOkResponse({ type: String, description: "A static greeting." })
  getHello(): string {
    return this.appService.getHello();
  }
}
