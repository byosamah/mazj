import { LoadingLane, PageHead } from "@/components/admin";

/**
 * The events list's loading boundary.
 *
 * Eight rows rather than six because this list is the long one: the archive
 * alone holds 41 rows. A skeleton much shorter than the content that replaces
 * it reads as "nearly done" and then jumps.
 *
 * ⚠️ A `loading.tsx` covers its segment AND its children, so this also shows
 * for `/admin/events/new` until that page's own head arrives. That is accepted:
 * "Events" is true of the new-event form as well, and the alternative is a
 * fourth boundary asserting a title for a record that does not exist yet.
 */
export default function AdminEventsLoading() {
  return (
    <div className="space-y-10">
      <PageHead eyebrow="PROGRAMME" title="Events" />
      <LoadingLane rows={8} label="the events list" />
    </div>
  );
}
