import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
// import { TanStackDevtools } from "@tanstack/react-devtools";
// import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import "../styles.css";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      {/* <TanStackDevtools */}
      {/* 	config={{ */}
      {/* 		position: "bottom-right", */}
      {/* 	}} */}
      {/* 	plugins={[ */}
      {/* 		{ */}
      {/* 			name: "TanStack Router", */}
      {/* 			render: <TanStackRouterDevtoolsPanel />, */}
      {/* 		}, */}
      {/* 	]} */}
      {/* /> */}
    </>
  );
}
