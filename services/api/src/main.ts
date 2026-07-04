import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "nestjs-pino";
import { Logger as NestLogger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { getInngestFunctions } from "@/inngest/functions";
import { serve } from "inngest/express";
import { json } from "express";
import { inngest } from "@/inngest/client";
import { AppService } from "@/app.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  const config = new DocumentBuilder()
    .setTitle("Norium API")
    .setDescription("The official API for Norium")
    .setVersion("1.0")
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("/swagger", app, documentFactory, {
    jsonDocumentUrl: "openapi.json",
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix("v1");

  const logger = app.get(Logger);
  app.useLogger(logger);

  const appService = app.get(AppService);
  const inngestFunctions = getInngestFunctions({
    appService: appService,
    logger: logger as unknown as NestLogger,
  });

  app.use(
    "/v1/inngest",
    json(),
    serve({
      client: inngest,
      functions: inngestFunctions,
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
