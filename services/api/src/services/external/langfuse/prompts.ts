import type { TextPromptClient } from "@langfuse/client";
import { langfuse } from "./client";

export interface ResolvedPrompt {
  text: string;
  /** The Langfuse prompt for trace linking; null when running on fallback. */
  prompt: TextPromptClient | null;
}

/**
 * Fetch a text prompt from Langfuse Prompt Management (label: latest) and
 * compile its {{variables}}. The hardcoded fallback keeps the app working
 * when Langfuse is unreachable or unconfigured.
 */
export async function resolvePrompt(
  name: string,
  fallback: string,
  variables?: Record<string, string>,
): Promise<ResolvedPrompt> {
  if (langfuse) {
    try {
      const prompt = await langfuse.prompt.get(name, {
        label: "latest",
        type: "text",
        fallback,
      });
      return {
        text: prompt.compile(variables),
        // Only link real prompt versions to traces — never the fallback.
        prompt: prompt.isFallback ? null : prompt,
      };
    } catch {
      // Fall through to the local template.
    }
  }

  const text = fallback.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => variables?.[key] ?? "",
  );
  return { text, prompt: null };
}
