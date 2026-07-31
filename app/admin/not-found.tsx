import Link from "next/link";

import { Btn, EmptyState, PageHead } from "@/components/admin";

/**
 * An unknown `/admin/*` address.
 *
 * It exists so a mistyped admin URL lands on something built out of this
 * system (cream, Thmanyah, the display-page type ramp, a square panel) instead
 * of the framework's built-in 404, which arrives in a system font on white and
 * gives no sign that the address belonged to MAZJ's own tool at all.
 *
 * Rendered under `app/admin/layout.tsx` and nothing else, so it carries its own
 * lane and its own `<main id="content">`: the `(protected)` layout that
 * normally provides both is not in this branch of the tree, and the root
 * layout's skip link points at that id.
 *
 * Kept free of `headers()`, `cookies()` and every other dynamic API on purpose.
 * This is the one admin surface Next may render for an address that matched no
 * route, where there is no session to read and nothing worth making the page
 * dynamic for.
 */
export default function AdminNotFound() {
  return (
    <main
      id="content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[1120px] px-6 pb-16 pt-8 md:px-8 lg:px-10 lg:pt-12"
    >
      <div className="space-y-10">
        <PageHead eyebrow="NOT FOUND" title="This page does not exist" />
        <EmptyState
          message="There is no admin page at that address."
          hint="Check the address for a typo. A link from somewhere else may be out of date."
          action={
            <Btn variant="quiet" asChild>
              <Link href="/admin">Back to the dashboard</Link>
            </Btn>
          }
        />
      </div>
    </main>
  );
}
