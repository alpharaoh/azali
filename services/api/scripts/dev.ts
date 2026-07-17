import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { UnipileService } from "@/services/external/unipile/service";

/**
 * Dev entrypoint: starts a cloudflared quick tunnel to this machine, then
 * runs the API with API_BASE_URL pointed at the tunnel's public URL — so
 * hosted-auth callbacks and webhooks from external services can reach a
 * local dev server without any manual setup.
 *
 * The tunnel outlives `bun --watch` restarts (it wraps the watcher), and
 * everything degrades gracefully: no cloudflared binary, or an explicit
 * non-localhost API_BASE_URL in the environment, and the server just runs
 * as before.
 */

const PORT = Number(process.env.PORT ?? 3001);
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const TUNNEL_STARTUP_TIMEOUT_MS = 30_000;

function log(message: string) {
  console.log(`\x1b[36m[dev]\x1b[0m ${message}`);
}

function hasCloudflared(): boolean {
  try {
    return spawnSync("cloudflared", ["--version"]).status === 0;
  } catch {
    return false;
  }
}

/** Spawn a quick tunnel and resolve its public URL (printed on stderr). */
function startTunnel(): Promise<{ url: string; child: ChildProcess } | null> {
  const child = spawn(
    "cloudflared",
    ["tunnel", "--url", `http://localhost:${PORT}`, "--no-autoupdate"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  return new Promise((resolve) => {
    let buffer = "";
    const timeout = setTimeout(() => {
      child.kill();
      resolve(null);
    }, TUNNEL_STARTUP_TIMEOUT_MS);

    const onChunk = (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = buffer.match(TUNNEL_URL_PATTERN);
      if (match) {
        clearTimeout(timeout);
        resolve({ url: match[0], child });
      }
    };
    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.on("exit", () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

async function main() {
  // An explicit public URL (e.g. a named tunnel) always wins; the default
  // localhost value in .env means "give me a tunnel".
  const explicit = process.env.API_BASE_URL;
  const hasPublicUrl =
    explicit &&
    !explicit.includes("localhost") &&
    !explicit.includes("127.0.0.1");

  let apiBaseUrl = hasPublicUrl ? explicit : null;
  let tunnel: ChildProcess | null = null;

  if (!apiBaseUrl) {
    if (hasCloudflared()) {
      log("starting cloudflared quick tunnel...");
      const started = await startTunnel();
      if (started) {
        apiBaseUrl = started.url;
        tunnel = started.child;
        log(`tunnel ready: ${started.url} → http://localhost:${PORT}`);
        log(
          `email webhook target: ${started.url}/v1/webhooks/unipile/email (update the registration if the URL changed)`,
        );
      } else {
        log(
          "tunnel did not come up — running without a public URL; connect callbacks will not reach this machine",
        );
      }
    } else {
      log(
        "cloudflared not installed (brew install cloudflared) — running without a public URL",
      );
    }
  } else {
    log(`using explicit API_BASE_URL: ${apiBaseUrl}`);
  }

  // Point the provider's email webhook at whatever URL this boot got —
  // quick-tunnel URLs rotate, so the registration is upserted every start.
  if (apiBaseUrl) {
    try {
      const { scopedTo } = await UnipileService.syncEmailWebhook({
        requestUrl: apiBaseUrl,
      });
      log(
        scopedTo
          ? `email webhook registered for: ${scopedTo.join(", ") || "(no matching accounts yet)"}`
          : "email webhook registered for all accounts",
      );
    } catch (error) {
      log(
        `email webhook sync skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const server = spawn("bun", ["--watch", "src/main.ts"], {
    stdio: "inherit",
    // Parent-provided env wins over .env inside the child, so the tunnel
    // URL overrides the localhost placeholder.
    env: {
      ...process.env,
      ...(apiBaseUrl ? { API_BASE_URL: apiBaseUrl } : {}),
    },
  });

  const shutdown = () => {
    tunnel?.kill();
    server.kill("SIGTERM");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  server.on("exit", (code) => {
    tunnel?.kill();
    process.exit(code ?? 0);
  });
}

void main();
