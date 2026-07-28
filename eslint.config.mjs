import {defineConfig, globalIgnores} from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

/**
 * The frontend/backend boundary, enforced.
 *
 * `server/` is only genuinely separate from the frontend if something stops the
 * two from reaching into each other. Convention does not stop it; a reviewer at
 * 6pm on a Thursday does not stop it. A lint error does.
 *
 * Two rules, pointing in opposite directions:
 *
 *   1. Frontend code may not import the backend. A component importing a
 *      service drags the Supabase secret key into a client bundle, or at best
 *      breaks the build with a confusing `server-only` error at a distance.
 *
 *   2. Backend code may not import the frontend, React, or Next. This is the
 *      load-bearing one: it is precisely what makes `server/` liftable into its
 *      own package or its own deployed service later without a rewrite. Every
 *      framework import added here is a nail in that door.
 *
 * `app/api/**` is the one sanctioned crossing point, and route handlers there
 * are kept to a few lines each so the crossing stays narrow.
 *
 * `app/**\/_lib/**` is the second, added 2026-07-27 with the admin dashboard and
 * generalised for booking. Server Components genuinely need the backend, and
 * making them fetch their own HTTP API would mean a server calling itself over
 * the network, with an absolute URL to construct and a cookie jar to forward by
 * hand. So the crossing is a NAMED FOLDER rather than a rule-wide exemption:
 * only a `_lib` directory may import `@/server/**`, and it must export plain
 * view models and Server Actions, never re-export backend modules. The pages
 * themselves stay on the frontend side of the line.
 *
 * The underscore matters twice: Next treats `_`-prefixed folders as private so
 * `_lib` can never become a route, and the name makes the crossing obvious in a
 * diff. `import "server-only"` in the modules underneath is what stops any of
 * it reaching a client bundle if someone adds "use client" to the wrong file.
 *
 * 🔴 A `_lib` folder is therefore a privileged location. Adding one is a
 * deliberate act, not a naming convenience: anything inside it can reach the
 * Supabase secret key and the admin-scope Rekaz credential.
 */

const SERVER_IMPORT_PATTERNS = [
  {
    group: ["@/server", "@/server/**", "**/server/**"],
    message:
      "Frontend code must not import from server/. There are exactly two " +
      "sanctioned crossing points: an API route (app/api/**), or a `_lib` folder " +
      "under app/ (app/**/_lib/**) for Server Components, which must export plain " +
      "view models and Server Actions rather than re-export backend modules. " +
      "Importing a service anywhere else risks pulling the Supabase secret key " +
      "into a client bundle. See server/README.md.",
  },
];

const FRAMEWORK_IMPORT_MESSAGE =
  "server/ must not depend on the frontend framework. This is what keeps the " +
  "folder liftable into its own package or service later. If a route needs " +
  "framework types, keep them in app/api/** and pass plain Web types " +
  "(Request, Response, Headers) inwards. See server/README.md.";

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the database by `npm run db:types`. Never hand-edited, so
    // never worth linting.
    "server/supabase/types.gen.ts",
    "supabase/.temp/**",
  ]),

  // 1. Frontend may not reach into the backend.
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "i18n/**/*.{ts,tsx}",
      "proxy.ts",
    ],
    ignores: ["app/api/**", "app/**/_lib/**"],
    rules: {
      "no-restricted-imports": ["error", {patterns: SERVER_IMPORT_PATTERNS}],
    },
  },

  // 2. The backend may not reach into the frontend or its framework.
  //
  // Tests are exempt from the `@/lib/*` half only so that leads.sync.test.ts can
  // import lib/links.ts to assert the duplicated product identifiers have not
  // drifted. Test files ship to nobody, so the portability argument does not
  // apply to them.
  {
    files: ["server/**/*.ts"],
    ignores: ["server/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {name: "react", message: FRAMEWORK_IMPORT_MESSAGE},
            {name: "react-dom", message: FRAMEWORK_IMPORT_MESSAGE},
            {name: "next", message: FRAMEWORK_IMPORT_MESSAGE},
            {name: "next-intl", message: FRAMEWORK_IMPORT_MESSAGE},
          ],
          patterns: [
            {
              group: ["next/**", "next-intl/**"],
              message: FRAMEWORK_IMPORT_MESSAGE,
            },
            {
              group: [
                "@/components/**",
                "@/app/**",
                "@/lib/**",
                "@/i18n/**",
                "../components/**",
                "../app/**",
                "../lib/**",
                "../i18n/**",
              ],
              message: FRAMEWORK_IMPORT_MESSAGE,
            },
          ],
        },
      ],
    },
  },
]);
