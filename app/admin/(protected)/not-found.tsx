import Link from "next/link";

import { Btn, EmptyState, PageHead } from "@/components/admin";

/**
 * The boundary for every `notFound()` thrown under `(protected)/`: an event id
 * or a startup application that is not in the database.
 *
 * 🔴 It renders an `EmptyState`, never an `ErrorState`, and that choice is the
 * whole point. A record that is genuinely absent is a fact about the world; a
 * read that failed is a fact about us, and the two must never look alike. The
 * data loaders enforce the other half of that: a database failure returns a
 * discriminated result and the page renders an `ErrorState` in place, so no
 * outage can arrive at this file and be reported as "deleted".
 *
 * The way back is the dashboard rather than "the section". A `not-found.tsx`
 * receives no params and no pathname, so naming the section would mean reading
 * a request header Next does not contract, to say something the rail beside
 * this text already says correctly.
 */
export default function ProtectedAdminNotFound() {
  return (
    <div className="space-y-10">
      <PageHead eyebrow="NOT FOUND" title="This page has nothing to show" />
      <EmptyState
        message="That record is not here. It may have been deleted."
        hint="If you opened it from a list, that list was read before the record went. Open the section again to see what is there now."
        action={
          <Btn variant="quiet" asChild>
            <Link href="/admin">Back to the dashboard</Link>
          </Btn>
        }
      />
    </div>
  );
}
