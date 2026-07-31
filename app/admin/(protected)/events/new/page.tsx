import {PageHead} from "@/components/admin";

import {requireAdmin} from "../../../_lib/auth";
import {loadTicketOptions} from "../../../_lib/events";
import {EventCrumbs} from "../EventCrumbs";
import EventForm from "../EventForm";

/**
 * Creating an event.
 *
 * `force-dynamic` because it reads the auth cookie AND the live Rekaz catalog,
 * so a prerendered copy would offer yesterday's ticket prices to today's
 * publisher.
 */
export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  // 🔴 The guard sits above the first data read, not only in the layout. See
  // the note on the events list page: a layout `redirect()` does not stop this
  // component rendering, and `loadTicketOptions` reaches the Rekaz catalog with
  // an admin-scope credential.
  const admin = await requireAdmin();
  const {options, reachable} = await loadTicketOptions(admin);

  return (
    <div className="space-y-10 lg:space-y-12">
      <PageHead
        back={<EventCrumbs current="New event" />}
        eyebrow="PROGRAMME · EVENTS"
        title="New event"
        lede="Save it as a draft while you write it. It appears on the site the moment you set it to published."
      />
      <EventForm ticketOptions={options} rekazReachable={reachable} />
    </div>
  );
}
