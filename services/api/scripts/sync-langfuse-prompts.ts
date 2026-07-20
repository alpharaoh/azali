/**
 * Upload the code-fallback prompts to Langfuse Prompt Management.
 *
 *   bun run scripts/sync-langfuse-prompts.ts           # create missing only
 *   bun run scripts/sync-langfuse-prompts.ts --force   # push new versions too
 *
 * Default mode only CREATES prompts that don't exist in Langfuse yet — it
 * never overwrites a prompt the team has edited there (pushing the code
 * fallback would move the "latest" label back onto it). --force pushes a
 * new version of every registered prompt whose live text differs from the
 * code fallback.
 */
import {
  CLASSIFICATION_PROMPT_NAME,
  CLASSIFICATION_SYSTEM_PROMPT,
} from "@/services/agents/classification/prompt";
import {
  PGA_PROMPT_NAME,
  PGA_SYSTEM_PROMPT,
  PGA_TRIAGE_PROMPT,
  PGA_TRIAGE_PROMPT_NAME,
} from "@/services/agents/pga/prompt";
import { langfuse } from "@/services/external/langfuse/client";

const REGISTRY: Array<{ name: string; text: string }> = [
  { name: CLASSIFICATION_PROMPT_NAME, text: CLASSIFICATION_SYSTEM_PROMPT },
  { name: PGA_PROMPT_NAME, text: PGA_SYSTEM_PROMPT },
  { name: PGA_TRIAGE_PROMPT_NAME, text: PGA_TRIAGE_PROMPT },
];

const force = process.argv.includes("--force");

async function main() {
  if (!langfuse) {
    throw new Error(
      "LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are not set — cannot sync",
    );
  }

  for (const { name, text } of REGISTRY) {
    let existing: string | null = null;
    try {
      const prompt = await langfuse.prompt.get(name, {
        label: "latest",
        type: "text",
      });
      existing = prompt.prompt;
    } catch {
      // Not found — create below.
    }

    if (existing !== null && !force) {
      console.log(`= ${name} — exists in Langfuse, leaving as-is`);
      continue;
    }
    if (existing === text) {
      console.log(`= ${name} — live version already matches the code fallback`);
      continue;
    }

    await langfuse.prompt.create({
      name,
      type: "text",
      prompt: text,
      labels: ["latest", "production"],
    });
    console.log(
      existing === null
        ? `+ ${name} — created`
        : `^ ${name} — new version pushed (--force)`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
