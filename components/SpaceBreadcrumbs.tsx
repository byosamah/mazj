import {getTranslations} from "next-intl/server";
import JsonLd from "./JsonLd";
import {breadcrumbSchema} from "@/lib/schema";

/**
 * BreadcrumbList for the four `/spaces/*` detail pages.
 *
 * These sit three levels deep with no on-page breadcrumb UI, so the hierarchy
 * is invisible to a crawler arriving from search: the only path back up is the
 * global nav, which every page shares and therefore signals nothing about where
 * THIS page sits. The schema is the cheapest way to say it, and it also gives
 * the SERP result a `MAZJ > Spaces > Meeting room` path line instead of a raw
 * URL.
 *
 * Labels come from `Nav` and each space's own `eyebrow` ("Meeting room",
 * "Private office") rather than the display `title` ("Al-Malqa, the meeting
 * room"). A breadcrumb is wayfinding, not a headline: the room's proper name is
 * poetry in the h1 and noise in a trail.
 */
export default async function SpaceBreadcrumbs({
  locale,
  namespace,
  path,
}: {
  locale: string;
  /** The space's own namespace, e.g. `SpaceMeeting`. Must expose `eyebrow`. */
  namespace: string;
  /** Locale-less leaf path, e.g. `/spaces/meeting-room`. */
  path: string;
}) {
  const meta = await getTranslations({locale, namespace: "Meta"});
  const nav = await getTranslations({locale, namespace: "Nav"});
  const space = await getTranslations({locale, namespace});

  return (
    <JsonLd
      data={breadcrumbSchema(locale, [
        {name: meta("siteName"), path: ""},
        {name: nav("spaces"), path: "/spaces"},
        {name: space("eyebrow"), path},
      ])}
    />
  );
}
