import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { UnipileWebhooksService } from "./unipile-webhooks.service";

/**
 * Public endpoints Unipile calls. The email webhook is guarded by a shared
 * secret header (configured on the webhook registration); the hosted-auth
 * notify is guarded by the single-use connect token inside its payload.
 * Both always answer 200 on bad payloads — 4xx would make Unipile retry.
 */
@ApiExcludeController()
@Controller("webhooks/unipile")
export class UnipileWebhooksController {
  constructor(private readonly webhooksService: UnipileWebhooksService) {}

  @Post("hosted-auth")
  @AllowAnonymous()
  @HttpCode(200)
  hostedAuth(@Body() body: unknown) {
    return this.webhooksService.handleHostedAuthNotify(body);
  }

  @Post("email")
  @AllowAnonymous()
  @HttpCode(200)
  email(
    @Headers("x-azali-webhook-secret") secret: string | undefined,
    @Body() body: unknown,
  ) {
    if (!this.webhooksService.verifyWebhookSecret(secret)) {
      throw new UnauthorizedException();
    }
    return this.webhooksService.handleEmailWebhook(body);
  }
}
