"use client";

import {useEffect} from "react";
import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";

/**
 * Route-level error boundary.
 *
 * WHY: the site had none. GSAP + ScrollTrigger, Lenis, an IntersectionObserver
 * reveal layer and a dropdown portaled to document.body all run as client
 * components, so a single runtime throw anywhere in that stack unmounted the
 * whole tree and left a blank page with no recovery and no route back.
 *
 * This boundary sits INSIDE `app/[locale]/layout.tsx`, so `<html lang dir>`,
 * the header and the NextIntlClientProvider all survive: the visitor keeps the
 * navigation, keeps their language, and gets a way forward. Only the failed
 * route content is replaced.
 *
 * COPY: there is no `Error` namespace in messages/*.json yet, and this file
 * does not own those files. Rather than hardcode English (which would be
 * broken Arabic on /ar), every string is read through `t.has()` with a
 * fallback to the `NotFound` namespace, which is already translated in both
 * locales and reads correctly for the visitor's situation: a dead end with a
 * way home. The moment `Error.title` / `Error.body` / `Error.retry` are added
 * to BOTH message files this page upgrades itself with no code change, and
 * the retry button appears.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
  // Root-scope translator so `t.has()` can probe a namespace that may not
  // exist yet. `useTranslations("Error")` would throw on the missing namespace.
  const t = useTranslations();

  useEffect(() => {
    // The digest is the only handle on a production stack trace (real traces
    // are stripped from the client bundle), so it has to reach the console.
    console.error("[mazj] route error", error.digest ?? "", error);
  }, [error]);

  const title = t.has("Error.title") ? t("Error.title") : t("NotFound.title");
  const body = t.has("Error.body") ? t("Error.body") : null;
  const retryLabel = t.has("Error.retry") ? t("Error.retry") : null;

  return (
    <main
      id="content"
      tabIndex={-1}
      className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-beige px-6 text-center"
    >
      <p className="eyebrow text-12 text-muted">500</p>
      <h1 className="text-balance font-sans font-medium text-40 text-black lg:text-70">{title}</h1>
      {body ? (
        <p className="max-w-[46ch] text-pretty text-15 leading-[1.35] text-brown/85 lg:text-16">{body}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-4">
        {/* Rendered only once real copy exists; a button with no accessible
            name is worse than no button. Until then the home link below is
            the way forward, and it still clears the boundary. */}
        {retryLabel ? (
          <button
            type="button"
            onClick={() => reset()}
            className="cta font-sans [--cta-bg:#111111] [--cta-fg:#fff7e9] [--cta-sweep:#FF5A48] [--cta-fg-hover:#111111]"
          >
            <span className="cta__label">{retryLabel}</span>
            <span className="cta__sweep" aria-hidden="true" />
          </button>
        ) : null}

        {/* reset() on click as well as navigating: without it the boundary
            stays latched and the destination renders inside a failed subtree. */}
        <Link
          href="/"
          onClick={() => reset()}
          className="cta font-sans [--cta-bg:#111111] [--cta-fg:#fff7e9] [--cta-sweep:#FF5A48] [--cta-fg-hover:#111111]"
        >
          <span className="cta__label">{t("NotFound.cta")}</span>
          <span className="cta__sweep" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
