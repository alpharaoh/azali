import { Module } from "@nestjs/common";
import { EmailAccountsController } from "./email-accounts.controller";
import { EmailAccountsService } from "./email-accounts.service";
import { UnipileWebhooksController } from "./unipile-webhooks.controller";
import { UnipileWebhooksService } from "./unipile-webhooks.service";

@Module({
  controllers: [EmailAccountsController, UnipileWebhooksController],
  providers: [EmailAccountsService, UnipileWebhooksService],
})
export class EmailAccountsModule {}
