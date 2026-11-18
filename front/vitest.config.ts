import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // « server-only » lève une erreur hors bundle serveur Next ; en test on charge sa version vide.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});
