import { LoadingLane, PageHead } from "@/components/admin";

/**
 * The event editor's loading boundary, and the one that earns its keep most.
 *
 * This page awaits a LIVE Rekaz call on every render, to resolve the ticket
 * price against the catalog, so it is slow every single time rather than only
 * on a cold cache.
 *
 * 🔴 The title is the generic "Event", not the record's name. A boundary
 * renders before the read that would tell us the name, so any specific title
 * here would be invented. The eyebrow carries the real position in the tree
 * ("PROGRAMME · EVENTS", the same string the page itself uses), and the page
 * replaces the word "Event" with the actual title the moment it has one.
 */
export default function AdminEventDetailLoading() {
  return (
    <div className="space-y-10">
      <PageHead eyebrow="PROGRAMME · EVENTS" title="Event" />
      <LoadingLane rows={8} label="this event" />
    </div>
  );
}
