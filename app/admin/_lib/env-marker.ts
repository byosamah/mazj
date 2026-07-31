import "server-only";

import { headers } from "next/headers";

import { SITE_URL } from "@/lib/site";

/**
 * Which deployment am I looking at?
 *
 * Nothing on any admin screen has ever answered that, and the cost of not
 * answering it is recorded in the root `CLAUDE.md`: the deployed admin sent a
 * real, valid magic link that landed on `localhost:3000`, because Supabase
 * silently substitutes its Site URL when a `redirectTo` is not on the allow
 * list. Every screen involved looked correct. The person clicking the link is
 * the only detector that failure has, so the shell says where it is standing.
 *
 * 🔴 THE RAW HOST NEVER REACHES THE UI. This returns one of three literals the
 * chip maps to fixed copy ("Local" / "Staging · mazj-tau" / nothing). The `Host`
 * header is written by the caller, and caller-controlled text rendered inside
 * MAZJ chrome is the shape of a phishing message. Same reasoning as `?error=1`
 * staying a fixed literal rather than forwarding Supabase's prose.
 */

export type AdminEnvironment = "local" | "preview" | "live";

/** Hostname without port, or `null` when the value cannot be read at all. */
function hostnameOf(value: string): string | null {
  try {
    // Parsed rather than split on ":", so an IPv6 literal (`[::1]:3000`) and a
    // bare host both come back correct instead of the first byte before a colon.
    return new URL(`http://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * `headers()` is async in Next 16, so this is too. §4.2 of the spec writes the
 * call without `await`; unawaited it hands the chip a Promise and the marker
 * renders on every environment including production.
 */
export async function adminEnvironment(): Promise<AdminEnvironment> {
  const requestHost = (await headers()).get("host");
  const host = requestHost ? hostnameOf(requestHost) : null;

  // No readable host: report "preview", never "live". Absence of the chip is
  // the all-clear on this screen, so an unknown must not be able to produce it.
  // The expensive direction is a staging deploy that looks like production.
  if (host === null) return "preview";

  if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1") {
    return "local";
  }

  // `SITE_URL` is the same value every canonical, sitemap entry and magic-link
  // redirect is built from, so "the host matches it" is exactly the condition
  // under which those are all pointing at the page you are reading. While it is
  // the `mazj.example` placeholder or a `.vercel.app` alias, nothing matches and
  // the chip stays up, which is the intent.
  const configured = (() => {
    try {
      return new URL(SITE_URL).hostname.toLowerCase();
    } catch {
      return null;
    }
  })();

  return configured !== null && host === configured ? "live" : "preview";
}
