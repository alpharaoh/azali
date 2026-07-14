import { Chip } from "@heroui/react";
import type { CSSProperties } from "react";

/**
 * Where between warning (amber) and success (green) this confidence sits:
 * 70% and below is pure warning, 95%+ is pure success, and everything in
 * between blends smoothly through the yellow-greens (oklch hue interpolation).
 */
function successShare(confidence: number) {
  const t = (confidence - 0.7) / (0.95 - 0.7);
  return Math.round(Math.min(Math.max(t, 0), 1) * 100);
}

/** A soft chip whose color is a continuous spectrum over the confidence.
 * Built from the theme's own warning/success vars so both endpoints match
 * regular soft chips in light and dark mode. */
export function ConfidenceChip({
  confidence,
  label,
  size = "sm",
}: {
  confidence: number;
  /** Suffix after the percentage, e.g. "confident". Omit for bare "84%". */
  label?: string;
  size?: "sm" | "md";
}) {
  const share = successShare(confidence);

  return (
    <Chip
      size={size}
      style={
        {
          "--chip-bg": `color-mix(in oklch, var(--success-soft) ${share}%, var(--warning-soft))`,
          "--chip-fg": `color-mix(in oklch, var(--success-soft-foreground) ${share}%, var(--warning-soft-foreground))`,
        } as CSSProperties
      }
      variant="soft"
    >
      <Chip.Label>
        {Math.round(confidence * 100)}%{label ? ` ${label}` : ""}
      </Chip.Label>
    </Chip>
  );
}
