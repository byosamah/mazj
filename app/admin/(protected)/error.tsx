"use client";

import Link from "next/link";
import { useEffect } from "react";

// Imported file by file rather than through `@/components/admin`, on purpose.
// This is a client boundary, so anything the barrel re-exports is a candidate
// for this chunk, and one primitive ever reaching for `next/headers` or `_lib`
// would break the build of the screen that exists to survive a break.
import { Btn } from "@/components/admin/Btn";
import { ErrorState } from "@/components/admin/ErrorState";
import { Handle } from "@/components/admin/Handle";
import { PageHead } from "@/components/admin/PageHead";

/**
 * The admin's error boundary, and the first one that keeps the admin looking
 * like the admin.
 *
 * It renders INSIDE `(protected)/layout.tsx`, so the rail, the nav and Sign out
 * all survive: the operator can leave for a section that still works instead of
 * being dropped onto the public marketing site. Until this file existed, every
 * uncaught throw escaped to `app/global-error.tsx`, which REPLACES the root
 * layout, is deliberately styleless (system fonts, no Tailwind, no Thmanyah)
 * and links to `/`. The admin visually ceased to exist and nothing said which
 * section had died.
 *
 * 🔴 The thrown error's own text is NEVER rendered, and that is not caution
 * about ugliness. It can carry a database hostname, a fragment of a query, a
 * Rekaz field name in Arabic, or the shape of a credential. This is the one
 * admin screen a stranger might reach if a guard ever fails, so that text stays
 * on the server and only `digest`, an opaque hash Next generates for the
 * purpose, crosses to the browser. The same repo has already shipped an
 * upstream string to a browser once, on a public booking form.
 *
 * ⚠️ `test/admin-page-guards.test.ts` asserts zero `error.message` in THIS
 * FILE, reading the comment-stripped copy, so the constraint is on the code and
 * this paragraph can name the property.
 *
 * Not tree-wide, and the narrowing is measured rather than timid:
 * `(protected)/startups/page.tsx` renders `queue.error.message` legitimately,
 * because that string is a sentence authored for a human in `_lib/startups.ts`
 * rather than an upstream one, so a rule over `app/admin` would be red today
 * for a correct file. Until 2026-07-29 this sentence claimed the tree-wide
 * shape, told the next author not to reword it, and no such assertion existed.
 *
 * "Nothing was changed" is a promise this boundary can actually keep: a page
 * render that throws is a READ. Every write in the admin is a Server Action or
 * a route handler, and neither is caught here.
 */
export default function ProtectedAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production Next strips the real message and stack from the client
    // bundle, so the digest is the only handle that matches this screen to a
    // line in the server log. Logging it is what makes the sentence below
    // ("the detail is in the server log against this request's trace id")
    // true rather than aspirational.
    console.error("[mazj-admin] boundary", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="space-y-10">
      <PageHead eyebrow="SOMETHING STOPPED" title="This screen could not load" />
      <ErrorState
        title="This section stopped"
        message="Nothing was changed."
        next="The detail is in the server log against this request's trace id."
        retry={
          <div className="space-y-4">
            {error.digest ? (
              <p>
                <Handle size="sm" selectAll>
                  Trace {error.digest}
                </Handle>
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Btn type="button" variant="solid" onClick={reset}>
                Try again
              </Btn>
              {/* next/link, never the locale-aware Link from the i18n helpers:
                  that one prepends /en or /ar, and `/en/admin` does not exist
                  because proxy.ts keeps admin out of next-intl's matcher.
                  (Naming that import path here would trip the enforcement grep
                  that asserts zero of them.) The comment sits OUTSIDE the
                  `asChild` slot on purpose: that slot takes exactly one child,
                  and this repo has broken its build three times on JSX comment
                  placement. */}
              <Btn variant="quiet" asChild>
                <Link href="/admin">Back to the dashboard</Link>
              </Btn>
            </div>
          </div>
        }
      />
    </div>
  );
}
