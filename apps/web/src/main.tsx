import { Button, Spinner } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { queryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";

/** Shown while route guards resolve (e.g. the session check on a hard refresh). */
function RouterPending() {
  return (
    <div className="bg-background flex h-dvh w-full items-center justify-center">
      <Spinner aria-label="Loading" size="lg" />
    </div>
  );
}

function RouterError() {
  return (
    <div className="bg-background flex h-dvh w-full flex-col items-center justify-center gap-3">
      <p className="text-foreground text-sm font-medium">
        Something went wrong while loading Azali.
      </p>
      <p className="text-muted text-xs">Check your connection and try again.</p>
      <Button size="sm" onPress={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  );
}

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // Let react-query own staleness: always run loaders on preload and let
  // ensureQueryData/prefetchQuery decide whether to hit the network.
  defaultPreloadStaleTime: 0,
  defaultPendingComponent: RouterPending,
  defaultErrorComponent: RouterError,
  // Show the pending screen quickly on blocking loads (default is a full
  // second of blank page), but keep it up long enough to not flash.
  defaultPendingMs: 200,
  defaultPendingMinMs: 300,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// biome-ignore lint/style/noNonNullAssertion: element is guaranteed by index.html
const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
