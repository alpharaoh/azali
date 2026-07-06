import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionQueryOptions } from "#/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    // Shares the react-query cache with the dashboard/login guards, so a hard
    // refresh resolves the session once instead of per-route.
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions);
    throw redirect({ to: session ? "/dashboard" : "/login" });
  },
});
