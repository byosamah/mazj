"use server";

import {headers} from "next/headers";

import {clientIp} from "@/server/core/request";
import {registerForEvent} from "@/server/services/event-registration";

/**
 * The event registration form's write path.
 *
 * A Server Action rather than an API route, matching the booking flow: the form
 * works without hand-written fetch plumbing and there is exactly one way in.
 * Everything security-relevant is one layer down in
 * `server/services/event-registration.ts`: rate limiting on two dimensions, the
 * atomic seat claim, and the refusal of any event that sells a ticket. This file
 * translates `FormData` and nothing else.
 *
 * 🔴 Notice what is NOT accepted from the browser: no price, no amount, no seat
 * count, no event id. The client names an event by its public slug and says who
 * it is. Everything that consumes capacity is resolved here.
 *
 * ⚠️ This action no longer has a money path at all. A paid event is bought on
 * the Rekaz storefront (owner decision 2026-07-30), and the service refuses a
 * ticketed slug, so this endpoint cannot be used to take a free seat at one.
 */

/**
 * 🔴 Carries an error CODE, never a message.
 *
 * `AppError.message` on this path can be assembled from Rekaz's raw response
 * body, which arrives as RFC 9110 ProblemDetails **in Arabic** regardless of
 * `Accept-Language`, alongside their traceId and our own internal path.
 * `toPublicError` exists to strip exactly that, but it is wired into `route()`,
 * which a Server Action never passes through, and Next redacts THROWN errors
 * rather than RETURNED action values. So a returned message serialises to the
 * browser verbatim. This exact leak shipped once already, on the booking form.
 *
 * Returning a code means the page renders its own copy, from
 * `messages/*.json`, in the reader's own language.
 */
export type RegistrationFormState =
  | {status: "idle"}
  | {
      status: "error";
      code: string;
      field?: string;
      /**
       * Narrows a `conflict`, which covers three situations needing three
       * different sentences: the event closed, the last seat went, or the event
       * sells a ticket and is therefore not registered for here at all. The page
       * renders `error.conflict_<reason>`.
       */
      reason?: string;
    }
  /** On the list. Nothing further to do. */
  | {status: "confirmed"; seatsLeft: number | null}
  /** They were already registered. Good news, not an error. */
  | {status: "already_registered"};

export async function submitRegistration(
  _previous: RegistrationFormState,
  formData: FormData
): Promise<RegistrationFormState> {
  const requestHeaders = await headers();

  const result = await registerForEvent({
    eventSlug: String(formData.get("eventSlug") ?? ""),
    locale: String(formData.get("locale") ?? "en"),
    customer: {
      name: String(formData.get("name") ?? ""),
      mobile: String(formData.get("mobile") ?? ""),
      email: str(formData.get("email")),
    },
    // `{ip, attested}`, never a bare string: whether the platform vouched for
    // the address decides how much the rate limiter and the audit trail are
    // entitled to believe it.
    ip: clientIp(requestHeaders),
  });

  if (!result.ok) {
    const fields = result.error.fields;
    const reason = fields?.reason;

    return {
      status: "error",
      code: result.error.code,
      // `reason` is carried in `fields` but is not a form field, so it must not
      // be reported as one: highlighting an input called "reason" would put a
      // red ring on nothing.
      field: fields
        ? Object.keys(fields).find((k) => k !== "reason")
        : undefined,
      ...(reason ? {reason} : {}),
    };
  }

  switch (result.value.kind) {
    case "confirmed":
      return {status: "confirmed", seatsLeft: result.value.seatsLeft};
    case "already_registered":
      return {status: "already_registered"};
  }
}

function str(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
