import { MagicWand } from "@gravity-ui/icons";
import { Alert } from "@heroui/react";

/**
 * Banner shown on pages that are demo-only — the feature isn't live yet, so
 * the page renders illustrative data and points users at their business
 * representative to unlock it.
 */
export function DemoPreviewBanner({ description }: { description: string }) {
  return (
    <Alert
      className="border border-[var(--accent-soft-foreground)]/20 bg-[var(--accent-soft)]"
      status="accent"
    >
      <Alert.Indicator>
        <MagicWand />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>Demo preview</Alert.Title>
        <Alert.Description>{description}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
