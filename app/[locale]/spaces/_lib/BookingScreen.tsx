import {getTranslations, setRequestLocale} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import BookingFlow from "@/components/booking/BookingFlow";

import {loadBookableSpace} from "./booking";

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
