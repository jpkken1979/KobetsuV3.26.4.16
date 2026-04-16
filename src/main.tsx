import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { routeTree } from "./routeTree.gen";
// Self-hosted fonts — no Google Fonts CDN dependency
// @ts-expect-error fontsource side-effect imports have no type declarations
import "@fontsource-variable/space-grotesk";
// @ts-expect-error fontsource side-effect imports have no type declarations
import "@fontsource-variable/jetbrains-mono";
// @ts-expect-error fontsource side-effect imports have no type declarations
import "@fontsource-variable/noto-sans-jp";
// @ts-expect-error fontsource side-effect imports have no type declarations
import "@fontsource-variable/noto-serif-jp";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            className: "font-sans",
            duration: 3000,
          }}
        />
      </QueryClientProvider>
    </React.StrictMode>
  );
}
