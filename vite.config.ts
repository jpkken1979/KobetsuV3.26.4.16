import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3026,
    proxy: {
      "/api": {
        target: "http://localhost:8026",
        changeOrigin: true,
      },
    },
  },
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !dep.includes("exceljs-") && !dep.includes("recharts-")),
    },
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts")) return "recharts";
          if (id.includes("motion")) return "motion";
          if (id.includes("@tanstack/react-router") || id.includes("@tanstack/react-query")) {
            return "tanstack";
          }
          if (id.includes("exceljs")) return "exceljs";
          return undefined;
        },
      },
    },
  },
});
