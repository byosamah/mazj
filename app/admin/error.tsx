"use client";

import Link from "next/link";
import { useEffect } from "react";

// File by file, not through the barrel: see the note in
// `(protected)/error.tsx`. This boundary must not depend on 22 modules.
import { Btn } from "@/components/admin/Btn";
import { ErrorState } from "@/components/admin/ErrorState";
import { Handle } from "@/components/admin/Handle";
import { PageHead } from "@/components/admin/PageHead";

/**
 * The outer boundary, for a throw that `(protected)/error.tsx` cannot catch.
 *
 * An error boundary catches its CHILDREN, never its own layout, so a throw
 * inside `(protected)/layout.tsx` (the guard, or the nav counts read beside it)
 * passes straight over the inner boundary and lands here. That is also why this
 * screen carries no rail: the layout that draws the rail is the thing that
 * failed, so drawing one would be a claim about a component that never ran.
 *
 * It still renders under `app/admin/layout.tsx`, which is what keeps the cream
 * background, Thmanyah and the admin's tokens. Below this file there is only
 * `app/global-error.tsx`, which replaces the root layout with system fonts and
 * a link to the public marketing site.
 *
 * 🔴 The thrown error's own text is never rendered here either. Same reason as
 * the inner boundary (and the same reason this sentence does not name the
 * property: an enforcement grep asserts zero hits of it in this tree). It
 * matters more at this level, because a failure in the guard is the failure
 * most likely to be seen by someone who is not signed in.
 *
 * The `<main id="content">` is this file's own, not a duplicate. The skip link
 * in the root layout points at `#content`, and the layout that normally
 * provides that landmark is precisely what did not render.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mazj-admin] outer boundary", error.digest ?? "", error);
  }, [error]);

  return (
    <main
      id="content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[1120px] px-6 pb-16 pt-8 md:px-8 lg:px-10 lg:pt-12"
    >
      <div className="space-y-10">
        <PageHead
          eyebrow="SOMETHING STOPPED"
          title="This screen could not load"
        />
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
                <Btn variant="quiet" asChild>
                  <Link href="/admin">Back to the dashboard</Link>
                </Btn>
              </div>
            </div>
          }
        />
      </div>
    </main>
  );
}
