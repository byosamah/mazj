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
    /**
     * 🔴 One test file at a time, because several of them call the LIVE Rekaz
     * production API.
     *
     * Vitest's default runs test FILES in parallel workers, and sequencing
     * calls carefully inside a file does nothing about that. Rekaz degrades
     * catastrophically under concurrency: six parallel requests made an
     * endpoint hang past two minutes having answered in 1.5s moments earlier
     * sequentially, and there is no 429 to explain why. The single existing
     * Rekaz suite already trips the client's 10s timeout occasionally; running
     * three of them at once would make that the normal outcome.
     *
     * The reason that outranks flakiness: this is the same API that serves
     * mazj.sa, where real customers are checking out. Load we point at it from
     * a test run is load pointed at somebody else's purchase.
     */
    fileParallelism: false,
  },
});
