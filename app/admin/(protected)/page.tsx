import { refreshDashboard } from "../_lib/actions";
import {
  loadDashboardCached,
  type ReservationView,
  type RoomOccupancy,
  type Tile,
} from "../_lib/dashboard";

/**
 * The operations dashboard.
 *
 * `force-dynamic` because the page is per-session: it reads the auth cookie and
 * must never be prerendered or shared.
 *
 * The DATA behind it is cached for 60s, which is a deliberate reversal of the
 * design's original "no caching"; `CACHE_SECONDS` in `_lib/dashboard.ts`
 * carries the measurements that forced it. The "last updated" line is what
 * keeps that honest: it reports when the data was actually assembled, not when
 * the page was rendered, so a stale figure announces itself. Refresh busts the
 * cache rather than merely re-rendering.
 */
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await loadDashboardCached();

  return (
    // A <div>, not a <main>: the layout already provides the landmark, and two
    // nested <main> elements is an a11y error that screen readers report.
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-black/50">
          Last updated{" "}
          <time dateTime={data.generatedAt}>
            {new Intl.DateTimeFormat("en-GB", {
              timeZone: "Asia/Riyadh",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }).format(new Date(data.generatedAt))}
          </time>{" "}
          Riyadh time
        </p>
        <form action={refreshDashboard}>
          <button
            type="submit"
            className="rounded-full border border-black/15 px-4 py-1.5 text-sm transition-colors hover:border-black/40 hover:bg-black/5"
          >
            Refresh
          </button>
        </form>
      </div>

      <Section title="Right now" subtitle="Rooms in use this minute">
        <TileBody tile={data.occupancy} empty="No bookable rooms found.">
          {(rooms) => (
            <div className="grid gap-4 sm:grid-cols-2">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          )}
        </TileBody>
      </Section>

      <Section title="Today" subtitle={data.today}>
        <TileBody
          tile={data.todayReservations}
          empty="No bookings today."
        >
          {(items) => <ReservationTable rows={items} showDay={false} />}
        </TileBody>
      </Section>

      <Section title="Next 7 days" subtitle="Upcoming reservations">
        <TileBody tile={data.upcoming} empty="Nothing booked in the next week.">
          {(items) => <ReservationTable rows={items} showDay />}
        </TileBody>
      </Section>

      <Section title="Subscriptions" subtitle="Members and renewals">
        <TileBody tile={data.subscriptions} empty="No subscriptions found.">
          {(subs) => (
            <div className="space-y-6">
              <div className="flex gap-10">
                <Stat label="Active" value={subs.activeCount} />
                <Stat label="All time" value={subs.totalCount} />
                <Stat
                  label="Expiring in 30 days"
                  value={subs.expiringSoon.length}
                />
              </div>

              {subs.expiringSoon.length > 0 && (
                <table className="w-full text-left text-sm">
                  <thead className="text-black/45">
                    <tr className="border-b border-black/10">
                      <Th>Code</Th>
                      <Th>Plan</Th>
                      <Th>Ends</Th>
                      <Th>Days left</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.expiringSoon.map((sub) => (
                      <tr key={sub.id} className="border-b border-black/5">
                        <Td className="font-mono text-xs">{sub.code}</Td>
                        <Td>{sub.itemName}</Td>
                        <Td>{sub.endsOn}</Td>
                        <Td>{sub.daysRemaining}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </TileBody>
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-black/45">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Renders one tile's three possible states.
 *
 * 🔴 A failed tile and an empty tile are rendered DIFFERENTLY, always. "No
 * bookings today" and "we could not reach Rekaz" are the same shape on screen
 * if you let them be, and they mean opposite things: one says go home, the
 * other says something is broken. Collapsing them into a zero is the single
 * easiest way to make an operations dashboard actively harmful.
 */
function TileBody<T>({
  tile,
  empty,
  children,
}: {
  tile: Tile<T>;
  empty: string;
  children: (data: T) => React.ReactNode;
}) {
  if (!tile.ok) {
    return (
      <div className="rounded-xl border border-orange/30 bg-orange/5 px-5 py-4 text-sm">
        <p className="font-medium text-orange">Could not load</p>
        <p className="mt-1 text-black/60">{tile.message}</p>
      </div>
    );
  }

  if (Array.isArray(tile.data) && tile.data.length === 0) {
    return (
      <p className="rounded-xl border border-black/10 px-5 py-4 text-sm text-black/45">
        {empty}
      </p>
    );
  }

  return <>{children(tile.data as never)}</>;
}

function RoomCard({ room }: { room: RoomOccupancy }) {
  const busy = room.occupiedBy !== null;

  return (
    <div
      className={`rounded-xl border px-5 py-4 ${
        busy ? "border-orange/40 bg-orange/5" : "border-black/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{room.name}</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs ${
            busy ? "bg-orange text-white" : "bg-black/5 text-black/50"
          }`}
        >
          {busy ? "In use" : "Free"}
        </span>
      </div>

      {room.occupiedBy && (
        <p className="mt-2 text-sm text-black/60">
          {room.occupiedBy.startTime} to {room.occupiedBy.endTime}
          {room.occupiedBy.customerName
            ? ` with ${room.occupiedBy.customerName}`
            : ""}
        </p>
      )}
    </div>
  );
}

function ReservationTable({
  rows,
  showDay,
}: {
  rows: ReservationView[];
  showDay: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead className="text-black/45">
          <tr className="border-b border-black/10">
            {showDay && <Th>Day</Th>}
            <Th>Time</Th>
            <Th>Space</Th>
            <Th>Customer</Th>
            <Th>Status</Th>
            <Th>Payment</Th>
            <Th>Ref</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-black/5">
              {showDay && (
                <Td className="whitespace-nowrap text-black/60">
                  {row.weekday} {row.day.slice(5)}
                </Td>
              )}
              <Td className="whitespace-nowrap font-medium">
                {row.startTime} to {row.endTime}
              </Td>
              <Td>
                {row.productName}
                <span className="block text-xs text-black/40">
                  {row.priceName}
                </span>
              </Td>
              {/* An empty customer name means a walk-in booked at the desk, not
                  a missing record. Saying so beats an unexplained blank cell. */}
              <Td>{row.customerName ?? <em className="text-black/35">Walk-in</em>}</Td>
              <Td>{row.status}</Td>
              <Td className="text-black/60">{row.paymentStatus ?? "-"}</Td>
              <Td className="font-mono text-xs text-black/40">
                {row.reservationNumber}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-sm text-black/45">{label}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 pr-4 font-normal">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`py-2.5 pr-4 align-top ${className}`}>{children}</td>;
}
