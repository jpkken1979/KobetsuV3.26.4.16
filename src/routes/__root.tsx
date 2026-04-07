import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { RootLayout } from "@/components/layout/root-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <RootLayout>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </RootLayout>
  ),
});
