import {getTranslations, setRequestLocale} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import BookingFlow from "@/components/booking/BookingFlow";

import {loadBookableSpace} from "./booking";

/**
 * Labels already complained about, so a `force-dynamic` page does not write the
 * same line on every view. One per missing label per process is enough to notice
 * and not enough to bury anything else.
 */
const reported = new Set<string>();

/**
 * Rekaz's file-upload field type.
 *
 * Named here because the warning below has to skip it: `BookingFlow` refuses to
 * render a file field at all (Rekaz publishes no upload endpoint), so a missing
 * English label for one is not a defect, and asking for a key no component reads
 * would just plant an orphan in both message files.
 */
const REKAZ_FILE_FIELD = 10;

/**
 * 🔴 `console.warn`, deliberately, and NOT `server/core/logger`'s `log.warn`.
 *
 * That logger redacts any field whose name CONTAINS `name` or `key`, as a
 * case-insensitive substring at every depth. The two strings this warning exists
 * to carry are a Rekaz field `name` and the message KEY it maps to, so the
 * structured version of this line would print `[redacted]` twice and say nothing
 * at all. The same trap already cost `booking.indeterminate_mark_failed` a
 * field. Nothing is lost by staying out of the redacting path here: a price id
 * and a form label are catalog metadata, not personal data.
 *
 * `[mazj]` matches the prefix the two error boundaries already use.
 */
function reportMissingLabel(
  space: string,
  namespace: string,
  key: string,
  rekazLabel: string
): void {
  const identity = `${namespace}.${key}`;
  if (reported.has(identity)) return;
  reported.add(identity);

  console.warn(
    `[mazj] booking label missing: add "${key}" to ${namespace} in ` +
      `messages/en.json and messages/ar.json. Until then ` +
      `/spaces/${space}/book renders Rekaz's own label ("${rekazLabel}") in ` +
      `both locales.`
  );
}

/**
 * The shared body of all four `/spaces/<space>/book` pages.
 *
 * Lives in `_lib` because it is the only server component that may reach the
 * Rekaz catalog; the four route files underneath are three lines each and stay
 * on the frontend side of the boundary.
 *
 * 🔴 Renders an honest failure rather than a 500 when Rekaz is unreachable.
 * `loadBookableSpace` returns null in that case, and the visitor is offered the
 * WhatsApp route instead. A booking page that 500s takes the sale AND the trust;
 * one that says "we cannot take bookings online right now, message us" keeps the
 * second.
 */
export default async function BookingScreen({
  locale,
  space,
}: {
  locale: string;
  space: string;
}) {
  setRequestLocale(locale);
  const t = await getTranslations("Booking");
  const bookable = await loadBookableSpace(space);

  // 🔴 REK-040. Both label lookups in this flow fall back to Rekaz's own string,
  // and Rekaz's strings are Arabic for this tenant. The fallback itself is right:
  // a blank question is worse than one in the wrong language, and the events
  // hall's questions are the last thing a buyer reads before paying. What was
  // wrong is that it happened in total silence. An English visitor could reach
  // the payment step and find the hall asking "كم عدد الحضور؟", with no error and
  // nothing in any log, until somebody happened to open the page in English.
  //
  // Checked on the SERVER, so the complaint lands in the deployment's logs rather
  // than in one visitor's console where nobody will ever read it. Prices are
  // checked in the same pass because `PriceCard` has the identical fallback one
  // component away and would otherwise be found the same expensive way.
  if (bookable) {
    for (const price of bookable.prices) {
      if (!t.has(`price.${price.immutableId}`)) {
        reportMissingLabel(space, "Booking.price", price.immutableId, price.labelAr);
      }
    }
    for (const custom of bookable.customFields) {
      if (custom.type === REKAZ_FILE_FIELD) continue;
      if (!t.has(`customField.${custom.name}`)) {
        reportMissingLabel(space, "Booking.customField", custom.name, custom.label);
      }
    }
  }

  return (
    <main
      id="content"
      tabIndex={-1}
      // Top padding clears the fixed site header, which otherwise lands on the
      // back link. Matches the offset the other routes use.
      className="mx-auto max-w-3xl px-6 pb-24 pt-32 sm:pt-36"
    >
      <Link
        href={`/spaces/${space}`}
        className="text-sm text-black/50 underline-offset-4 hover:underline"
      >
        {t("back")}
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        {t(`space.${space}`)}
      </h1>

      {!bookable || bookable.isOutOfStock ? (
        <div className="mt-8 rounded-xl border border-black/10 px-6 py-5">
          <p>{t("unavailable")}</p>
        </div>
      ) : (
        <div className="mt-10">
          <BookingFlow space={bookable} />
        </div>
      )}
    </main>
  );
}
