import {
  pino,
  type TransportMultiOptions,
  type TransportSingleOptions,
} from "pino";
import { env } from "@/env";

/**
 * The process-wide structured logger for code that runs outside a request
 * (agents, Inngest functions, background services). HTTP request logging is
 * handled separately by nestjs-pino in app.module.ts — both share
 * loggerTransport below so the two configs stay aligned: pretty locally,
 * JSON in production.
 *
 * When DD_API_KEY is set, logs additionally ship to Datadog via agentless
 * HTTP intake (pino-datadog-transport). dd-trace APM is deliberately not
 * used — the API runs on Bun, which dd-trace does not support.
 */

const prettyTarget = {
  target: "pino-pretty",
  options: {
    singleLine: true,
    translateTime: "HH:MM:ss",
    ignore: "pid,hostname",
  },
};

// Keep JSON flowing to stdout alongside Datadog so the host platform's own
// log capture still works.
const stdoutTarget = { target: "pino/file", options: { destination: 1 } };

const datadogTarget = env.DD_API_KEY
  ? {
      target: "pino-datadog-transport",
      options: {
        ddClientConf: {
          authMethods: { apiKeyAuth: env.DD_API_KEY },
        },
        ddServerConf: { site: env.DD_SITE },
        service: env.DD_SERVICE,
        ddsource: "nodejs",
        ddtags: `env:${env.DD_ENV ?? env.NODE_ENV}`,
      },
    }
  : null;

export const loggerTransport:
  | TransportSingleOptions
  | TransportMultiOptions
  | undefined = datadogTarget
  ? {
      targets: [
        env.NODE_ENV === "development" ? prettyTarget : stdoutTarget,
        datadogTarget,
      ],
    }
  : env.NODE_ENV === "development"
    ? prettyTarget
    : undefined;

export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  transport: loggerTransport,
});

/** A named child logger — every line carries its module. */
export const createLogger = (module: string) => logger.child({ module });
