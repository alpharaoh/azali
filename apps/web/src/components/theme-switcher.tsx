import { cn, Segment } from "@heroui-pro/react";
import { type Theme, useTheme } from "#/lib/theme";

export function ThemeSwitcher({ readOnly = false }: { readOnly?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <Segment
      aria-label="Theme"
      className={cn(
        readOnly && "pointer-events-none group-hover:bg-foreground/10",
      )}
      onSelectionChange={(key) => setTheme(key as Theme)}
      selectedKey={theme}
      size="sm"
    >
      <Segment.Item aria-label="Light" className="h-5! px-1.5!" id="light">
        <SunIcon />
      </Segment.Item>
      <Segment.Item aria-label="Dark" className="h-5! px-1.5!" id="dark">
        <MoonIcon />
      </Segment.Item>
    </Segment>
  );
}

function SunIcon() {
  return (
    <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
      <path d="M12 19a1 1 0 0 1 .993.883L13 20v1a1 1 0 0 1-1.993.117L11 21v-1a1 1 0 0 1 1-1m6.313-2.09l.094.083l.7.7a1 1 0 0 1-1.32 1.497l-.094-.083l-.7-.7a1 1 0 0 1 1.218-1.567zm-11.306.083a1 1 0 0 1 .083 1.32l-.083.094l-.7.7a1 1 0 0 1-1.497-1.32l.083-.094l.7-.7a1 1 0 0 1 1.414 0M4 11a1 1 0 0 1 .117 1.993L4 13H3a1 1 0 0 1-.117-1.993L3 11zm17 0a1 1 0 0 1 .117 1.993L21 13h-1a1 1 0 0 1-.117-1.993L20 11zM6.213 4.81l.094.083l.7.7a1 1 0 0 1-1.32 1.497l-.094-.083l-.7-.7A1 1 0 0 1 6.11 4.74zm12.894.083a1 1 0 0 1 .083 1.32l-.083.094l-.7.7a1 1 0 0 1-1.497-1.32l.083-.094l.7-.7a1 1 0 0 1 1.414 0M12 2a1 1 0 0 1 .993.883L13 3v1a1 1 0 0 1-1.993.117L11 4V3a1 1 0 0 1 1-1m0 5a5 5 0 1 1-4.995 5.217L7 12l.005-.217A5 5 0 0 1 12 7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
      <path d="M12 1.992a10 10 0 1 0 9.236 13.838c.341-.82-.476-1.644-1.298-1.31a6.5 6.5 0 0 1-6.864-10.787l.077-.08c.551-.63.113-1.653-.758-1.653h-.266l-.068-.006z" />
    </svg>
  );
}
