// Path-alias hook must load before any module that imports via "@/".
import "./aliases";
// Tracing must initialize before anything that calls the AI SDK loads.
import "./instrumentation";

import { parse as parseFormBody } from "node:querystring";
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
import { inngest } from "./inngest/client";
import { getInngestFunctions } from "./inngest/functions";
import { registerRequestWatchdog } from "./lib/requestWatchdog";

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
  app.setGlobalPrefix("v1", { exclude: ["/"] });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const inngestFunctions = getInngestFunctions();

  app
    .getHttpAdapter()
    .getInstance()
    .route({
      method: ["GET", "POST", "PUT"],
      url: "/v1/inngest",
      // inngest's handler is generic over its own Querystring shape (and a
      // different fastify copy), so it can't satisfy the route signature.
      handler: serve({
        client: inngest,
        functions: inngestFunctions,
      }) as never,
    });

  // Parsers must be replaced AFTER init: the better-auth module swaps in
  // its own body parsers during module init, discarding anything set
  // earlier. This override keeps normal form parsing but sniffs JSON
  // first — some webhook senders (Unipile) post JSON bodies labeled as
  // x-www-form-urlencoded, which a plain form parser would shred into
  // garbage keys.
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  registerRequestWatchdog(fastify);
  fastify.removeContentTypeParser("application/x-www-form-urlencoded");
  fastify.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      const text = (body as string).trim();

      // Raw or percent-encoded JSON posing as a form body.
      const candidates = [text];
      if (/^%7B/i.test(text)) {
        try {
          candidates.push(decodeURIComponent(text));
        } catch {
          // Malformed encoding — fall through to form parsing.
        }
      }
      for (const candidate of candidates) {
        if (candidate.startsWith("{")) {
          try {
            done(null, JSON.parse(candidate));
            return;
          } catch {
            // Not JSON after all — treat as a regular form body.
          }
        }
      }

      const parsed = { ...parseFormBody(text) };
      // Last resort: form parsing reduced a mislabeled JSON payload to a
      // single garbage key holding the (now-decoded) document.
      const keys = Object.keys(parsed);
      const only = keys[0];
      if (keys.length === 1 && only?.startsWith("{") && parsed[only] === "") {
        try {
          done(null, JSON.parse(only));
          return;
        } catch {
          // Genuinely a form body with a weird key.
        }
      }
      done(null, parsed);
    },
  );

  await app.listen(process.env.PORT ?? 3001, "0.0.0.0");
}
bootstrap();
