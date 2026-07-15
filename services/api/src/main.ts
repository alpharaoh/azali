// Tracing must initialize before anything that calls the AI SDK loads.
import "./instrumentation";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { serve } from "inngest/fastify";
import { Logger } from "nestjs-pino";
import { cleanupOpenApiDoc } from "nestjs-zod";
import { AppModule } from "./app.module";
import { env } from "./env";
import { inngest } from "./inngest/client";
import { getInngestFunctions } from "./inngest/functions";
import { RedisIoAdapter } from "./realtime/redis-io.adapter";

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
  const documentFactory = () =>
    cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup("/swagger", app, documentFactory, {
    jsonDocumentUrl: "openapi.json",
  });

  app.enableCors({
    origin: true,
    credentials: true,
    // @fastify/cors only allows GET,HEAD,POST by default; list everything.
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  app.setGlobalPrefix("v1");

  // Realtime websocket transport. With REDIS_URL, room broadcasts relay
  // across horizontally-scaled instances; without it, in-memory (dev).
  const ioAdapter = new RedisIoAdapter(
    app.getHttpAdapter().getInstance().server,
  );
  if (env.REDIS_URL) {
    await ioAdapter.connectToRedis(env.REDIS_URL);
  }
  app.useWebSocketAdapter(ioAdapter);

  const logger = app.get(Logger);
  app.useLogger(logger);

  const inngestFunctions = getInngestFunctions();

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
