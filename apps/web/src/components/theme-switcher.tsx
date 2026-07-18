import {
  IconMoon as IconMoonFilled,
  IconSun as IconSunFilled,
} from "@central-icons-react/square-filled-radius-0-stroke-1.5";
import {
  IconMoon,
  IconSun,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Segment } from "@heroui-pro/react";
import { type Theme, useTheme } from "#/lib/theme";

/** Filled icon for the active theme, outlined for the inactive one. */
function ThemeIcon({ isActive, theme }: { isActive: boolean; theme: Theme }) {
  if (theme === "light") {
    return isActive ? (
      <IconSunFilled className="size-3.5" />
    ) : (
      <IconSun className="size-3.5" />
    );
  }

  return isActive ? (
    <IconMoonFilled className="size-3.5" />
  ) : (
    <IconMoon className="size-3.5" />
  );
}

export function ThemeSwitcher({ readOnly = false }: { readOnly?: boolean }) {
  const { theme, setTheme } = useTheme();

  // The read-only variant renders plain spans styled with the segment BEM
  // classes so it can live inside another <button> (nested buttons are
  // invalid HTML and break hydration).
  if (readOnly) {
    return (
      <span
        aria-hidden="true"
        className="segment segment--sm pointer-events-none group-hover:bg-foreground/10"
      >
        {(["light", "dark"] as const).map((key) => (
          <span
            className="segment__item h-5! px-1.5!"
            data-selected={theme === key}
            key={key}
          >
            {theme === key && <span className="segment__indicator" />}
            <ThemeIcon isActive={theme === key} theme={key} />
          </span>
        ))}
      </span>
    );
  }

  return (
    <Segment
      aria-label="Theme"
      onSelectionChange={(key) => setTheme(key as Theme)}
      selectedKey={theme}
      size="sm"
    >
      <Segment.Item aria-label="Light" className="h-5! px-1.5!" id="light">
        <ThemeIcon isActive={theme === "light"} theme="light" />
      </Segment.Item>
      <Segment.Item aria-label="Dark" className="h-5! px-1.5!" id="dark">
        <ThemeIcon isActive={theme === "dark"} theme="dark" />
      </Segment.Item>
    </Segment>
  );
}
