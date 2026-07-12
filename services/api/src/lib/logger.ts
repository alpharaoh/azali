import { pino } from "pino";
import { env } from "@/env";

/**
 * The process-wide structured logger for code that runs outside a request
 * (agents, Inngest functions, background services). HTTP request logging is
 * handled separately by nestjs-pino in app.module.ts — keep the two configs
 * aligned: pretty locally, JSON in production.
 */
export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            singleLine: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

/** A named child logger — every line carries its module. */
export const createLogger = (module: string) => logger.child({ module });
