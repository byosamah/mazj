import { LoadingLane, PageHead } from "@/components/admin";

/**
 * The startups queue's loading boundary.
 *
 * Six rows: this list is deliberately uncached (a decision made seconds ago
 * must be visible), so it is read fresh on every visit and the wait is real
 * even though the query is cheap.
 */
export default function AdminStartupsLoading() {
  return (
    <div className="space-y-10">
      <PageHead eyebrow="PROGRAMME" title="Startups" />
      <LoadingLane rows={6} label="the startups queue" />
    </div>
  );
}
