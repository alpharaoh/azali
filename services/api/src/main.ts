import type { Logger as NestLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { serve } from "inngest/fastify";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AppService } from "./app.service";
import { inngest } from "./inngest/client";
import { getInngestFunctions } from "./inngest/functions";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  const config = new DocumentBuilder()
    .setTitle("Azali API")
    .setDescription("The official API for Azali")
    .setVersion("1.0")
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("/swagger", app, documentFactory, {
    jsonDocumentUrl: "openapi.json",
  });

  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix("v1");

  const logger = app.get(Logger);
  app.useLogger(logger);

  const appService = app.get(AppService);
  const inngestFunctions = getInngestFunctions({
    appService,
    logger: logger as unknown as NestLogger,
  });

  app
    .getHttpAdapter()
    .getInstance()
    .route({
      method: ["GET", "POST", "PUT"],
      url: "/v1/inngest",
      handler: serve({ client: inngest, functions: inngestFunctions }),
    });

  await app.listen(process.env.PORT ?? 3001, "0.0.0.0");
}
bootstrap();
