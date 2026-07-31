import { redirect } from "next/navigation";

import { Eyebrow, StatusDot } from "@/components/admin";

import { getAdminUser, isSignedInAdmin, type AdminSession } from "../_lib/auth";
import { adminEnvironment } from "../_lib/env-marker";
import LoginForm, { type LoginArrival } from "./LoginForm";

/**
 * The sign-in page, and the first screen anybody sees.
 *
 * Sits OUTSIDE the `(protected)` route group, so it renders for anonymous
 * visitors. Inside the group, the guard would bounce an anonymous visitor here,
 * and rendering here would bounce them again, forever.
 *
 * It does check for an existing session in the other direction: someone already
 * signed in who lands here should go to the dashboard rather than be asked to
 * sign in again. The one exception is somebody who just pressed Sign out, which
 * is the whole reason `?bye=1` exists. See `arrivalOf`.
 */
export const dynamic = "force-dynamic";

/**
 * 🔴 CORAL USE #1 OF 2 IN THE ENTIRE ADMIN: the مزج wordmark.
 *
 * Masked over a solid fill rather than tinted, so the colour is exactly
 * `#FF5A48` and not an approximation of it. The idiom already ships in
 * `components/FoundingBand.tsx:44-58`, and there is no icon-only MAZJ symbol:
 * the wordmark PNG is the only mark, and its transparent alpha is what makes
 * this work at all. The rail carries the same mark at 22x30; this one is the
 * only thing on the screen that says whose tool this is, so it is larger.
 */
const WORDMARK: React.CSSProperties = {
  backgroundColor: "#FF5A48",
  WebkitMaskImage: "url(/logos/mazj-wordmark.png)",
  maskImage: "url(/logos/mazj-wordmark.png)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskPosition: "left",
  maskPosition: "left",
};

/**
 * A query value is `string | string[]` when the parameter repeats, so every
 * read narrows first. `?error=1&error=2` then simply fails to match a literal,
 * which is the right failure: no notice at all beats a notice chosen by
 * somebody crafting a URL.
 */
function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Which fixed sentence this arrival deserves, resolved against the LIVE session
 * rather than against the query alone.
 *
 * 🔴 `?bye=1` is not evidence that anything happened. `signOut()` sends the
 * visitor here after calling Supabase, and the failure mode that made this
 * necessary is a sign-out that silently did not take: the login form rendered,
 * then the next click bounced straight back to the dashboard, which reads as
 * "the button is broken" rather than "you are still signed in". So the page
 * asks the auth server, and answers with what it was told:
 *
 *   still a valid session  -> say so, and offer the retry
 *   no verdict either way  -> say we could not confirm it, and offer the retry
 *   no session             -> "You are signed out."
 *
 * The middle branch is the one worth defending. Reporting "You are signed out"
 * when Supabase never answered is the same collapse `AdminSessionProblem` exists
 * to end, and here it fails in the expensive direction: somebody walks away from
 * a shared machine believing a session ended that may not have.
 */
function arrivalOf(
  session: AdminSession,
  saidBye: boolean,
  state: string | undefined
): LoginArrival | null {
  if (saidBye) {
    if (isSignedInAdmin(session)) return "sign-out-failed";
    if (session === "unavailable") return "sign-out-unconfirmed";
    return "signed-out";
  }

  // Fixed literals only, matching `LOGIN_DESTINATION` in `_lib/auth.ts`.
  // Anything else is treated as no arrival at all.
  if (state === "outage") return "outage";
  if (state === "revoked") return "revoked";
  if (state === "expired") return "expired";
  return null;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 🔴 Narrowed, never a truthy test. `getAdminUser()` answers WHY there is no
  // session, and every one of those answers is a non-empty string, so
  // `if (await getAdminUser())` would send an anonymous visitor to /admin, which
  // sends them straight back here, forever.
  const session = await getAdminUser();
  const params = await searchParams;
  const saidBye = single(params.bye) === "1";

  if (isSignedInAdmin(session) && !saidBye) redirect("/admin");

  const environment = await adminEnvironment();
  const arrival = arrivalOf(session, saidBye, single(params.state));

  return (
    <main
      id="content"
      tabIndex={-1}
      className="grid min-h-svh place-items-center px-6 py-16"
    >
      {/*
        The root layout's skip link targets `#content`, which every other admin
        screen gets from `(protected)/layout.tsx`. This page renders outside
        that group, so it carries its own target or the link lands nowhere.
      */}
      <div className="w-full max-w-[26rem]">
        <span aria-hidden="true" className="block h-[26px] w-[35px]" style={WORDMARK} />
        {/*
          The mark is the only brand on this screen and a mask has no accessible
          text, so the name is stated once, here. "Operations" and "Sign in"
          below say what the screen is, not whose it is.
        */}
        <span className="sr-only">MAZJ Admin</span>

        <Eyebrow size={11} className="mt-3">
          Operations
        </Eyebrow>
        <h1 className="mt-4 text-28 font-black tracking-[-0.02em]">Sign in</h1>
        <p className="mt-2 text-15 leading-[1.625] text-subtle-foreground">
          No password. We email a link to your work address, and opening it
          signs you in.
        </p>

        <LoginForm
          linkError={single(params.error) === "1"}
          arrival={arrival}
          signedInAs={isSignedInAdmin(session) ? session.email : undefined}
        />

        {/*
          🔴 The environment marker belongs on the LOGIN screen as much as on
          the rail, because the failure it exists to catch happens before anyone
          is signed in: a deployed admin sent a real, valid magic link that
          landed on `localhost:3000`, because Supabase silently substitutes its
          Site URL when a `redirectTo` is not on the allow list. Every screen
          involved looked correct.

          Nothing renders on production. Absence is the all-clear, so an
          unreadable host reports "preview" rather than nothing (`env-marker.ts`).
        */}
        {environment !== "live" && (
          <p className="mt-6 text-12 text-subtle-foreground">
            {environment === "local" ? (
              <StatusDot tone="quiet" fill="hollow" size="sm" label="Local" />
            ) : (
              <StatusDot
                tone="warn"
                fill="hollow"
                size="sm"
                label="Staging · mazj-tau"
              />
            )}
          </p>
        )}
      </div>
    </main>
  );
}
