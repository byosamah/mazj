import path from "node:path";

import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      /**
       * `server-only` throws on import outside a React Server Component, which
       * would break every test that touches a module holding secrets, i.e. most
       * of the backend. The package ships an empty module for exactly this
       * purpose (its `react-server` export condition points at it), so we alias
       * straight to that file. Aliasing rather than adding a resolve condition
       * because conditions interact with Vite's SSR resolution in ways that
       * change between versions; a file path does not.
       */
      "server-only": path.resolve(root, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // Integration tests hit a real database across the internet from Saudi
    // Arabia. The default 5s is not generous enough for a cold connection.
    testTimeout: 20_000,
  },
});
