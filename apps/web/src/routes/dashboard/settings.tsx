import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "#/components/page-placeholder";
import { ThemeSwitcher } from "#/components/theme-switcher";

export const Route = createFileRoute("/dashboard/settings")({
  component: Settings,
});

function Settings() {
  return (
    <>
      <PagePlaceholder
        description="Roles and licensed-broker sign-off authority, plus autonomy thresholds — what confidence level auto-files versus what queues for human review."
        title="Settings"
      />
      <div className="p-4 pt-0">
        <div className="border-border flex max-w-md items-center justify-between gap-4 rounded-lg border p-4">
          <div>
            <p className="text-foreground text-sm font-medium">Theme</p>
            <p className="text-muted mt-0.5 text-xs">
              Switch between light and dark mode.
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </div>
    </>
  );
}
